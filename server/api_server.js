import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { getDb, getConfig, setConfig, getAllConfig } from './db.js';
import { printProductionTicket, printClosingReceipt, printTestPage } from './printer.js';
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
const app    = express();
const httpServer = createServer(app);
const io     = new SocketIO(httpServer, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve o frontend compilado em produção
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
    ok: true,
    version: '2.0.0',
    ts: Date.now(),
    uptime: Math.floor(process.uptime()),
    mode: IS_CLOUD ? 'CLOUD' : 'LOCAL'
  });
});

app.get('/api/cloud-dashboard', async (req, res) => {
  if (!IS_CLOUD || !cloudPool) {
    return res.status(403).json({ error: 'Disponível apenas em Modo Nuvem com Postgres.' });
  }
  try {
    const { rows: comandas } = await cloudPool.query("SELECT * FROM cloud_comandas WHERE status = 'FECHADA' ORDER BY closed_at DESC LIMIT 50");
    const { rows: openComandas } = await cloudPool.query("SELECT * FROM cloud_comandas WHERE status = 'ABERTA'");
    
    // Agregados básicos
    const faturamento = comandas.reduce((acc, c) => acc + (c.total || 0), 0);
    const tickets = comandas.length;
    res.json({ ok: true, faturamento, tickets, comandasFechadas: comandas, comandasAbertas: openComandas.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  res.json(getAllConfig());
});

app.put('/api/config', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    setConfig(key, value);
  }
  res.json({ ok: true, updated: Object.keys(updates).length });
});

// ════════════════════════════════════════════════════════════════════════════
// MESAS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/tables', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM mesas ORDER BY id').all();
  res.json(rows);
});

app.put('/api/tables/:id', (req, res) => {
  const db  = getDb();
  const { status, capacity, time_active } = req.body;
  db.prepare(`
    INSERT INTO mesas (id, status, capacity, time_active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, capacity=excluded.capacity, time_active=excluded.time_active
  `).run(req.params.id, status || 'LIVRE', capacity || 4, time_active || null);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// LÓGICA UNIFICADA DE PROCESSAMENTO E ROTEAMENTO
// ════════════════════════════════════════════════════════════════════════════
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

  // 2. Inserir itens no banco (Ignorar se já existem)
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

  // 3. Roteamento Inteligente (BAR vs COZINHA)
  const drinkKeywords = /Sake|Drink|Cha|Chá|Cerveja|Beer|Chopp|Coca|Lata|Agua|Água|Suco|Vinho|Gin|Long Neck|Refrigerante|Budweiser|Sprit|Fanta|Guarana|Guaraná|Pepsi|Soda|Tonica|Tônica|Red Bull|Monster|H2O|Cafe|Café/i;
  
  const barItems = items.filter(i => {
    const name = i.name || '';
    const id = String(i.menuItemId || i.id || '');
    const isDrink = id.startsWith('b') || drinkKeywords.test(name);
    console.log(`[DETECÇÃO] Item: "${name}" -> ROTA: ${isDrink ? 'BAR' : 'COZINHA'}`);
    return isDrink;
  });
  const kitchenItems = items.filter(i => !barItems.includes(i));

  console.log(`[ROTEAMENTO] Mesa ${mesaId} | BAR: ${barItems.length} | KITCHEN: ${kitchenItems.length}`);

  let lastPrintResult = { ok: true };
  const printJobs = [];
  if (kitchenItems.length > 0) printJobs.push({ key: 'KITCHEN', lines: kitchenItems });
  if (barItems.length > 0)     printJobs.push({ key: 'BAR',     lines: barItems });

  for (const job of printJobs) {
    const payload = {
      mesaId: `${mesaId}`,
      garcom: garcom || 'Garçom',
      itens: job.lines.map(i => ({ qty: i.qty, name: i.name, notes: i.notes })),
    };

    console.log(`[IMPRESSÃO] Enviando para ${job.key}...`);
    const res = await printProductionTicket(payload, job.key);
    
    // Log do trabalho no banco
    db.prepare(`
      INSERT INTO print_jobs (mesa_id, printer_key, status, payload, printed_at, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      mesaId, job.key,
      res.ok ? 'OK' : 'ERROR',
      JSON.stringify(payload),
      Date.now(),
      res.ok ? null : res.error
    );

    if (res.ok) {
      // Marcar como impresso
      const markPrinted = db.prepare(`UPDATE comanda_itens SET printed = 1 WHERE id = ?`);
      db.transaction(() => {
        for (const it of job.lines) markPrinted.run(it.id);
      })();
    } else {
      lastPrintResult = res;
      console.error(`[FALHA] Impressora ${job.key}: ${res.error}`);
    }
  }

  // Notificar via Socket.IO
  io.emit('new_order', { mesaId, items: newItems, garcom });

  return { 
    ok: true, 
    comandaId: comanda.id, 
    newItems: newItems.length, 
    print: lastPrintResult 
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ROTAS DE PEDIDO
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/enviar-pedido', async (req, res) => {
  const { mesa, itens } = req.body;
  console.log(`[API LEGACY] Mesa ${mesa} enviou ${itens?.length} itens`);

  const formattedItems = (itens || []).map((item) => ({
    id: item.id || `item-${Date.now()}-${Math.random()}`,
    menuItemId: item.menuItemId || item.id,
    name: item.name || 'Item Sem Nome',
    price: item.price || 0,
    qty: item.qty || 1,
    notes: item.notes,
    createdAt: Date.now()
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
  console.log(`[API MODERNA] Mesa ${mesaId} enviou ${items?.length} itens`);
  
  try {
    const result = await processOrderInternal(mesaId, garcom, items);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Status de todos os itens PENDING (para o KDS fazer polling)
app.get('/api/orders/pending', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ci.*, c.mesa_id
    FROM comanda_itens ci
    JOIN comandas c ON c.id = ci.comanda_id
    WHERE ci.status IN ('PENDING', 'READY')
    AND c.status = 'ABERTA'
    ORDER BY ci.created_at ASC
  `).all();
  res.json(rows);
});

// Atualizar status de um item (READY, SERVED)
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

  // Notifica garçons via Socket.io
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
    UPDATE comandas SET status = 'FECHADA', closed_at = ?, subtotal = ?, total = ?, payment_method = ?, sync_status = 'PENDING' WHERE id = ?
  `).run(Date.now(), subtotal, total, paymentMethod, comanda.id);

  db.prepare(`UPDATE mesas SET status = 'LIVRE', time_active = NULL WHERE id = ?`).run(mesaId);

  let printResult = { ok: true, skipped: true };
  if (printReceipt) {
    const items = db.prepare(`SELECT * FROM comanda_itens WHERE comanda_id = ?`).all(comanda.id);
    printResult = await printClosingReceipt({
      mesaId: `Mesa ${mesaId}`,
      itens: items,
      subtotal, serviceFee, total, paymentMethod,
    }, 'KITCHEN');
  }

  io.emit('table_closed', { mesaId });
  res.json({ ok: true, print: printResult });
});

app.post('/api/print/production', async (req, res) => {
  const result = await printProductionTicket(req.body, req.query.printer || 'KITCHEN');
  res.json(result);
});

app.post('/api/print/receipt', async (req, res) => {
  const result = await printClosingReceipt(req.body, req.query.printer || 'KITCHEN');
  res.json(result);
});

app.post('/api/print/test', async (req, res) => {
  const printerKey = req.body?.printer || 'KITCHEN';
  const result = await printTestPage(printerKey);
  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// SOCKET.IO — Tempo Real
// ════════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[WS] Cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[WS] Cliente desconectado: ${socket.id}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FRONTEND CATCH-ALL
// ════════════════════════════════════════════════════════════════════════════
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
const startServer = () => {
  if (!IS_CLOUD) {
    try {
      getDb();
      console.log('📦 Bancos locais (SQLite) inicializados com sucesso.');
    } catch (err) {
      console.error('❌ Erro ao inicializar SQLite:', err.message);
    }
  }

  // Iniciar serviço de Cloud Sync (seja local ou pra verificar cloud)
  startCloudSync();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor Sushiflow [${IS_CLOUD ? 'CLOUD' : 'LOCAL'}] na porta ${PORT}`);
    if (!IS_CLOUD) {
      console.log(`LAN:   http://IP-DA-REDE:${PORT}`);
      console.log(`Local: http://localhost:${PORT}`);
    } else {
      console.log(`🌐 Servindo dashboard remota atrelada ao PostgreSQL.`);
    }
  });
};

startServer();
