/**
 * SushiFlow — Motor de Impressão ESC/POS
 * Suporte: Epson, Bematech, Elgin, Daruma, Star, genérica ESC/POS
 * Conexões: USB (Windows/Linux) e Rede TCP (IP:porta)
 */
import ThermalPrinter, { PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { getConfig } from './db.js';

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
  if (mode === 'network') {
    const [host, port = '9100'] = iface.split(':');
    return `tcp://${host}:${port}`;
  }

  // USB — no Windows, se 'auto', usa o pipe do driver padrão
  // O node-thermal-printer suporta '\\\\.\\COM3' ou nome da impressora ou pipe do Windows
  if (iface === 'auto') {
    // Tenta o caminho padrão de uma térmica USB no Windows
    return `//localhost/EPSON_TM_T20`;
  }
  return iface; // Ex: '//localhost/Bematech_4200', '\\\\.\\COM3'
}

// ─── Cria instância da impressora ────────────────────────────────────────────
async function createPrinter(printerKey) {
  const brand     = getConfig(`PRINTER_${printerKey}_TYPE`)     || 'EPSON';
  const mode      = getConfig(`PRINTER_${printerKey}_MODE`)     || 'usb';
  const rawIface  = getConfig(`PRINTER_${printerKey}_INTERFACE`) || 'auto';
  const width     = parseInt(getConfig('PRINT_WIDTH') || '48', 10);

  const printerType = BRAND_MAP[brand.toUpperCase()] || PrinterTypes.EPSON;
  const iface       = buildInterface(mode, rawIface);

  const printer = new ThermalPrinter({
    type:          printerType,
    interface:     iface,
    width:         width,
    characterSet:  CharacterSet.SLOVENIA,   // suporte a ç, ã, á, etc.
    breakLine:     BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '─',
    options: {
      timeout: 5000,
    },
  });

  return { printer, mode, iface };
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

    const success = await printer.execute();
    if (!success) throw new Error('Printer execute() returned false');
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

    const success = await printer.execute();
    if (!success) throw new Error('Printer execute() returned false');
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
