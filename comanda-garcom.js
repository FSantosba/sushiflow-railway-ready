import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

async function imprimirComandaDoGarcom() {
    console.log("-----------------------------------------");
    console.log("📝 Gerando Comanda do App do Garçom...");
    console.log("-----------------------------------------");

    // Dados que seriam enviados pelo app do garçom
    const pedido = {
        mesa: "MESA 04",
        itens: [
            { qty: 2, name: "Uramaki Salmão", notes: "Sem cream cheese" },
            { qty: 1, name: "Combo Executivo 1", notes: "Adicional de tarê" },
            { qty: 2, name: "Coca-Cola Zero", notes: "Com gelo e limão" }
        ],
        total: 125.50
    };

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'receipt.bin' // Gera o arquivo binário localmente
    });

    try {
        console.log("📝 Montando cupom na memória...");
        printer.alignCenter();
        printer.bold(true);
        printer.println(`--- SUSHIFLOW ---`);
        printer.setTextSize(1, 1);
        printer.println(`PEDIDO ${pedido.mesa}`);
        printer.setTextNormal();
        printer.bold(false);
        printer.drawLine();

        printer.alignLeft();
        pedido.itens.forEach(item => {
            printer.bold(true);
            printer.println(`${item.qty}x ${item.name}`);
            printer.bold(false);
            if (item.notes) {
                printer.println(`   >> ${item.notes}`);
            }
        });

        printer.drawLine();
        printer.alignRight();
        printer.bold(true);
        printer.println(`TOTAL: R$ ${pedido.total.toFixed(2)}`);
        printer.bold(false);
        
        // Espaço para corte
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Extrai o buffer (binário cru ESC/POS)
        const buffer = printer.getBuffer();
        
        // Salva arquivo temporáriamente
        const tempFile = path.resolve('comanda-garcom.bin');
        fs.writeFileSync(tempFile, buffer);
        console.log("✅ Código de máquina ESC/POS da comanda processado.");

        // Dispara para o Spooler do Windows (Impressora real)
        console.log("🚀 Lançando para a EPSON TM-T20...");
        execSync(`copy /B "${tempFile}" "\\\\localhost\\EPSON TM-T20 Receipt"`, { stdio: 'inherit' });
        
        console.log(`✅ Comanda da ${pedido.mesa} cortada e impressa fisicamente!`);

    } catch (error) {
        console.error("❌ ERRO AO IMPRIMIR:", error.message);
    }
}

imprimirComandaDoGarcom();
