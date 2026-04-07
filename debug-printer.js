import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

async function testPrinterConnection() {
    console.log("-----------------------------------------");
    console.log("🔍 Iniciando teste via arquivo e comando de copia Windows...");
    console.log("-----------------------------------------");

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'receipt.bin' // Usamos um mock pra ele compilar em memória
    });

    try {
        printer.alignCenter();
        printer.println("--------------------------------");
        printer.println(" TESTE DE IMPRESSAO SUSHIFLOW ");
        printer.println("--------------------------------");
        printer.alignLeft();
        printer.println("Metodo: COPY /B");
        printer.println("Printer: \\\\localhost\\Caixa");
        printer.cut();

        // Pega os bytes cru da impressora (ESC/POS)
        const buffer = printer.getBuffer();
        
        // Salva num arquivo temporario
        const tempFile = path.resolve('receipt.bin');
        fs.writeFileSync(tempFile, buffer);
        console.log("✅ Arquivo receipt.bin gerado no disco.");

        // Usa o Windows para enviar o arquivo para a impressora compartilhada
        console.log("🚀 Enviando para \\\\localhost\\SushiflowUSB via Windows...");
        execSync(`copy /B "${tempFile}" "\\\\localhost\\SushiflowUSB"`);
        
        console.log("✅ Sucesso! O Windows confirmou a copia do ticket.");
    } catch (error) {
        console.error("❌ FALHA CRÍTICA:");
        console.error(error.message);
    }
}

testPrinterConnection();
