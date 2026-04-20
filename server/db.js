import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'sushiflow.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Mesas do salão
    CREATE TABLE IF NOT EXISTS mesas (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'LIVRE',
      capacity INTEGER DEFAULT 4,
      time_active TEXT
    );

    -- Pedidos agrupados por mesa
    CREATE TABLE IF NOT EXISTS comandas (
      id TEXT PRIMARY KEY,
      mesa_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ABERTA',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      closed_at INTEGER,
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_geral REAL DEFAULT 0,
      payment_method TEXT,
      sync_status TEXT DEFAULT 'PENDING',
      cloud_id TEXT
    );

    -- Itens de cada comanda
    CREATE TABLE IF NOT EXISTS comanda_itens (
      id TEXT PRIMARY KEY,
      comanda_id TEXT NOT NULL REFERENCES comandas(id),
      mesa_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      printed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      ready_at INTEGER,
      sync_status TEXT DEFAULT 'PENDING',
      cloud_id TEXT
    );

    -- Cardápio / Produtos
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      categoria TEXT DEFAULT 'Outros',
      imagem_url TEXT,
      disponivel INTEGER DEFAULT 1,
      spicy INTEGER DEFAULT 0,
      vegan INTEGER DEFAULT 0,
      gluten_free INTEGER DEFAULT 0,
      printer_route TEXT DEFAULT 'KITCHEN',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    -- Configurações do sistema
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ─── Impressoras (suporte a N impressoras) ────────────────────────────────
    CREATE TABLE IF NOT EXISTS printers (
      key TEXT PRIMARY KEY,           -- 'KITCHEN', 'BAR', 'PIZZA', etc.
      name TEXT NOT NULL,             -- Nome amigável: "Cozinha", "Bar"
      type TEXT DEFAULT 'EPSON',      -- 'EPSON', 'STAR', 'BEMATECH', 'ELGIN', 'GENERIC'
      mode TEXT DEFAULT 'usb',        -- 'usb' | 'network'
      interface_path TEXT DEFAULT 'auto', -- USB: nome Windows ou 'auto' | Rede: '192.168.1.50:9100'
      enabled INTEGER DEFAULT 1,      -- 0 = desativada
      heartbeat INTEGER DEFAULT 0,    -- 1 = enviar keep-alive a cada 4min (só network)
      is_default INTEGER DEFAULT 0,   -- 1 = usada para cupom de fechamento
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    -- ─── Fila de impressão auditável com suporte a retry ────────────────────
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa_id TEXT NOT NULL,
      printer_key TEXT NOT NULL,
      job_type TEXT NOT NULL DEFAULT 'PRODUCTION', -- 'PRODUCTION' | 'CLOSING'
      status TEXT NOT NULL DEFAULT 'PENDING',      -- 'OK' | 'ERROR' | 'DEAD'
      payload TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      printed_at INTEGER
    );

    -- Reservas agendadas
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL,
      people INTEGER NOT NULL,
      time TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AGUARDANDO',
      table_preference TEXT,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    -- Fila de espera
    CREATE TABLE IF NOT EXISTS waiting_list (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL,
      people INTEGER NOT NULL,
      start_time INTEGER NOT NULL,
      needs_high_chair INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'AGUARDANDO'
    );

    -- Configuração de disponibilidade para reservas
    CREATE TABLE IF NOT EXISTS reservation_config (
      id TEXT PRIMARY KEY, -- 'AVAILABILITY'
      config_json TEXT NOT NULL -- Contém slots, blockedDates, etc.
    );
  `);

  // ─── Migrações seguras para bancos existentes ────────────────────────────
  const safeAlter = (sql) => { try { db.exec(sql); } catch (e) {} };

  safeAlter("ALTER TABLE comandas ADD COLUMN sync_status TEXT DEFAULT 'PENDING'");
  safeAlter("ALTER TABLE comandas ADD COLUMN cloud_id TEXT");
  safeAlter("ALTER TABLE comandas ADD COLUMN total_geral REAL DEFAULT 0");
  safeAlter("ALTER TABLE comanda_itens ADD COLUMN sync_status TEXT DEFAULT 'PENDING'");
  safeAlter("ALTER TABLE comanda_itens ADD COLUMN cloud_id TEXT");

  // Migração da tabela print_jobs (adicionar colunas novas em BDs antigos)
  safeAlter("ALTER TABLE print_jobs ADD COLUMN job_type TEXT DEFAULT 'PRODUCTION'");
  safeAlter("ALTER TABLE print_jobs ADD COLUMN retry_count INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE print_jobs ADD COLUMN last_error TEXT");

  // ─── Configurações padrão do sistema ────────────────────────────────────
  const configDefaults = [
    ['SERVER_PORT',           '3001'],
    ['RESTAURANT_NAME',       'SushiFlow Restaurante'],
    ['PRINT_WIDTH',           '48'],
    ['SERVICE_FEE_PCT',       '10'],
    // Legado (fallback quando impressora não está na tabela printers)
    ['PRINTER_KITCHEN_TYPE',      'EPSON'],
    ['PRINTER_KITCHEN_MODE',      'usb'],
    ['PRINTER_KITCHEN_INTERFACE', 'auto'],
    ['PRINTER_BAR_TYPE',          'EPSON'],
    ['PRINTER_BAR_MODE',          'network'],
    ['PRINTER_BAR_INTERFACE',     '192.168.2.105:9100'],
  ];

  const upsertConfig = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
  db.transaction(() => { for (const row of configDefaults) upsertConfig.run(row); })();

  // ─── Impressoras padrão (KITCHEN + BAR — inseridas uma vez) ─────────────
  const upsertPrinter = db.prepare(`
    INSERT OR IGNORE INTO printers (key, name, type, mode, interface_path, enabled, heartbeat, is_default)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  db.transaction(() => {
    upsertPrinter.run('KITCHEN', 'Cozinha',    'EPSON', 'usb',     'auto',             0, 1); // is_default=1
    upsertPrinter.run('BAR',     'Bar',        'EPSON', 'network', '192.168.2.105:9100', 1, 0);
  })();
}

// ─── Helpers de Config ───────────────────────────────────────────────────────
export function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row?.value;
}

export function setConfig(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
}

export function getAllConfig() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM config').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ─── Helpers de Impressoras ──────────────────────────────────────────────────
export function getPrinters() {
  const db = getDb();
  return db.prepare('SELECT * FROM printers ORDER BY is_default DESC, key ASC').all();
}

export function getPrinter(key) {
  const db = getDb();
  return db.prepare('SELECT * FROM printers WHERE key = ?').get(key.toUpperCase());
}

export function addPrinter({ key, name, type = 'EPSON', mode = 'usb', interface_path = 'auto', enabled = 1, heartbeat = 0, is_default = 0 }) {
  const db = getDb();
  const upperKey = key.toUpperCase().replace(/\s+/g, '_');
  db.prepare(`
    INSERT INTO printers (key, name, type, mode, interface_path, enabled, heartbeat, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(upperKey, name, type, mode, interface_path, enabled ? 1 : 0, heartbeat ? 1 : 0, is_default ? 1 : 0);
  return { key: upperKey };
}

export function updatePrinter(key, fields) {
  const db = getDb();
  const upperKey = key.toUpperCase();
  const allowed = ['name', 'type', 'mode', 'interface_path', 'enabled', 'heartbeat', 'is_default'];
  const sets = Object.keys(fields).filter(k => allowed.includes(k));
  if (sets.length === 0) return;
  const sql = `UPDATE printers SET ${sets.map(k => `${k} = ?`).join(', ')} WHERE key = ?`;
  db.prepare(sql).run(...sets.map(k => fields[k]), upperKey);
}

export function deletePrinter(key) {
  const db = getDb();
  const upperKey = key.toUpperCase();
  const PROTECTED = ['KITCHEN', 'BAR'];
  if (PROTECTED.includes(upperKey)) throw new Error(`A impressora "${upperKey}" é padrão do sistema e não pode ser removida.`);
  db.prepare('DELETE FROM printers WHERE key = ?').run(upperKey);
}

// ─── Helpers de Fila de Impressão ───────────────────────────────────────────
export function getPrintQueue({ limit = 50, status } = {}) {
  const db = getDb();
  if (status) {
    return db.prepare(`SELECT * FROM print_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?`).all(status, limit);
  }
  return db.prepare(`SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function getPrintJob(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id);
}

export function resetPrintJob(id) {
  const db = getDb();
  db.prepare(`UPDATE print_jobs SET status = 'ERROR', retry_count = 0, last_error = 'Retry manual solicitado' WHERE id = ?`).run(id);
}

// ─── Helpers de Reservas ────────────────────────────────────────────────────
export function getReservations() {
  const db = getDb();
  return db.prepare('SELECT * FROM reservations ORDER BY date ASC, time ASC').all();
}

export function upsertReservation(res) {
  const db = getDb();
  db.prepare(`
    INSERT INTO reservations (id, customer, phone, people, time, date, status, table_preference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer=excluded.customer, phone=excluded.phone, people=excluded.people,
      time=excluded.time, date=excluded.date, status=excluded.status,
      table_preference=excluded.table_preference, notes=excluded.notes
  `).run(res.id, res.customer, res.phone, res.people, res.time, res.date, res.status, res.tablePreference || null, res.notes || null);
}

export function deleteReservation(id) {
  const db = getDb();
  db.prepare('DELETE FROM reservations WHERE id = ?').run(id);
}

// ─── Helpers de Fila de Espera ──────────────────────────────────────────────
export function getWaitingList() {
  const db = getDb();
  return db.prepare('SELECT * FROM waiting_list WHERE status != "FINALIZADO" ORDER BY start_time ASC').all();
}

export function upsertWaitingEntry(entry) {
  const db = getDb();
  db.prepare(`
    INSERT INTO waiting_list (id, customer, phone, people, start_time, needs_high_chair, notified, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer=excluded.customer, phone=excluded.phone, people=excluded.people,
      needs_high_chair=excluded.needs_high_chair, notified=excluded.notified, status=excluded.status
  `).run(entry.id, entry.customer, entry.phone, entry.people, entry.startTime, entry.needsHighChair ? 1 : 0, entry.notified ? 1 : 0, entry.status || 'AGUARDANDO');
}

export function deleteWaitingEntry(id) {
  const db = getDb();
  db.prepare('DELETE FROM waiting_list WHERE id = ?').run(id);
}

// ─── Helpers de Config de Reserva ──────────────────────────────────────────
export function getReservationConfig() {
  const db = getDb();
  const row = db.prepare('SELECT config_json FROM reservation_config WHERE id = "AVAILABILITY"').get();
  const defaultConfig = { slots: [], blockedDates: [], active: true };
  if (!row) return defaultConfig;
  try {
    const config = JSON.parse(row.config_json);
    return { ...defaultConfig, ...config };
  } catch (err) {
    return defaultConfig;
  }
}

export function saveReservationConfig(config) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO reservation_config (id, config_json) VALUES ("AVAILABILITY", ?)').run(JSON.stringify(config));
}
