const better = require('better-sqlite3');
const db = better('sushiflow.db');

const jobs = db.prepare('SELECT printer_key, status, payload FROM print_jobs ORDER BY created_at DESC LIMIT 5').all();

jobs.forEach(j => {
  const p = JSON.parse(j.payload);
  console.log(`${j.printer_key} | ${j.status} | ${p.mesaId} - ${p.itens[0]?.name}`);
});