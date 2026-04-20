const fetch = require('node-fetch');

async function testRouting() {
  const serverUrl = 'http://localhost:3000';
  
  const payloadLegacy = {
    mesa: '99',
    itens: [
      { id: 'item-sim-1', name: 'Budweiser Long Neck', price: 15, qty: 1 },
      { id: 'item-sim-2', name: 'Temaki Salmão', price: 35, qty: 1 }
    ]
  };

  console.log('--- TESTANDO ROTA LEGACY ---');
  try {
    const res = await fetch(`${serverUrl}/api/enviar-pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadLegacy)
    });
    const data = await res.json();
    console.log('Resultado Legacy:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro no teste legacy:', err.message);
  }

  const payloadModern = {
    mesaId: '98',
    garcom: 'Teste Robo',
    items: [
      { id: 'item-sim-3', menuItemId: 'b-01', name: 'Coca Lata', price: 8, qty: 2 },
      { id: 'item-sim-4', menuItemId: 'f-01', name: 'Sushi Combo', price: 60, qty: 1 }
    ]
  };

  console.log('\n--- TESTANDO ROTA MODERNA ---');
  try {
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadModern)
    });
    const data = await res.json();
    console.log('Resultado Moderno:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro no teste moderno:', err.message);
  }
}

testRouting();
