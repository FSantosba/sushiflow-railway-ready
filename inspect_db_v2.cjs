const Database = require('better-sqlite3');
const db = new Database('sushiflow.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('--- TABLES ---');
tables.forEach(t => {
  const row = db.prepare(`SELECT count(*) as count FROM ${t.name}`).get();
  console.log(`Table: ${t.name} | Rows: ${row.count}`);
  const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log(`Columns: ${info.map(c => c.name).join(', ')}`);
  console.log('---');
});
