import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import {
  getDb, getConfig, setConfig, getAllConfig,
  getPrinters, getPrinter, addPrinter, updatePrinter, deletePrinter,
  getPrintQueue, getPrintJob, resetPrintJob,
} from './db.js';
import { printProductionTicket, printClosingReceipt, printTestPage, startHeartbeat, getPrinterList } from './printer.js';
import { startPrintWorker, retryFailedJobs } from './printWorker.js';
import { fileURLToPath } from 'url';
import { startCloudSync } from './cloudSync.js';
import pg from 'pg';
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IS_CLOUD = process.env.RUN_MODE === 'CLOUD';
let cloudPool = null;
if (IS_CLOUD && process.env.DATABASE_URL) {
  cloudPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const io         = new SocketIO(httpServer, { cors: { origin: '*' } });

// Trava na porta 3001 (Backend padrão) para não colidir com o Frontend Vite (que usa 3000)
const PORT       = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));


const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ─── Middleware de log ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ════════════════════════════════════════════════════════════════════════════
// HEALTH & CLOUD SYNC
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    ok:     true,
    version: '3.0.0',
    ts:     Date.now(),
    uptime: Math.floor(process.uptime()),
    mode:   IS_CLOUD ? 'CLOUD' : 'LOCAL',
  });
});

app.get('/api/cloud-dashboard', async (req, res) => {
  if (!IS_CLOUD || !cloudPool) {
    return res.status(403).json({ error: 'Disponível apenas em Modo Nuvem com Postgres.' });
  }
  try {
    const { rows: comandas }     = await cloudPool.query("SELECT * FROM cloud_comandas WHERE status = 'FECHADA' ORDER BY closed_at DESC LIMIT 50");
    const { rows: openComandas } = await cloudPool.query("SELECT * FROM cloud_comandas WHERE status = 'ABERTA'");
    const faturamento = comandas.reduce((acc, c) => acc + (c.total || 0), 0);
    res.json({ ok: true, faturamento, tickets: comandas.length, comandasFechadas: comandas, comandasAbertas: openComandas.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/config', (_req, res) => res.json(getAllConfig()));

app.put('/api/config', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) setConfig(key, value);
  res.json({ ok: true, updated: Object.keys(updates).length });
});

// ════════════════════════════════════════════════════════════════════════════
// ═══  IMPRESSORAS — CRUD + STATUS  ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

// GET /api/printers — Lista todas as impressoras configuradas
app.get('/api/printers', (_req, res) => {
  try {
    res.json(getPrinters());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/printers/status — Verifica conectividade real (deve vir ANTES de /:key!)
app.get('/api/printers/status', async (_req, res) => {
  const printers = getPrinters();
  const results = await Promise.all(printers.map(async (p) => {
    let online = false;
    let detail = '';
    try {
      if (p.mode === 'network') {
        const iface = p.interface_path || '';
        const [host, portStr] = iface.replace(/^tcp:\/\//, '').split(':');
        if (host && host !== 'auto') {
          const { default: net } = await import('net');
          online = await new Promise((resolve) => {
            const s = new net.Socket();
            s.setTimeout(3000);
            s.on('connect', () => { s.destroy(); resolve(true); });
            s.on('error',   () => { s.destroy(); resolve(false); });
            s.on('timeout', () => { s.destroy(); resolve(false); });
            s.connect(parseInt(portStr || '9100'), host);
          });
          detail = online
            ? `TCP OK (${host}:${portStr || 9100})`
            : `TCP falhou — impressora inacessível em ${host}:${portStr || 9100}`;
        } else {
          detail = 'IP não configurado';
        }
      } else {
        // USB: consulta spooler Windows via PowerShell (wmic está deprecado no Win11)
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          // Get-Printer retorna lista de impressoras instaladas no spooler
          const { stdout } = await execAsync(
            `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus | ConvertTo-Json -Compress"`,
            { timeout: 8000 }
          );
          // Busca pelo nome configurado (ou EPSON como fallback)
          const searchName = (p.interface_path && p.interface_path !== 'auto')
            ? p.interface_path.replace(/^\/\/localhost\//i, '').replace(/\\/g, '')
            : 'EPSON';
          const lowerOut = stdout.toLowerCase();
          online = lowerOut.includes(searchName.toLowerCase()) || lowerOut.includes('epson');
          detail = online
            ? `Impressora encontrada no Spooler Windows (${searchName})`
            : `Não encontrada \u2014 verifique o nome no Gerenciador de Impressoras do Windows`;
        } catch (e) {
          detail = `Erro ao consultar Spooler (${e.message?.slice(0, 60)})`;
        }
      }
    } catch (e) {
      detail = `Erro: ${e.message}`;
    }
    return { key: p.key, name: p.name, mode: p.mode, online, detail };
  }));
  res.json(results);
});

// GET /api/printers/:key — Detalhes de uma impressora (deve vir DEPOIS de /status)
app.get('/api/printers/:key', (req, res) => {
  const printer = getPrinter(req.params.key);
  if (!printer) return res.status(404).json({ error: 'Impressora não encontrada' });
  res.json(printer);
});

// POST /api/printers — Adiciona nova impressora
// Body: { key, name, type, mode, interface_path, enabled, heartbeat, is_default }
app.post('/api/printers', (req, res) => {
  const { key, name } = req.body;
  if (!key || !name) return res.status(400).json({ error: 'key e name são obrigatórios' });
  try {
    const result = addPrinter(req.body);
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/printers/:key — Atualiza impressora existente
app.put('/api/printers/:key', (req, res) => {
  try {
    updatePrinter(req.params.key, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/printers/:key — Remove impressora (KITCHEN e BAR são protegidas)
app.delete('/api/printers/:key', (req, res) => {
  try {
    deletePrinter(req.params.key);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/printers/:key/test — Imprime página de teste
app.post('/api/printers/:key/test', async (req, res) => {
  const result = await printTestPage(req.params.key.toUpperCase());
  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// ═══  FILA DE IMPRESSÃO  ═════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════

// GET /api/print/queue — Lista jobs recentes (com filtro opcional por status)
// Query: ?status=ERROR&limit=50
app.get('/api/print/queue', (req, res) => {
  const limit  = parseInt(req.query.limit || '50');
  const status = req.query.status;
  res.json(getPrintQueue({ limit, status }));
});

// POST /api/print/retry/:id — Força reimpressão de um job específico
app.post('/api/print/retry/:id', async (req, res) => {
  const job = getPrintJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });

  // Reseta o contador e dispara imediatamente
  resetPrintJob(req.params.id);
  await retryFailedJobs(); // Roda o worker agora
  res.json({ ok: true, message: 'Reimpressão solicitada' });
});

// POST /api/print/retry-all — Força reimpressão de todos os jobs com ERROR
app.post('/api/print/retry-all', async (_req, res) => {
  const db = getDb();
  db.prepare(`UPDATE print_jobs SET retry_count = 0 WHERE status = 'ERROR'`).run();
  await retryFailedJobs();
  res.json({ ok: true });
});

// POST /api/print/test — Página de teste (legado, mantido para compatibilidade)
app.post('/api/print/test', async (req, res) => {
  const printerKey = (req.body?.printer || 'KITCHEN').toUpperCase();
  const result = await printTestPage(printerKey);
  res.json(result);
});

// POST /api/print/production — Impressão manual de comanda
app.post('/api/print/production', async (req, res) => {
  const result = await printProductionTicket(req.body, (req.query.printer || 'KITCHEN').toUpperCase());
  res.json(result);
});

// POST /api/print/receipt — Impressão manual de recibo
app.post('/api/print/receipt', async (req, res) => {
  const result = await printClosingReceipt(req.body, (req.query.printer || 'KITCHEN').toUpperCase());
  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// PRODUTOS / CARDÁPIO
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/produtos', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM produtos ORDER BY categoria, nome').all());
});

app.post('/api/produtos', (req, res) => {
  const db = getDb();
  const { id, nome, descricao, preco, categoria, imagem_url, disponivel, spicy, vegan, gluten_free, printer_route } = req.body;
  const produtoId = id || `prod-${Date.now()}`;
  db.prepare(`
    INSERT INTO produtos (id, nome, descricao, preco, categoria, imagem_url, disponivel, spicy, vegan, gluten_free, printer_route)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(produtoId, nome, descricao || '', preco || 0, categoria || 'Outros', imagem_url || '', disponivel !== false ? 1 : 0, spicy ? 1 : 0, vegan ? 1 : 0, gluten_free ? 1 : 0, printer_route || 'KITCHEN');
  res.json({ ok: true, id: produtoId });
});

app.put('/api/produtos/:id', (req, res) => {
  const db = getDb();
  const { nome, descricao, preco, categoria, imagem_url, disponivel, spicy, vegan, gluten_free, printer_route } = req.body;
  db.prepare(`
    UPDATE produtos SET nome = ?, descricao = ?, preco = ?, categoria = ?, imagem_url = ?,
    disponivel = ?, spicy = ?, vegan = ?, gluten_free = ?, printer_route = ?
    WHERE id = ?
  `).run(nome, descricao || '', preco || 0, categoria || 'Outros', imagem_url || '', disponivel !== false ? 1 : 0, spicy ? 1 : 0, vegan ? 1 : 0, gluten_free ? 1 : 0, printer_route || 'KITCHEN', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/produtos/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// MESAS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/tables', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM mesas ORDER BY id').all());
});

app.put('/api/tables/:id', (req, res) => {
  const db = getDb();
  const { status, capacity, time_active } = req.body;
  db.prepare(`
    INSERT INTO mesas (id, status, capacity, time_active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, capacity=excluded.capacity, time_active=excluded.time_active
  `).run(req.params.id, status || 'LIVRE', capacity || 4, time_active || null);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// LÓGICA UNIFICADA DE PROCESSAMENTO DE PEDIDOS
// ════════════════════════════════════════════════════════════════════════════

// Palavras-chave para fallback de roteamento (quando produto não está no cardápio)
const DRINK_KEYWORDS = /Sake|Drink|Cha|Chá|Cerveja|Beer|Chopp|Coca|Lata|Agua|Água|Suco|Vinho|Gin|Long Neck|Refrigerante|Budweiser|Sprit|Fanta|Guarana|Guaraná|Pepsi|Soda|Tonica|Tônica|Red Bull|Monster|H2O|Cafe|Café/i;

async function processOrderInternal(mesaId, garcom, items) {
  const db = getDb();

  if (!mesaId || !items?.length) {
    throw new Error('mesaId e items são obrigatórios');
  }

  // 1. Garantir comanda aberta
  let comanda = db.prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'ABERTA'`).get(mesaId);
  if (!comanda) {
    const id = `comanda-${mesaId}-${Date.now()}`;
    db.prepare(`INSERT INTO comandas (id, mesa_id, status) VALUES (?, ?, 'ABERTA')`).run(id, mesaId);
    comanda = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
  }

  // 2. Inserir itens no banco (ignora duplicatas)
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO comanda_itens (id, comanda_id, mesa_id, menu_item_id, name, price, qty, notes, status, printed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?)
  `);

  const newItems = [];
  db.transaction(() => {
    for (const item of items) {
      const res = insertItem.run(
        item.id, comanda.id, mesaId,
        item.menuItemId || item.id,
        item.name || 'Item Sem Nome',
        item.price || 0,
        item.qty || 1,
        item.notes || null,
        item.createdAt || Date.now()
      );
      if (res.changes > 0) newItems.push(item);
    }
  })();

  // 3. ─── Roteamento Inteligente por printer_route ─────────────────────────
  //    Prioridade: campo printer_route do produto → keyword fallback
  const routeMap = new Map(); // printerKey → items[]

  for (const item of items) {
    // Consulta o produto no cardápio para obter sua rota de impressão
    const produto = db.prepare('SELECT printer_route FROM produtos WHERE id = ?').get(item.menuItemId || item.id);

    let printerKey;
    if (produto?.printer_route) {
      printerKey = produto.printer_route.toUpperCase();
    } else {
      // Fallback: detecta bebidas por ID ou nome (compatibilidade)
      const isDrink = String(item.menuItemId || item.id || '').startsWith('b') || DRINK_KEYWORDS.test(item.name || '');
      printerKey = isDrink ? 'BAR' : 'KITCHEN';
    }

    console.log(`[ROTEAMENTO] "${item.name}" → ${printerKey}`);
    if (!routeMap.has(printerKey)) routeMap.set(printerKey, []);
    routeMap.get(printerKey).push(item);
  }

  // 4. Imprimir por impressora (paralelo se múltiplas)
  const printJobs = Array.from(routeMap.entries()).map(([key, lines]) => ({ key, lines }));
  console.log(`[ROTEAMENTO] Mesa ${mesaId} | Jobs: ${printJobs.map(j => `${j.key}(${j.lines.length})`).join(', ')}`);

  let lastPrintResult = { ok: true };

  for (const job of printJobs) {
    const payload = {
      mesaId: `${mesaId}`,
      garcom: garcom || 'Garçom',
      itens:  job.lines.map(i => ({ qty: i.qty, name: i.name, notes: i.notes })),
    };

    console.log(`[IMPRESSÃO] Enviando para ${job.key}...`);
    const res = await printProductionTicket(payload, job.key);

    // Registra na fila auditável
    db.prepare(`
      INSERT INTO print_jobs (mesa_id, printer_key, job_type, status, payload, printed_at, last_error)
      VALUES (?, ?, 'PRODUCTION', ?, ?, ?, ?)
    `).run(
      mesaId, job.key,
      res.ok ? 'OK' : 'ERROR',
      JSON.stringify(payload),
      res.ok ? Date.now() : null,
      res.ok ? null : res.error
    );

    if (res.ok) {
      // Marcar itens como impressos
      const markPrinted = db.prepare(`UPDATE comanda_itens SET printed = 1 WHERE id = ?`);
      db.transaction(() => { for (const it of job.lines) markPrinted.run(it.id); })();
    } else {
      lastPrintResult = res;
      console.error(`[FALHA] Impressora ${job.key}: ${res.error} — Job salvo para reimpressão automática.`);
    }
  }

  // Notificar via Socket.IO
  io.emit('new_order', { mesaId, items: newItems, garcom });

  return {
    ok:        true,
    comandaId: comanda.id,
    newItems:  newItems.length,
    print:     lastPrintResult,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ROTAS DE PEDIDO
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/enviar-pedido', async (req, res) => {
  const { mesa, itens } = req.body;
  console.log(`[API LEGACY] Mesa ${mesa} | ${itens?.length} itens`);

  const formattedItems = (itens || []).map(item => ({
    id:         item.id || `item-${Date.now()}-${Math.random()}`,
    menuItemId: item.menuItemId || item.id,
    name:       item.name || 'Item Sem Nome',
    price:      item.price || 0,
    qty:        item.qty || 1,
    notes:      item.notes,
    createdAt:  Date.now(),
  }));

  try {
    const result = await processOrderInternal(String(mesa), 'App Garçom', formattedItems);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { mesaId, garcom, items } = req.body;
  console.log(`[API MODERNA] Mesa ${mesaId} | ${items?.length} itens`);
  try {
    const result = await processOrderInternal(mesaId, garcom, items);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Itens PENDING para KDS
app.get('/api/orders/pending', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ci.*, c.mesa_id
    FROM comanda_itens ci
    JOIN comandas c ON c.id = ci.comanda_id
    WHERE ci.status IN ('PENDING', 'READY') AND c.status = 'ABERTA'
    ORDER BY ci.created_at ASC
  `).all();
  res.json(rows);
});

// Atualizar status de item (READY, SERVED)
app.patch('/api/orders/items/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['PENDING', 'READY', 'SERVED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const readyAt = status === 'READY' ? Date.now() : null;
  db.prepare(`
    UPDATE comanda_itens SET status = ?, ready_at = COALESCE(?, ready_at), sync_status = 'PENDING' WHERE id = ?
  `).run(status, readyAt, req.params.id);

  const item = db.prepare('SELECT * FROM comanda_itens WHERE id = ?').get(req.params.id);
  io.emit('item_status_changed', { itemId: req.params.id, status, mesaId: item?.mesa_id });
  res.json({ ok: true });
});

// Fechar mesa (checkout)
app.post('/api/orders/close/:mesaId', async (req, res) => {
  const db = getDb();
  const { mesaId } = req.params;
  const { paymentMethod, subtotal, serviceFee, total, printReceipt = true } = req.body;

  const comanda = db.prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'ABERTA'`).get(mesaId);
  if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });

  db.prepare(`
    UPDATE comandas SET status = 'FECHADA', closed_at = ?, subtotal = ?, total = ?,
    payment_method = ?, sync_status = 'PENDING' WHERE id = ?
  `).run(Date.now(), subtotal, total, paymentMethod, comanda.id);

  db.prepare(`UPDATE mesas SET status = 'LIVRE', time_active = NULL WHERE id = ?`).run(mesaId);

  // Determina impressora padrão para cupom de fechamento
  let closingPrinterKey = 'KITCHEN';
  try {
    const db2 = getDb();
    const defaultPrinter = db2.prepare(`SELECT key FROM printers WHERE is_default = 1 AND enabled = 1 LIMIT 1`).get();
    if (defaultPrinter) closingPrinterKey = defaultPrinter.key;
  } catch (e) {}

  let printResult = { ok: true, skipped: true };
  if (printReceipt) {
    const items = db.prepare(`SELECT * FROM comanda_itens WHERE comanda_id = ?`).all(comanda.id);
    const payload = { mesaId: `Mesa ${mesaId}`, itens: items, subtotal, serviceFee, total, paymentMethod };

    printResult = await printClosingReceipt(payload, closingPrinterKey);

    // Salva na fila auditável
    db.prepare(`
      INSERT INTO print_jobs (mesa_id, printer_key, job_type, status, payload, printed_at, last_error)
      VALUES (?, ?, 'CLOSING', ?, ?, ?, ?)
    `).run(
      mesaId, closingPrinterKey,
      printResult.ok ? 'OK' : 'ERROR',
      JSON.stringify(payload),
      printResult.ok ? Date.now() : null,
      printResult.ok ? null : printResult.error
    );
  }

  io.emit('table_closed', { mesaId });
  res.json({ ok: true, print: printResult });
});

// ════════════════════════════════════════════════════════════════════════════
// SOCKET.IO — Tempo Real
// ════════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[WS] Cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[WS] Cliente desconectado: ${socket.id}`));
});

// ════════════════════════════════════════════════════════════════════════════
// FRONTEND CATCH-ALL
// ════════════════════════════════════════════════════════════════════════════
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
function startServer() {
  if (!IS_CLOUD) {
    try {
      getDb();
      console.log('📦 Banco local (SQLite) inicializado com sucesso.');
    } catch (err) {
      console.error('❌ Erro ao inicializar SQLite:', err.message);
      process.exit(1);
    }
  }

  // Serviços de background
  startCloudSync();
  startPrintWorker();   // ← Worker de reimpressão automática
  startHeartbeat();     // ← Keep-alive para impressoras de rede

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SushiFlow [${IS_CLOUD ? 'CLOUD' : 'LOCAL'}] na porta ${PORT}`);
    if (!IS_CLOUD) {
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Rede:    http://IP-DA-MAQUINA:${PORT}`);
      console.log(`   Fila:    http://localhost:${PORT}/api/print/queue`);
      console.log(`   Imp.:    http://localhost:${PORT}/api/printers\n`);
    }
  });
}

startServer();
