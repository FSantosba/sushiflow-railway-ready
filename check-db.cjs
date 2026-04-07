const better = require('better-sqlite3');
const db = better('sushiflow.db');

console.log('=== Tabelas ===');
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());

console.log('\n=== Produtos ===');
console.log(db.prepare('SELECT id, nome, printer_route FROM produtos LIMIT 20').all());