const Database = require('better-sqlite3');
const db = new Database('sushiflow.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tabelas:', tables.map(t => t.name).join(', '));

tables.forEach(t => {
  const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log(`Colunas de ${t.name}:`, info.map(c => c.name).join(', '));
});
