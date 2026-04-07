/**
 * SushiFlow — Worker de Reimpressão Automática
 * ─────────────────────────────────────────────
 * - Roda a cada 30 segundos
 * - Lê os jobs com status = 'ERROR' da tabela print_jobs
 * - Reimprime usando printProductionTicket ou printClosingReceipt
 * - Atualiza retry_count a cada tentativa
 * - Marca como 'DEAD' após MAX_RETRIES falhas (mantém no log, não tenta mais)
 */
import { getDb } from './db.js';
import { printProductionTicket, printClosingReceipt } from './printer.js';

const MAX_RETRIES      = 5;
const CHECK_INTERVAL   = 30 * 1000; // 30 segundos
const STARTUP_DELAY    = 15 * 1000; // Aguarda 15s após start (servidor estabilizar)

let workerTimer = null;

// ─── Inicia o worker ──────────────────────────────────────────────────────────
export function startPrintWorker() {
  if (workerTimer) return; // Evita iniciar duplicado

  console.log('[WORKER] 🔄 Worker de reimpressão iniciado (verificação a cada 30s)');

  // Primeira varredura após 15s (dá tempo ao servidor subir e impressoras conectarem)
  const startupTimer = setTimeout(retryFailedJobs, STARTUP_DELAY);
  startupTimer.unref?.(); // Não impede o processo de encerrar se necessário

  workerTimer = setInterval(retryFailedJobs, CHECK_INTERVAL);
  workerTimer.unref?.();
}

// ─── Para o worker ────────────────────────────────────────────────────────────
export function stopPrintWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[WORKER] ⏹  Worker de reimpressão parado.');
  }
}

// ─── Núcleo: varre a fila e reimprime ────────────────────────────────────────
export async function retryFailedJobs() {
  const db = getDb();
  let pendingJobs = [];

  try {
    pendingJobs = db.prepare(`
      SELECT * FROM print_jobs
      WHERE status = 'ERROR' AND retry_count < ?
      ORDER BY created_at ASC
      LIMIT 20
    `).all(MAX_RETRIES);
  } catch (e) {
    // Tabela pode não existir em boot muito rápido → ignora
    return;
  }

  if (pendingJobs.length === 0) return;

  console.log(`\n[WORKER] 🖨  ${pendingJobs.length} job(s) na fila de reimpressão...`);

  for (const job of pendingJobs) {
    const attempt = (job.retry_count || 0) + 1;
    console.log(`[WORKER] Job #${job.id} | Mesa: ${job.mesa_id} | Impressora: ${job.printer_key} | Tentativa ${attempt}/${MAX_RETRIES}`);

    // Parse do payload salvo
    let payload;
    try {
      payload = JSON.parse(job.payload);
    } catch (e) {
      console.error(`[WORKER] ❌ Job #${job.id} tem payload corrompido. Marcando como DEAD.`);
      db.prepare(`UPDATE print_jobs SET status = 'DEAD', last_error = 'Payload JSON inválido' WHERE id = ?`).run(job.id);
      continue;
    }

    // Seleciona a função correta de impressão
    const printFn = job.job_type === 'CLOSING'
      ? printClosingReceipt
      : printProductionTicket;

    const result = await printFn(payload, job.printer_key);

    if (result.ok) {
      db.prepare(`
        UPDATE print_jobs 
        SET status = 'OK', printed_at = ?, last_error = NULL 
        WHERE id = ?
      `).run(Date.now(), job.id);
      console.log(`[WORKER] ✅ Job #${job.id} reimpresso com sucesso!`);
    } else {
      const isDead = attempt >= MAX_RETRIES;
      db.prepare(`
        UPDATE print_jobs 
        SET status = ?, retry_count = ?, last_error = ? 
        WHERE id = ?
      `).run(isDead ? 'DEAD' : 'ERROR', attempt, result.error, job.id);

      if (isDead) {
        console.error(`[WORKER] 💀 Job #${job.id} MORTO após ${MAX_RETRIES} tentativas. Erro: ${result.error}`);
        console.error(`[WORKER] 💀 Verifique a impressora "${job.printer_key}" manualmente!`);
      } else {
        console.warn(`[WORKER] ⚠️  Job #${job.id} ainda falhando (${attempt}/${MAX_RETRIES}). Próxima tentativa em 30s.`);
      }
    }
  }
}
