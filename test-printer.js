// Teste de impressão direto via Motor SushiFlow (Porta 3001)
const testData = {
    mesa: "TESTE",
    itens: [
        { qty: 1, name: "Sashimi Salmão (TESTE)", notes: "Sem gergelim" },
        { qty: 2, name: "Temaki Filadélfia (TESTE)", notes: "" }
    ],
    total: 100.00
};


async function testPrinter() {
    console.log("🚀 Enviando pedido de teste para o motor...");
    try {
        const response = await fetch('http://localhost:3001/api/enviar-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const result = await response.json();
        console.log("✅ Resultado do motor:", result);
        if (result.success) {
            console.log("✨ Se a impressora estiver ligada e com o nome correto, ela deve ter impresso agora!");
        }
    } catch (error) {
        console.error("❌ Erro ao conectar com o motor:", error.message);
        console.log("⚠️ Certifique-se de que o 'node server.js' está rodando!");
    }
}

testPrinter();
