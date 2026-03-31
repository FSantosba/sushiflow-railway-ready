import pkg from 'pg';
const { Pool } = pkg;
import { getDb } from './db.js';

let pool = null;

export async function startCloudSync() {
  const connectionString = process.env.DATABASE_URL;

  if (process.env.RUN_MODE === 'CLOUD') {
    console.log('[SYNC] Executando em MODO NUVEM. O Sync local está desabilitado.');
    return;
  }

  if (!connectionString) {
    console.warn('[SYNC] DATABASE_URL não definido. Sincronização em nuvem desativada.');
    return;
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    // Garantir que as tabelas espelho existem no PostgreSQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cloud_comandas (
        id TEXT PRIMARY KEY,
        mesa_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at BIGINT,
        closed_at BIGINT,
        subtotal REAL,
        total REAL,
        payment_method TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cloud_comanda_itens (
        id TEXT PRIMARY KEY,
        comanda_id TEXT,
        mesa_id TEXT,
        menu_item_id TEXT,
        name TEXT,
        price REAL,
        qty INTEGER,
        notes TEXT,
        status TEXT,
        created_at BIGINT,
        ready_at BIGINT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[SYNC] Tabelas da nuvem inicializadas.');
  } catch (err) {
    console.error('[SYNC] Erro ao conectar com PostgreSQL:', err.message);
    return;
  }

  // Intervalo de Sincronismo (ex: a cada 60s)
  setInterval(syncData, 60000);
  
  // Roda uma vez logo de cara (esperando 5 seg pra não travar inicialização)
  setTimeout(syncData, 5000);
}

async function syncData() {
  if (!pool) return;
  const db = getDb();

  try {
    // 1. Puxar Comandas Pendentes
    const comandasPendentes = db.prepare(`SELECT * FROM comandas WHERE sync_status = 'PENDING'`).all();
    
    if (comandasPendentes.length > 0) {
      console.log(`[SYNC] Sincronizando ${comandasPendentes.length} comandas...`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const c of comandasPendentes) {
          await client.query(`
            INSERT INTO cloud_comandas (id, mesa_id, status, created_at, closed_at, subtotal, total, payment_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              closed_at = EXCLUDED.closed_at,
              subtotal = EXCLUDED.subtotal,
              total = EXCLUDED.total,
              payment_method = EXCLUDED.payment_method,
              synced_at = CURRENT_TIMESTAMP
          `, [c.id, c.mesa_id, c.status, c.created_at, c.closed_at, c.subtotal, c.total, c.payment_method]);
        }
        await client.query('COMMIT');
        
        // Marcar commo SYNCED localmente
        const updateStatus = db.prepare(`UPDATE comandas SET sync_status = 'SYNCED' WHERE id = ?`);
        const tx = db.transaction(() => {
            for (const c of comandasPendentes) updateStatus.run(c.id);
        });
        tx();

      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // 2. Puxar Itens Pendentes
    const itensPendentes = db.prepare(`SELECT * FROM comanda_itens WHERE sync_status = 'PENDING'`).all();
    if (itensPendentes.length > 0) {
      console.log(`[SYNC] Sincronizando ${itensPendentes.length} itens...`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const i of itensPendentes) {
          await client.query(`
            INSERT INTO cloud_comanda_itens (id, comanda_id, mesa_id, menu_item_id, name, price, qty, notes, status, created_at, ready_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              qty = EXCLUDED.qty,
              ready_at = EXCLUDED.ready_at,
              notes = EXCLUDED.notes,
              synced_at = CURRENT_TIMESTAMP
          `, [i.id, i.comanda_id, i.mesa_id, i.menu_item_id, i.name, i.price, i.qty, i.notes, i.status, i.created_at, i.ready_at]);
        }
        await client.query('COMMIT');

        // Marcar commo SYNCED localmente
        const updateItemStatus = db.prepare(`UPDATE comanda_itens SET sync_status = 'SYNCED' WHERE id = ?`);
        const tx = db.transaction(() => {
            for (const i of itensPendentes) updateItemStatus.run(i.id);
        });
        tx();

      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.error('[SYNC] Erro durante sincronização:', err.message);
  }
}
