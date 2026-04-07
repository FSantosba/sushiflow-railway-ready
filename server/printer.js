/**
 * SushiFlow — Motor de Impressão ESC/POS v2.0
 * ─────────────────────────────────────────────
 * Melhorias:
 *  - Retry automático (3x com backoff: 1s → 3s → 9s)
 *  - Health-check TCP antes de imprimir via rede
 *  - execAsync (não-bloqueante) para impressoras USB/Spooler Windows
 *  - Timeout generoso (15s) para Spooler do Windows
 *  - Suporte a N impressoras (tabela `printers` + fallback em `config`)
 *  - Heartbeat para manter impressoras de rede acordadas (modo sleep EPSON)
 *  - Suporte: Epson, Bematech, Elgin, Daruma, Star, genérica ESC/POS
 */
import pkg from 'node-thermal-printer';
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = pkg;
import { getDb, getConfig } from './db.js';
import fs from 'fs';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Mapeia marca → PrinterTypes ────────────────────────────────────────────
const BRAND_MAP = {
  EPSON:    PrinterTypes.EPSON,
  STAR:     PrinterTypes.STAR,
  BEMATECH: PrinterTypes.EPSON,   // Bematech MP usa ESC/POS Epson-compatível
  ELGIN:    PrinterTypes.EPSON,   // Elgin i9 usa ESC/POS
  DARUMA:   PrinterTypes.EPSON,   // Daruma DR800 usa ESC/POS
  GENERIC:  PrinterTypes.EPSON,
};

// ─── Health Check TCP (verifica se impressora de rede está acessível) ────────
async function checkTcpPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error',   () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(parseInt(port), host);
  });
}

// ─── Retry com backoff exponencial ──────────────────────────────────────────
async function withRetry(fn, printerKey, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxRetries;
      console.warn(`[PRINT] ⚠️  Tentativa ${attempt}/${maxRetries} falhou (${printerKey}): ${err.message}`);
      if (!isLast) {
        const delay = Math.pow(3, attempt - 1) * 1000; // 1s, 3s, 9s
        console.log(`[PRINT] ⏱  Aguardando ${delay / 1000}s antes de tentar novamente...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── Carrega config da impressora ────────────────────────────────────────────
// Prioridade: tabela `printers` → tabela `config` (legado)
function loadPrinterConfig(printerKey) {
  const db = getDb();
  try {
    const countRow = db.prepare('SELECT count(*) as c FROM printers').get();
    if (countRow && countRow.c > 0) {
      // Tabela existe e tem dados, ignorar fallback
      const row = db.prepare('SELECT * FROM printers WHERE key = ? AND enabled = 1').get(printerKey);
      if (!row) {
        throw new Error(`Impressora "${printerKey}" não está cadastrada ou está desabilitada na tabela printers.`);
      }
      return {
        brand:     row.type           || 'EPSON',
        mode:      row.mode           || 'usb',
        rawIface:  row.interface_path || 'auto',
        name:      row.name           || printerKey,
        heartbeat: !!row.heartbeat,
      };
    }
  } catch (e) { /* tabela pode não existir no primeiro boot */ }

  // Fallback para config table (compatibilidade com versões antigas)
  return {
    brand:     getConfig(`PRINTER_${printerKey}_TYPE`)      || 'EPSON',
    mode:      getConfig(`PRINTER_${printerKey}_MODE`)      || 'usb',
    rawIface:  getConfig(`PRINTER_${printerKey}_INTERFACE`) || 'auto',
    name:      printerKey,
    heartbeat: false,
  };
}

// ─── Auto-detecta nome real da impressora no Spooler do Windows ─────────────
const _usbPrinterCache = new Map(); // printerKey → detected name

async function detectWindowsPrinterName(printerKey, hints = ['SushiflowUSB', 'EPSON TM-T20', 'EPSON TM', 'EPSON']) {
  // DEBUG: limpa cache forçado para cada requisição
  console.log(`[DETECT] ${printerKey}: Cache antes: ${_usbPrinterCache.get(printerKey) || 'vazio'}`);
  _usbPrinterCache.delete(printerKey);
  
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(Get-Printer).Name | ConvertTo-Json -Compress"`,
      { timeout: 6000 }
    );
    const names = JSON.parse(stdout.trim());
    const list = Array.isArray(names) ? names : [names];
    console.log(`[DETECT] ${printerKey}: Impressoras disponíveis:`, list);
    
    for (const hint of hints) {
      const found = list.find(n => n.toLowerCase().includes(hint.toLowerCase()));
      if (found) {
        console.log(`[DETECT] ${printerKey}: Encontrado "${found}" via hint "${hint}"`);
        _usbPrinterCache.set(printerKey, found);
        return found;
      }
    }
  } catch (e) {
    console.warn(`[DETECT] ${printerKey}: Erro ao detectar:`, e.message);
  }
  
  console.log(`[DETECT] ${printerKey}: Nenhuma impressora encontrada, usando fallback: SushiflowUSB`);
  return 'SushiflowUSB';
}

// ─── Constrói string de interface ────────────────────────────────────────────
function buildInterface(mode, iface) {
  if (!iface || iface === 'auto') {
    // Para USB: será resolvido de forma async em createPrinter()
    return mode === 'network' ? 'tcp://127.0.0.1:9100' : '__AUTO_DETECT__';
  }
  // Se parece um IP (ex: "192.168.1.50" ou "192.168.1.50:9100")
  if (mode === 'network' && iface.match(/^[0-9.]+(?::[0-9]+)?$/)) {
    if (!iface.includes(':')) iface += ':9100';
    return `tcp://${iface}`;
  }
  return iface;
}

// ─── Converte caminho para formato Windows (UNC) ──────────────────────────
function toWindowsPath(iface) {
  // "//localhost/EPSON TM-T20 Receipt" → "\\localhost\EPSON TM-T20 Receipt"
  return iface
    .replace(/^\/\//, '\\\\')
    .replace(/\//g, '\\');
}

// ─── Cria instância da impressora ────────────────────────────────────────────
async function createPrinter(printerKey) {
  const config   = loadPrinterConfig(printerKey);
  console.log(`[PRINTER] ${printerKey}: Carregado config → mode: ${config.mode}, iface: ${config.rawIface}`);
  const width    = parseInt(getConfig('PRINT_WIDTH') || '48', 10);

  const printerType = BRAND_MAP[config.brand.toUpperCase()] || PrinterTypes.EPSON;
  let iface         = buildInterface(config.mode, config.rawIface);
  const isNetwork   = iface.startsWith('tcp://');

  // USB: resolve o nome real no Spooler do Windows
  if (!isNetwork && iface === '__AUTO_DETECT__') {
    console.log(`[PRINTER] ${printerKey}: Modo USB detectado, buscando impressora no Spooler...`);
    const realName = await detectWindowsPrinterName(printerKey);
    iface = `//localhost/${realName}`;
  }

  console.log(`[PRINTER] ${printerKey} (${config.name}) | ${config.brand} | ${isNetwork ? `TCP → ${iface}` : `USB → ${iface}`}`);

  // Para impressoras de rede: verifica conectividade ANTES de montar o buffer
  if (isNetwork) {
    const [host, portStr] = iface.replace('tcp://', '').split(':');
    const port = parseInt(portStr || '9100');
    const alive = await checkTcpPort(host, port, 4000);
    if (!alive) {
      throw new Error(`Impressora "${config.name}" (${printerKey}) inacessível em ${host}:${port}`);
    }
  }

  const printer = new ThermalPrinter({
    type:                  printerType,
    interface:             isNetwork ? iface : `receipt_${printerKey}.bin`,
    width,
    characterSet:          CharacterSet.PC860_PORTUGUESE,
    breakLine:             BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter:         '-',
    options: {
      timeout: 15000,
    },
  });

  return { printer, config, iface, isNetwork };
}


// ─── Envia buffer para a impressora (rede ou USB) ────────────────────────────
async function sendToPrinter(created, printerKey) {
  console.log(`[SEND] ${printerKey}: isNetwork=${created.isNetwork}, iface=${created.iface}`);
  
  if (created.isNetwork) {
    // Envio TCP: node-thermal-printer abre socket e envia ESC/POS
    await created.printer.execute();
    console.log(`[PRINT] ✅ Enviado via TCP → ${created.iface} (${printerKey})`);
  } else {
    // USB/Spooler Windows:
    const buffer   = created.printer.getBuffer();
    const fileName = `receipt_${printerKey}_${Date.now()}.bin`;
    fs.writeFileSync(fileName, buffer);

    const winPath = toWindowsPath(created.iface);
    console.log(`[PRINT] USB → copy /B "${fileName}" "${winPath}"`);

    try {
      const { stdout, stderr } = await execAsync(
        `copy /B "${fileName}" "${winPath}"`,
        { timeout: 20000 }
      );
      console.log(`[PRINT] ✅ USB/Spooler OK (${printerKey}) → ${stdout.trim()}`);
      if (stderr) console.warn(`[PRINT] ⚠️ stderr: ${stderr.trim()}`);
    } finally {
      try { fs.unlinkSync(fileName); } catch {}
    }
  }
}

// ─── Formatação shared ───────────────────────────────────────────────────────
function divider(printer) { printer.drawLine(); }

function formatMoney(value) {
  return `R$ ${Number(value).toFixed(2)}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  COMANDA DE PRODUÇÃO (Cozinha / Bar / qualquer estação)
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object}   payload
 * @param {string}   payload.mesaId   — "Mesa 05"
 * @param {string}   payload.garcom   — "João"
 * @param {Object[]} payload.itens    — [{qty, name, notes}]
 * @param {string}   printerKey       — 'KITCHEN' | 'BAR' | qualquer chave cadastrada
 */
export async function printProductionTicket(payload, printerKey = 'KITCHEN') {
  const restaurantName = getConfig('RESTAURANT_NAME') || 'SushiFlow';
  const now = new Date().toLocaleString('pt-BR');

  try {
    return await withRetry(async () => {
      const created = await createPrinter(printerKey);
      const { printer } = created;

      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println('*** COMANDA DE PRODUCAO ***');
      printer.bold(false);
      printer.println(restaurantName);
      divider(printer);

      printer.alignLeft();
      printer.bold(true);
      printer.println(`MESA: ${payload.mesaId}`);
      printer.bold(false);
      if (payload.garcom) printer.println(`Garcom: ${payload.garcom}`);
      printer.println(`Data: ${now}`);
      divider(printer);

      printer.setTextSize(1, 1);
      for (const item of payload.itens) {
        printer.bold(true);
        printer.println(`${String(item.qty).padStart(2)}x  ${item.name}`);
        printer.bold(false);
        if (item.notes) printer.println(`     OBS: ${item.notes}`);
      }
      divider(printer);

      printer.alignCenter();
      printer.println('LEVE ATE A MESA IMEDIATAMENTE');
      printer.newLine();
      printer.newLine();
      printer.cut();

      await sendToPrinter(created, printerKey);
      return { ok: true };

    }, printerKey, 3); // 3 tentativas com backoff

  } catch (err) {
    console.error(`[PRINT] ❌ Falha definitiva na comanda (${printerKey}): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  CUPOM DE FECHAMENTO DE CONTA
// ════════════════════════════════════════════════════════════════════════════
export async function printClosingReceipt(payload, printerKey = 'KITCHEN') {
  const restaurantName = getConfig('RESTAURANT_NAME') || 'SushiFlow';
  const servicePct     = getConfig('SERVICE_FEE_PCT') || '10';
  const now            = new Date().toLocaleString('pt-BR');

  try {
    return await withRetry(async () => {
      const created = await createPrinter(printerKey);
      const { printer } = created;
      const width = parseInt(getConfig('PRINT_WIDTH') || '48', 10);

      printer.alignCenter();
      printer.bold(true);
      printer.println(restaurantName.toUpperCase());
      printer.bold(false);
      printer.println('EXTRATO DA MESA');
      divider(printer);

      printer.alignLeft();
      printer.println(`Mesa: ${payload.mesaId}`);
      printer.println(`Data: ${now}`);
      divider(printer);

      for (const item of payload.itens) {
        const left  = `${item.qty}x ${item.name}`.substring(0, width - 10);
        const right = formatMoney(item.price * item.qty);
        const pad   = width - left.length - right.length;
        printer.println(left + ' '.repeat(Math.max(1, pad)) + right);
      }
      divider(printer);

      printer.println(`Subtotal:${' '.repeat(Math.max(1, width - 9 - formatMoney(payload.subtotal).length))}${formatMoney(payload.subtotal)}`);
      const feeLabel = `Taxa de Servico (${servicePct}%):`;
      printer.println(`${feeLabel}${' '.repeat(Math.max(1, width - feeLabel.length - formatMoney(payload.serviceFee).length))}${formatMoney(payload.serviceFee)}`);
      divider(printer);

      printer.bold(true);
      printer.setTextSize(1, 1);
      const totalLabel = 'TOTAL:';
      const totalStr   = formatMoney(payload.total);
      printer.println(`${totalLabel}${' '.repeat(Math.max(1, width - totalLabel.length - totalStr.length))}${totalStr}`);
      printer.bold(false);
      printer.setTextSize(0, 0);

      if (payload.paymentMethod) printer.println(`Pagamento: ${payload.paymentMethod}`);

      printer.newLine();
      printer.alignCenter();
      printer.println('Obrigado pela preferencia!');
      printer.println('Volte sempre :)');
      printer.newLine();
      printer.newLine();
      printer.cut();

      await sendToPrinter(created, printerKey);
      return { ok: true };

    }, printerKey, 3);

  } catch (err) {
    console.error(`[PRINT] ❌ Falha definitiva no recibo (${printerKey}): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PÁGINA DE TESTE
// ════════════════════════════════════════════════════════════════════════════
export async function printTestPage(printerKey = 'KITCHEN') {
  console.log(`[TESTE] ========== INICIANDO TESTE PARA: ${printerKey} ==========`);
  console.log(`[TESTE] Stack trace abaixo:`);
  console.trace(`[TESTE] Origem da chamada para ${printerKey}`);
  return printProductionTicket({
    mesaId: 'TESTE',
    garcom: 'Sistema SushiFlow',
    itens: [
      { qty: 2, name: 'Salmon Nigiri',     notes: null },
      { qty: 1, name: 'Hot Roll Tempura',  notes: 'Sem molho' },
      { qty: 3, name: 'Sashimi de Atum',   notes: null },
    ],
  }, printerKey);
}

// ════════════════════════════════════════════════════════════════════════════
//  HEARTBEAT — Mantém impressoras de rede acordadas (evita modo sleep EPSON)
// ════════════════════════════════════════════════════════════════════════════
let heartbeatTimer = null;

export function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(async () => {
    const db = getDb();
    let networkPrinters = [];
    try {
      networkPrinters = db.prepare(`
        SELECT key, interface_path 
        FROM printers 
        WHERE mode = 'network' AND enabled = 1 AND heartbeat = 1
      `).all();
    } catch (e) { return; }

    for (const p of networkPrinters) {
      try {
        const iface = buildInterface('network', p.interface_path);
        const [host, portStr] = iface.replace('tcp://', '').split(':');
        if (!host || host === '127.0.0.1') continue;
        const alive = await checkTcpPort(host, parseInt(portStr || '9100'), 2000);
        console.log(`[HEARTBEAT] ${p.key} (${host}) → ${alive ? '✅ Online' : '⚠️  Offline'}`);
      } catch (e) {}
    }
  }, 4 * 60 * 1000); // A cada 4 minutos

  console.log('[HEARTBEAT] Monitor de impressoras de rede ativo (ping a cada 4 min).');
}

// ─── Lista todas as impressoras ───────────────────────────────────────────────
export function getPrinterList() {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM printers ORDER BY is_default DESC, key ASC').all();
  } catch (e) { return []; }
}
