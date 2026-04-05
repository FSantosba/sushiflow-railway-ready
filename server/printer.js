/**
 * SushiFlow — Motor de Impressão ESC/POS
 * Suporte: Epson, Bematech, Elgin, Daruma, Star, genérica ESC/POS
 * Conexões: USB (Windows/Linux) e Rede TCP (IP:porta)
 */
import pkg from 'node-thermal-printer';
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = pkg;
import { getConfig } from './db.js';
import fs from 'fs';
import { execSync } from 'child_process';

// ─── Mapeia marca → PrinterTypes ────────────────────────────────────────────
const BRAND_MAP = {
  EPSON:    PrinterTypes.EPSON,
  STAR:     PrinterTypes.STAR,
  BEMATECH: PrinterTypes.EPSON,   // Bematech MP usa ESC/POS Epson-compatível
  ELGIN:    PrinterTypes.EPSON,   // Elgin i9 usa ESC/POS
  DARUMA:   PrinterTypes.EPSON,   // Daruma DR800 usa ESC/POS
  GENERIC:  PrinterTypes.EPSON,
};

// ─── Constrói interface de conexão ───────────────────────────────────────────
/**
 * @param {'usb'|'network'} mode
 * @param {string} iface  USB: nome do driver Windows ou 'auto' | Rede: '192.168.1.50:9100'
 */
function buildInterface(mode, iface) {
  if (!iface || iface === 'auto') {
    return mode === 'network' ? 'tcp://127.0.0.1:9100' : '//localhost/EPSON TM-T20 Receipt';
  }

  // Se parece um IP, forçamos modo Rede (TCP) independentemente do Mode
  if (iface.match(/^[0-9.]+(?::[0-9]+)?$/)) {
    let finalIface = iface;
    if (!finalIface.includes(':')) finalIface += ':9100'; // Porta padrão Epson/térmicas
    return `tcp://${finalIface}`;
  }

  // Para USB no Windows Spooler (copy /B) ou driver mapeado
  return iface;
}

// ─── Cria instância da impressora ────────────────────────────────────────────
async function createPrinter(printerKey) {
  const brand     = getConfig(`PRINTER_${printerKey}_TYPE`)     || 'EPSON';
  const mode      = getConfig(`PRINTER_${printerKey}_MODE`)     || 'usb';
  const rawIface  = getConfig(`PRINTER_${printerKey}_INTERFACE`) || 'auto';
  const width     = parseInt(getConfig('PRINT_WIDTH') || '48', 10);

  const printerType = BRAND_MAP[brand.toUpperCase()] || PrinterTypes.EPSON;
  const iface       = buildInterface(mode, rawIface);
  const isNetwork   = iface.startsWith('tcp://');

  console.log(`[PRINTER] Criando: ${printerKey} | Marca: ${brand} | Interface: ${isNetwork ? iface : 'USB (SPOOL)'}`);

  const printer = new ThermalPrinter({
    type:          printerType,
    interface:     isNetwork ? iface : `receipt_${printerKey}.bin`, // Se USB, escrevemos buffer em arquivo binario
    width:         width,
    characterSet:  CharacterSet.PC860_PORTUGUESE, // Suporte a ç, ã, á, etc. (PT-BR)
    breakLine:     BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    options: {
      timeout: 5000,
    },
  });

  return { printer, mode, iface, isNetwork };
}

// ─── Funções de formatação ───────────────────────────────────────────────────
function divider(printer) {
  const width = parseInt(getConfig('PRINT_WIDTH') || '48', 10);
  printer.drawLine();
}

function centerBold(printer, text) {
  printer.alignCenter();
  printer.bold(true);
  printer.println(text);
  printer.bold(false);
  printer.alignLeft();
}

function formatMoney(value) {
  return `R$ ${Number(value).toFixed(2)}`;
}

// ─── Impressão da COMANDA DE PRODUÇÃO (para Cumins / Cozinha) ────────────────
/**
 * @param {Object} payload
 * @param {string} payload.mesaId          — "Mesa 05"
 * @param {string} payload.garcom          — "João"
 * @param {Object[]} payload.itens         — [{qty, name, notes}]
 * @param {string} printerKey              — 'KITCHEN' | 'BAR'
 */
export async function printProductionTicket(payload, printerKey = 'KITCHEN') {
  const restaurantName = getConfig('RESTAURANT_NAME') || 'SushiFlow';
  const now = new Date().toLocaleString('pt-BR');

  let printer;
  try {
    const created = await createPrinter(printerKey);
    printer = created.printer;

    // ── Cabeçalho ────────────────────────────────────────────────────────────
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

    // ── Itens ─────────────────────────────────────────────────────────────────
    printer.setTextSize(1, 1);
    for (const item of payload.itens) {
      printer.bold(true);
      printer.println(`${String(item.qty).padStart(2)}x  ${item.name}`);
      printer.bold(false);
      if (item.notes) {
        printer.println(`     OBS: ${item.notes}`);
      }
    }
    divider(printer);

    // ── Rodapé ────────────────────────────────────────────────────────────────
    printer.alignCenter();
    printer.println('LEVE ATE A MESA IMEDIATAMENTE');
    printer.newLine();
    printer.newLine();
    printer.cut();

    if (created.isNetwork) {
      await printer.execute();
      console.log(`[PRINT] ✅ Cupom de Produção enviado via REDE (${printerKey})`);
    } else {
      const buffer = printer.getBuffer();
      const fileName = `receipt_${printerKey}.bin`;
      fs.writeFileSync(fileName, buffer);
      // Fallback Spooler Windows (copy /B) - Garante que o caminho UNC comece com \\
      let cleanPath = created.iface.replace(/[\\]+/g, '\\');
      if (created.iface.startsWith('\\\\') && !cleanPath.startsWith('\\\\')) {
        cleanPath = '\\\\' + cleanPath.replace(/^\\+/, '');
      }
      execSync(`copy /B ${fileName} "${cleanPath}"`, { stdio: 'ignore' });
      console.log(`[PRINT] ✅ Cupom de Produção enviado via USB/Spooler (${printerKey}) na interface: ${cleanPath}`);
    }

    return { ok: true };

  } catch (err) {
    console.error(`[PRINT] Erro ao imprimir (${printerKey}):`, err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Impressão do CUPOM DE FECHAMENTO DE CONTA ──────────────────────────────
/**
 * @param {Object} payload
 * @param {string} payload.mesaId
 * @param {Object[]} payload.itens   — [{qty, name, price}]
 * @param {number}  payload.subtotal
 * @param {number}  payload.serviceFee
 * @param {number}  payload.total
 * @param {string}  payload.paymentMethod
 */
export async function printClosingReceipt(payload, printerKey = 'KITCHEN') {
  const restaurantName = getConfig('RESTAURANT_NAME') || 'SushiFlow';
  const servicePct = getConfig('SERVICE_FEE_PCT') || '10';
  const now = new Date().toLocaleString('pt-BR');

  let printer;
  try {
    const created = await createPrinter(printerKey);
    printer = created.printer;

    // Cabeçalho
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

    // Itens
    const width = parseInt(getConfig('PRINT_WIDTH') || '48', 10);
    for (const item of payload.itens) {
      const left  = `${item.qty}x ${item.name}`.substring(0, width - 10);
      const right = formatMoney(item.price * item.qty);
      const pad   = width - left.length - right.length;
      printer.println(left + ' '.repeat(Math.max(1, pad)) + right);
    }
    divider(printer);

    // Totais
    printer.println(`Subtotal:${' '.repeat(Math.max(1, width - 9 - formatMoney(payload.subtotal).length))}${formatMoney(payload.subtotal)}`);
    const feeLabel = `Taxa de Servico (${servicePct}%):`;
    printer.println(`${feeLabel}${' '.repeat(Math.max(1, width - feeLabel.length - formatMoney(payload.serviceFee).length))}${formatMoney(payload.serviceFee)}`);
    divider(printer);

    printer.bold(true);
    printer.setTextSize(1, 1);
    const totalLabel = 'TOTAL:';
    const totalStr = formatMoney(payload.total);
    printer.println(`${totalLabel}${' '.repeat(Math.max(1, width - totalLabel.length - totalStr.length))}${totalStr}`);
    printer.bold(false);
    printer.setTextSize(0, 0);

    if (payload.paymentMethod) {
      printer.println(`Pagamento: ${payload.paymentMethod}`);
    }

    printer.newLine();
    printer.alignCenter();
    printer.println('Obrigado pela preferencia!');
    printer.println('Volte sempre :)');
    printer.newLine();
    printer.newLine();
    printer.cut();

    if (created.isNetwork) {
      await printer.execute();
      console.log(`[PRINT] ✅ Recibo de Fechamento enviado via REDE (${printerKey})`);
    } else {
      const buffer = printer.getBuffer();
      const fileName = `receipt_${printerKey}.bin`;
      fs.writeFileSync(fileName, buffer);
      // Fallback Spooler Windows (copy /B) - Garante que o caminho UNC comece com \\
      let cleanPath = created.iface.replace(/[\\]+/g, '\\');
      if (created.iface.startsWith('\\\\') && !cleanPath.startsWith('\\\\')) {
        cleanPath = '\\\\' + cleanPath.replace(/^\\+/, '');
      }
      execSync(`copy /B ${fileName} "${cleanPath}"`, { stdio: 'ignore' });
      console.log(`[PRINT] ✅ Recibo de Fechamento enviado via USB/Spooler (${printerKey}) na interface: ${cleanPath}`);
    }

    return { ok: true };

  } catch (err) {
    console.error(`[PRINT] Erro ao imprimir recibo (${printerKey}):`, err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Impressão de TESTE ──────────────────────────────────────────────────────
export async function printTestPage(printerKey = 'KITCHEN') {
  return printProductionTicket({
    mesaId: 'TESTE',
    garcom: 'Sistema SushiFlow',
    itens: [
      { qty: 2, name: 'Salmon Nigiri', notes: null },
      { qty: 1, name: 'Hot Roll Tempura', notes: 'Sem molho' },
      { qty: 3, name: 'Sashimi de Atum', notes: null },
    ],
  }, printerKey);
}
