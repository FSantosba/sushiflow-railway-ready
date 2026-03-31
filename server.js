const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(cors());
app.use(express.json());

// 🗄️ Cria o Banco de Dados Local (O seu Cofre)
const db = new sqlite3.Database('./sushiflow.db', (err) => {
    if (err) console.error("Erro ao criar banco local:", err.message);
    else console.log("✅ Banco de Dados Local (SQLite) pronto.");
});

// Criar tabela de pedidos se não existir
db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa TEXT,
    itens TEXT,
    total REAL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 🖨️ Rota para Imprimir e Salvar Pedido
app.post('/api/enviar-pedido', async (req, res) => {
    const { mesa, itens, total } = req.body;

    // 1. Salva no Banco Local (Funciona sem internet!)
    db.run(`INSERT INTO pedidos (mesa, itens, total) VALUES (?, ?, ?)`,
        [mesa, JSON.stringify(itens), total]);

    // 2. Tenta imprimir (Se a impressora estiver ligada no USB)
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON, // Ou BEMATECH
            interface: 'printer:NOME_DA_SUA_IMPRESSORA', // Ex: 'printer:Epson-TM-T20'
        });

        printer.alignCenter();
        printer.bold(true);
        printer.println(`MESA ${mesa}`);
        printer.bold(false);
        printer.hr();
        itens.forEach(item => {
            printer.println(`${item.qty}x ${item.name}`);
            if (item.notes) printer.println(`  obs: ${item.notes}`);
        });
        printer.cut();
        await printer.execute();
        console.log(`🖨️ Comanda da Mesa ${mesa} impressa!`);
    } catch (error) {
        console.log("⚠️ Impressora não detectada, mas pedido salvo no sistema.");
    }

    res.json({ success: true, message: "Pedido processado localmente!" });
});

app.listen(3001, () => {
    console.log("🚀 Servidor SushiFlow rodando em http://localhost:3001");
});