import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const db = new Database('sushiflow.db');

// Descobre o nome real da impressora EPSON no Spooler
async function main() {
  const { stdout } = await execAsync(
    `powershell -NoProfile -Command "(Get-Printer).Name | ConvertTo-Json -Compress"`,
    { timeout: 8000 }
  );
  const names = JSON.parse(stdout.trim());
  const list = Array.isArray(names) ? names : [names];
  
  // Pega a PRIMEIRA impressora EPSON encontrada (a USB da cozinha)
  const epsonName = list.find(n => n.toLowerCase().includes('epson tm-t20'));
  
  if (!epsonName) {
    console.error('❌ Nenhuma impressora EPSON TM-T20 encontrada no Spooler!');
    console.log('   Impressoras disponíveis:', list.join(', '));
    db.close();
    return;
  }

  console.log('✅ Impressoras encontradas:');
  list.filter(n => n.toLowerCase().includes('epson')).forEach(n => console.log(`   - ${n}`));
  console.log(`\n🖨️  Usando para KITCHEN: "${epsonName}"`);

  // Verifica se tem mais de uma EPSON
  const epsons = list.filter(n => n.toLowerCase().includes('epson tm'));
  if (epsons.length > 1) {
    console.log(`\n⚠️  Múltiplas impressoras EPSON TM encontradas:`);
    epsons.forEach((n, i) => console.log(`   [${i}] ${n}`));
    console.log(`   → Usando a primeira: "${epsonName}"`);
    console.log(`   → Se errada, atualize manualmente em: /api/printers (PUT /api/printers/KITCHEN)`);
  }
  
  // Salva no banco
  db.prepare("UPDATE printers SET interface_path = ? WHERE key = 'KITCHEN'").run(epsonName);
  
  const row = db.prepare("SELECT * FROM printers WHERE key = 'KITCHEN'").get();
  console.log('\n📦 KITCHEN atualizada no banco:', JSON.stringify(row, null, 2));
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
