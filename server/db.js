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

    -- Configurações do sistema (IP servidor, impressoras, etc.)
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Fila de impressão auditável
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa_id TEXT NOT NULL,
      printer_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payload TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      printed_at INTEGER,
      error TEXT
    );
  `);

  // Adicionando colunas em BDs existentes com segurança
  try { db.exec("ALTER TABLE comandas ADD COLUMN sync_status TEXT DEFAULT 'PENDING'"); } catch (e) {}
  try { db.exec("ALTER TABLE comandas ADD COLUMN cloud_id TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE comanda_itens ADD COLUMN sync_status TEXT DEFAULT 'PENDING'"); } catch (e) {}
  try { db.exec("ALTER TABLE comanda_itens ADD COLUMN cloud_id TEXT"); } catch (e) {}


  // Configurações padrão se não existirem
  const defaults = [
    ['SERVER_PORT', '3001'],
    ['RESTAURANT_NAME', 'SushiFlow Restaurante'],
    ['PRINTER_KITCHEN_TYPE', 'EPSON'],
    ['PRINTER_KITCHEN_MODE', 'usb'],
    ['PRINTER_KITCHEN_INTERFACE', 'auto'],   // 'auto' = primeiro USB disponível, ou IP
    ['PRINTER_BAR_TYPE', 'EPSON'],
    ['PRINTER_BAR_MODE', 'network'],
    ['PRINTER_BAR_INTERFACE', '192.168.1.100:9100'],
    ['PRINT_WIDTH', '48'],                   // colunas (80mm=48, 58mm=32)
    ['SERVICE_FEE_PCT', '10'],
  ];

  const upsert = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) upsert.run(row);
  });
  insertMany(defaults);
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────
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
