import { Order, OrderStatus, Table, TableStatus, Printer, PrintRoute, Transaction, PaymentMethod, Employee, EmployeeRole, EmployeeStatus, Goal, BonusEntry, Reservation, ReservationStatus, WaitingEntry, MenuItem, User, UserRole, DeliveryTracking, WalletTransaction, Ingredient, Recipe, ExtendedIngredient } from '../types';

// ─── RESERVAS E FILA DE ESPERA (COMPLETO) ──────────────────────────────

export const mockReservations: Reservation[] = [
  { id: 'R1', customer: 'Fernanda Lima', phone: '11988884444', people: 4, time: '20:00', date: 'Hoje', status: ReservationStatus.CONFIRMED, tablePreference: 'Janela' },
  { id: 'R2', customer: 'Roberto Shinyashiki', phone: '11977773333', people: 2, time: '20:30', date: 'Hoje', status: ReservationStatus.PENDING, notes: 'Aniversário de Casamento' },
  { id: 'R3', customer: 'Juliana Paes', phone: '11966662222', people: 6, time: '21:00', date: 'Hoje', status: ReservationStatus.CONFIRMED, tablePreference: 'Tatame' },
  { id: 'R4', customer: 'Marcos Mion', phone: '11955551111', people: 3, time: '19:30', date: 'Amanhã', status: ReservationStatus.CONFIRMED },
  { id: 'R5', customer: 'Paolla Oliveira', phone: '11944440000', people: 2, time: '21:30', date: 'Hoje', status: ReservationStatus.CONFIRMED },
  { id: 'R6', customer: 'Cauã Reymond', phone: '11933339999', people: 4, time: '20:00', date: 'Amanhã', status: ReservationStatus.PENDING }
];

export const mockWaitingList: WaitingEntry[] = [
  { id: 'W1', customer: 'Bruno Gagliasso', phone: '11911112222', people: 2, startTime: Date.now() - 1000 * 60 * 25, needsHighChair: false, notified: true },
  { id: 'W2', customer: 'Grazi Massafera', phone: '11922223333', people: 4, startTime: Date.now() - 1000 * 60 * 12, needsHighChair: true, notified: false },
  { id: 'W3', customer: 'Lázaro Ramos', phone: '11933334444', people: 5, startTime: Date.now() - 1000 * 60 * 5, needsHighChair: false, notified: false },
  { id: 'W4', customer: 'Thais Fersoza', phone: '11922221111', people: 3, startTime: Date.now() - 1000 * 60 * 2, needsHighChair: false, notified: false }
];

// ─── EQUIPE E RH (COMPLETO) ─────────────────────────────────────────────

export const mockEmployees: Employee[] = [
  { id: 'emp1', name: 'Takashi Mitsui', role: EmployeeRole.SUSHIMAN, status: EmployeeStatus.ONLINE, performance: 92, shiftStart: '17:00', tasksCompleted: 45, avatar: 'https://i.pravatar.cc/150?u=emp1', phone: '11988887777' },
  { id: 'emp2', name: 'Carla Oliveira', role: EmployeeRole.WAITER, status: EmployeeStatus.ONLINE, performance: 85, shiftStart: '18:30', tasksCompleted: 28, avatar: 'https://i.pravatar.cc/150?u=emp2', phone: '11977776666' },
  { id: 'emp3', name: 'Kenji Sato', role: EmployeeRole.MANAGER, status: EmployeeStatus.ONLINE, performance: 98, shiftStart: '16:00', tasksCompleted: 12, avatar: 'https://i.pravatar.cc/150?u=emp3', phone: '11966665555' },
  { id: 'emp4', name: 'Bruno Lima', role: EmployeeRole.DELIVERY, status: EmployeeStatus.BREAK, performance: 70, shiftStart: '19:00', tasksCompleted: 15, avatar: 'https://i.pravatar.cc/150?u=emp4', phone: '11955554444' },
  { id: 'emp5', name: 'Ana Silva', role: EmployeeRole.HOSTESS, status: EmployeeStatus.OFFLINE, performance: 0, shiftStart: '-', tasksCompleted: 0, avatar: 'https://i.pravatar.cc/150?u=emp5', phone: '11944443333' },
  { id: 'emp6', name: 'Sérgio Moro', role: EmployeeRole.WAITER, status: EmployeeStatus.ONLINE, performance: 80, shiftStart: '18:00', tasksCompleted: 20, avatar: 'https://i.pravatar.cc/150?u=emp6', phone: '11933332222' }
];

export const mockGoals: Goal[] = [
  { id: 'g1', title: 'Faturamento Mensal', target: 250000, current: 185000, unit: 'R$', category: 'store', description: 'Meta global de vendas brutas do mês.' },
  { id: 'g2', title: 'Tempo Médio KDS', target: 12, current: 14.5, unit: 'min', category: 'store', description: 'Tempo médio entre pedido e finalização na cozinha.' },
  { id: 'g3', title: 'Avaliação iFood', target: 4.8, current: 4.7, unit: '★', category: 'store', description: 'Média de avaliações dos clientes no delivery.' },
  { id: 'g4', title: 'Venda de Sobremesas', target: 15, current: 12, unit: '%', category: 'individual', description: 'Percentual de mesas que consomem sobremesa.' },
];

export const mockBonuses: BonusEntry[] = [
  { employeeId: 'emp1', employeeName: 'Takashi Mitsui', amount: 450.00, reason: 'Meta de Desperdício Zero atingida', status: 'released', date: '25/10/2023' },
  { employeeId: 'emp2', employeeName: 'Carla Oliveira', amount: 320.50, reason: 'Comissão sobre Vinhos e Saquês', status: 'pending', date: '28/10/2023' },
  { employeeId: 'emp3', employeeName: 'Kenji Sato', amount: 1200.00, reason: 'Bônus de Performance Loja (EBITDA)', status: 'pending', date: '28/10/2023' },
  { employeeId: 'emp4', employeeName: 'Bruno Lima', amount: 180.00, reason: 'Meta de Tempo de Entrega', status: 'released', date: '20/10/2023' },
];

// ─── CRM E USUÁRIOS ─────────────────────────────────────────────────────

export const mockUsers: User[] = [
  { id: 'u1', nome: 'Yuki Tanaka', email: 'yuki@email.com', telefone: '11999998888', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u2', nome: 'Sato Kenji', email: 'sato@email.com', telefone: '11988887777', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u3', nome: 'Akira Mori', email: 'akira@email.com', telefone: '11977776666', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u4', nome: 'Rin Takahashi', email: 'rin@email.com', telefone: '11966665555', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u5', nome: 'Hana Kim', email: 'hana@email.com', telefone: '11955554444', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'm1', nome: 'Takashi Mitsui', email: 'takashi@moto.com', telefone: '11988776655', tipo: 'motoboy', statusDisponibilidade: true, createdAt: new Date().toISOString() },
  { id: 'm2', nome: 'Carlos Oliveira', email: 'carlos@moto.com', telefone: '11977665544', tipo: 'motoboy', statusDisponibilidade: true, createdAt: new Date().toISOString() },
];

// ─── HISTÓRICO DE PEDIDOS (MUITO MAIOR) ───────────────────────────────────

export const mockOrders: Order[] = [
  {
    id: '4922', clienteId: 'u1', clienteNome: 'Yuki Tanaka',
    itens: [
      { productId: 's1', nome: '2x Salmon Nigiri', quantidade: 2, precoUnitario: 14.0 },
      { productId: 's5', nome: '1x Dragon Roll', quantidade: 1, precoUnitario: 58.0 },
      { productId: 'k4', nome: '1x Missoshiru', quantidade: 1, precoUnitario: 12.0 }
    ],
    valorItens: 98.0, taxaEntrega: 6.5, totalGeral: 104.5, createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    status: OrderStatus.PENDING, enderecoEntrega: { rua: 'Av. Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', lat: -23.5614, lng: -46.6565, observacoes: 'Bastante Shoyu.' },
    metodoPagamento: 'PIX', tempoEstimadoMinutos: 45
  },
  {
    id: '4923', clienteId: 'u2', clienteNome: 'Sato Kenji',
    itens: [
      { productId: 'p_poke_1', nome: '1x Poke Bowl', quantidade: 1, precoUnitario: 45.0 },
      { productId: 'b4', nome: '1x Chá Verde', quantidade: 1, precoUnitario: 12.0 }
    ],
    valorItens: 57.0, taxaEntrega: 5.0, totalGeral: 62.0, createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: OrderStatus.PAGO, enderecoEntrega: { rua: 'Rua Oscar Freire', numero: '585', bairro: 'Jardins', cidade: 'São Paulo', lat: -23.5654, lng: -46.6665 },
    metodoPagamento: 'Cartão de Crédito', tempoEstimadoMinutos: 30
  },
  {
    id: '4918', clienteId: 'u3', clienteNome: 'Akira Mori',
    itens: [
      { productId: 's2', nome: '4x Temaki Salmão', quantidade: 4, precoUnitario: 34.5 },
      { productId: 'k1', nome: '2x Gyoza', quantidade: 2, precoUnitario: 24.0 }
    ],
    valorItens: 186.0, taxaEntrega: 8.0, totalGeral: 194.0, createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: OrderStatus.EM_PREPARO, enderecoEntrega: { rua: 'Al. Santos', numero: '1000', bairro: 'Cerqueira César', cidade: 'São Paulo', lat: -23.5630, lng: -46.6540 },
    tempoEstimadoMinutos: 50
  },
  {
    id: '4912', clienteId: 'u4', clienteNome: 'Rin Takahashi', motoboyId: 'm1', motoboyNome: 'Takashi Mitsui',
    itens: [{ productId: 'combo_1', nome: 'Combo Premium (20p)', quantidade: 1, precoUnitario: 124.0 }],
    valorItens: 124.0, taxaEntrega: 7.5, totalGeral: 131.5, createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: OrderStatus.EM_ROTA, enderecoEntrega: { rua: 'Rua Augusta', numero: '2800', bairro: 'Jardins', cidade: 'São Paulo', lat: -23.5600, lng: -46.6600 },
    tempoEstimadoMinutos: 35
  },
  {
    id: '4899', clienteId: 'u5', clienteNome: 'Hana Kim', motoboyId: 'm2', motoboyNome: 'Carlos Oliveira',
    itens: [{ productId: 'k5', nome: 'Tempura de Camarão', quantidade: 1, precoUnitario: 54.0 }],
    valorItens: 54.0, taxaEntrega: 6.0, totalGeral: 60.0, createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: OrderStatus.ENTREGUE, enderecoEntrega: { rua: 'Rua da Consolação', numero: '1500', bairro: 'Consolação', cidade: 'São Paulo', lat: -23.5500, lng: -46.6550 },
    metodoPagamento: 'PIX', tempoEstimadoMinutos: 40
  },
  {
    id: '4925', clienteId: 'u1', clienteNome: 'Yuki Tanaka',
    itens: [{ productId: 's3', nome: '3x Uramaki Filadélfia', quantidade: 3, precoUnitario: 22.0 }],
    valorItens: 66.0, taxaEntrega: 5.0, totalGeral: 71.0, createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: OrderStatus.PENDING, enderecoEntrega: { rua: 'Rua Haddock Lobo', numero: '120', bairro: 'Cerqueira César', cidade: 'São Paulo', lat: -23.5580, lng: -46.6620 },
    metodoPagamento: 'Dinheiro', tempoEstimadoMinutos: 25
  }
];

export const mockTracking: DeliveryTracking[] = [
  { id: 'trk1', pedidoId: '4912', lat: -23.5610, lng: -46.6580, ultimaAtualizacao: new Date().toISOString() }
];

export const mockWalletTransactions: WalletTransaction[] = [
  { id: 'w1', usuarioId: 'm1', pedidoId: '4912', valor: 7.5, tipo: 'credito_entrega', dataTransacao: new Date().toISOString() },
  { id: 'w2', usuarioId: 'm2', pedidoId: '4899', valor: 6.0, tipo: 'credito_entrega', dataTransacao: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'w3', usuarioId: 'admin_1', pedidoId: '4922', valor: 104.5, tipo: 'venda_restaurante', dataTransacao: new Date().toISOString() }
];

// ─── MESAS E INFRAESTRUTURA ─────────────────────────────────────────────

export const mockTables: Table[] = [
  { id: '01', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '45 min', currentTotal: 145.00 },
  { id: '02', status: TableStatus.FREE, capacity: 2 },
  { id: '03', status: TableStatus.RESERVED, capacity: 6, timeActive: '19:45' },
  { id: '04', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '15 min', currentTotal: 88.00 },
  { id: '05', status: TableStatus.FREE, capacity: 2 },
  { id: '06', status: TableStatus.CLEANING, capacity: 4, timeActive: '04:52' },
  { id: '07', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '54 min', currentTotal: 210.00 },
  { id: '08', status: TableStatus.CLEANING, capacity: 4, timeActive: '08:12' },
  { id: '09', status: TableStatus.FREE, capacity: 4 },
  { id: '10', status: TableStatus.FREE, capacity: 2 },
  { id: 'VIP 1', status: TableStatus.FREE, capacity: 10 },
  { id: 'VIP 2', status: TableStatus.OCCUPIED, capacity: 8, timeActive: '120 min', currentTotal: 850.00 },
];

export const mockPrinters: Printer[] = [
  { id: 'p1', name: 'Termômetro Cozinha Quente', ip: '192.168.1.50', status: 'online', location: 'Cozinha Central', paperLevel: 85 },
  { id: 'p2', name: 'Sushibar 1 (Nigiri/Temaki)', ip: '192.168.1.51', status: 'online', location: 'Balcão Sushi', paperLevel: 12 },
  { id: 'p3', name: 'Bar Central (Bebidas)', ip: '192.168.1.52', status: 'online', location: 'Bar', paperLevel: 94 },
  { id: 'p4', name: 'Caixa / Checkout', ip: '192.168.1.53', status: 'offline', location: 'Recepção', paperLevel: 0 },
];

export const initialRoutes: PrintRoute[] = [
  { category: 'Sake', printerId: 'p3' },
  { category: 'Drinks', printerId: 'p3' },
  { category: 'Nigiri', printerId: 'p2' },
  { category: 'Uramaki', printerId: 'p2' },
  { category: 'Temaki', printerId: 'p2' },
  { category: 'Pratos Quentes', printerId: 'p1' },
  { category: 'Fritos', printerId: 'p1' },
];

export const mockTransactions: Transaction[] = [
  { id: 'T101', type: 'IN', method: PaymentMethod.PIX, amount: 245.50, description: 'Mesa 05 - Fechamento', time: '19:42', user: 'Admin' },
  { id: 'T102', type: 'IN', method: PaymentMethod.CREDIT, amount: 188.00, description: 'Mesa 02 - Fechamento', time: '19:45', user: 'Admin' },
  { id: 'T103', type: 'OUT', method: 'SANGRIA', amount: 50.00, description: 'Sangria - Troco Moedas', time: '20:10', user: 'Admin' },
  { id: 'T104', type: 'IN', method: PaymentMethod.CASH, amount: 450.00, description: 'Mesa VIP 1 - Fechamento', time: '20:30', user: 'Admin' },
  { id: 'T105', type: 'IN', method: PaymentMethod.DEBIT, amount: 92.20, description: 'Pedido Delivery #4920', time: '20:45', user: 'Admin' },
  { id: 'T106', type: 'OUT', method: 'SANGRIA', amount: 120.00, description: 'Pagamento Motoboy Extra', time: '21:00', user: 'Admin' },
];

// ─── ✨ CMV E ESTOQUE PROFISSIONAL EXPANDIDO (60+ ITENS) ────────────────

export const mockIngredients: ExtendedIngredient[] = [
  // 🐟 PROTEÍNAS (PEIXES)
  { id: 'ing_salmao', name: 'Salmão Fresco Chileno (Kg)', unit: 'kg', costPerUnit: 78.00, stock: 4.5, minStock: 25.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_atum', name: 'Atum Maguro A+ (Kg)', unit: 'kg', costPerUnit: 95.00, stock: 3.2, minStock: 10.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_tilapia', name: 'Tilápia Saint Peter (Kg)', unit: 'kg', costPerUnit: 34.00, stock: 12.0, minStock: 15.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_camarao_rosa', name: 'Camarão Rosa G (Kg)', unit: 'kg', costPerUnit: 82.00, stock: 5.0, minStock: 12.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_kani', name: 'Kani-Kama Premium (un)', unit: 'un', costPerUnit: 1.15, stock: 50, minStock: 100, category: 'peixes', supplierIds: [] },
  { id: 'ing_polvo', name: 'Polvo Inteiro (Kg)', unit: 'kg', costPerUnit: 110.00, stock: 2.0, minStock: 5.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_lula', name: 'Anéis de Lula (Kg)', unit: 'kg', costPerUnit: 55.00, stock: 4.0, minStock: 8.0, category: 'peixes', supplierIds: [] },
  { id: 'ing_prego', name: 'Peixe Prego (Kg)', unit: 'kg', costPerUnit: 48.00, stock: 3.0, minStock: 5.0, category: 'peixes', supplierIds: [] },

  // 🍚 GRÃOS, SECOS E MERCEARIA
  { id: 'ing_arroz', name: 'Arroz Japonês (Shari) 5kg', unit: 'kg', costPerUnit: 12.80, stock: 45, minStock: 100, category: 'mercearia', supplierIds: [] },
  { id: 'ing_nori', name: 'Alga Nori Gold (Pct 50fl)', unit: 'pct', costPerUnit: 38.00, stock: 12, minStock: 30, category: 'mercearia', supplierIds: [] },
  { id: 'ing_panko', name: 'Farinha Panko (Kg)', unit: 'kg', costPerUnit: 28.50, stock: 8, minStock: 15, category: 'mercearia', supplierIds: [] },
  { id: 'ing_shoyu_galao', name: 'Shoyu Tradicional (L)', unit: 'L', costPerUnit: 16.00, stock: 20, minStock: 50, category: 'mercearia', supplierIds: [] },
  { id: 'ing_wasabi_po', name: 'Wasabi em Pó (Kg)', unit: 'kg', costPerUnit: 88.00, stock: 0.8, minStock: 2.0, category: 'mercearia', supplierIds: [] },
  { id: 'ing_cream_cheese', name: 'Cream Cheese Bisnaga (Kg)', unit: 'kg', costPerUnit: 36.00, stock: 6.0, minStock: 30, category: 'mercearia', supplierIds: [] },
  { id: 'ing_vinagre_arroz', name: 'Vinagre de Arroz (L)', unit: 'L', costPerUnit: 9.80, stock: 15, minStock: 20, category: 'mercearia', supplierIds: [] },
  { id: 'ing_mirin', name: 'Sake Mirin (L)', unit: 'L', costPerUnit: 24.00, stock: 4, minStock: 6, category: 'mercearia', supplierIds: [] },
  { id: 'ing_hondashi', name: 'Tempero Hondashi (Kg)', unit: 'kg', costPerUnit: 72.00, stock: 1.2, minStock: 2.0, category: 'mercearia', supplierIds: [] },
  { id: 'ing_gergelim_misto', name: 'Gergelim Misto (Kg)', unit: 'kg', costPerUnit: 29.00, stock: 2.5, minStock: 4.0, category: 'mercearia', supplierIds: [] },

  // 🥬 HORTIFRUTI (FRESCOS)
  { id: 'ing_pepino', name: 'Pepino Japonês (Kg)', unit: 'kg', costPerUnit: 6.80, stock: 15, minStock: 20, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_cebolinha', name: 'Cebolinha Maço', unit: 'un', costPerUnit: 2.80, stock: 18, minStock: 30, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_shimeji', name: 'Shimeji Preto (Kg)', unit: 'kg', costPerUnit: 42.00, stock: 3.0, minStock: 10, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_shitake', name: 'Shitake Fresco (Kg)', unit: 'kg', costPerUnit: 58.00, stock: 1.5, minStock: 4.0, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_manga', name: 'Manga Palmer (Kg)', unit: 'kg', costPerUnit: 8.50, stock: 10, minStock: 12, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_abacate', name: 'Abacate Hass (Kg)', unit: 'kg', costPerUnit: 14.00, stock: 4.0, minStock: 8.0, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_gengibre_fresco', name: 'Gengibre em Raiz (Kg)', unit: 'kg', costPerUnit: 12.00, stock: 2.0, minStock: 3.0, category: 'hortifruti', supplierIds: [] },
  { id: 'ing_limao_taiti', name: 'Limão Taiti (Kg)', unit: 'kg', costPerUnit: 5.50, stock: 15, minStock: 10, category: 'hortifruti', supplierIds: [] },

  // 🥢 EMBALAGENS E DESCARTÁVEIS
  { id: 'ing_hashi', name: 'Hashi Madeira (Par)', unit: 'un', costPerUnit: 0.18, stock: 800, minStock: 1500, category: 'embalagens', supplierIds: [] },
  { id: 'ing_delivery_box_m', name: 'Embalagem Combinado M', unit: 'un', costPerUnit: 1.95, stock: 150, minStock: 400, category: 'embalagens', supplierIds: [] },
  { id: 'ing_delivery_box_g', name: 'Embalagem Combinado G', unit: 'un', costPerUnit: 2.40, stock: 90, minStock: 200, category: 'embalagens', supplierIds: [] },
  { id: 'ing_copinho_molho', name: 'Copo Shoyu 30ml', unit: 'un', costPerUnit: 0.10, stock: 1200, minStock: 1000, category: 'embalagens', supplierIds: [] },
  { id: 'ing_sacola_kraft', name: 'Sacola Kraft Delivery', unit: 'un', costPerUnit: 0.85, stock: 300, minStock: 500, category: 'embalagens', supplierIds: [] },
  { id: 'ing_papel_toalha', name: 'Papel Toalha Cozinha', unit: 'un', costPerUnit: 4.50, stock: 24, minStock: 12, category: 'outros', supplierIds: [] },

  // 🍶 BEBIDAS
  { id: 'ing_cerveja_kirin', name: 'Cerveja Kirin 355ml', unit: 'un', costPerUnit: 9.80, stock: 48, minStock: 72, category: 'bebidas', supplierIds: [] },
  { id: 'ing_refrigerante_lata', name: 'Coca-Cola Lata', unit: 'un', costPerUnit: 3.20, stock: 120, minStock: 144, category: 'bebidas', supplierIds: [] },
  { id: 'ing_saque_dourado', name: 'Sake Azuma Dourado', unit: 'un', costPerUnit: 45.00, stock: 12, minStock: 6, category: 'bebidas', supplierIds: [] },
  { id: 'ing_agua_sem_gas', name: 'Água Mineral 500ml', unit: 'un', costPerUnit: 1.50, stock: 60, minStock: 48, category: 'bebidas', supplierIds: [] },
];

// ─── FICHAS TÉCNICAS (RECIPES) ──────────────────────────────────────────

export const mockRecipes: Recipe[] = [
  {
    menuItemId: 's1', // Nigiri Salmão
    yield: 2, prepTime: 4,
    items: [
      { ingredientId: 'ing_salmao', quantity: 0.05 }, // 50g
      { ingredientId: 'ing_arroz', quantity: 0.03 },  // 30g
      { ingredientId: 'ing_wasabi_po', quantity: 0.001 } // 1g
    ]
  },
  {
    menuItemId: 's2', // Temaki Ebi Ten
    yield: 1, prepTime: 6,
    items: [
      { ingredientId: 'ing_camarao_rosa', quantity: 0.06 },
      { ingredientId: 'ing_arroz', quantity: 0.05 },
      { ingredientId: 'ing_nori', quantity: 0.5 }, // Meia folha
      { ingredientId: 'ing_cream_cheese', quantity: 0.02 },
      { ingredientId: 'ing_cebolinha', quantity: 0.005 }
    ]
  },
  {
    menuItemId: 's3', // Uramaki Filadélfia
    yield: 1, // 1 porção de 8 peças
    items: [
      { ingredientId: 'ing_salmao', quantity: 0.08 },
      { ingredientId: 'ing_arroz', quantity: 0.09 },
      { ingredientId: 'ing_nori', quantity: 0.5 },
      { ingredientId: 'ing_cream_cheese', quantity: 0.04 },
      { ingredientId: 'ing_gergelim_misto', quantity: 0.003 }
    ]
  },
  {
    menuItemId: 'k4', // Missoshiru
    yield: 1,
    items: [
      { ingredientId: 'ing_shoyu_galao', quantity: 0.02 },
      { ingredientId: 'ing_hondashi', quantity: 0.005 },
      { ingredientId: 'ing_cebolinha', quantity: 0.005 }
    ]
  },
  {
    menuItemId: 'k2', // Shimeji na Manteiga
    yield: 1,
    items: [
      { ingredientId: 'ing_shimeji', quantity: 0.20 }, // 200g
      { ingredientId: 'ing_shoyu_galao', quantity: 0.015 },
      { ingredientId: 'ing_cebolinha', quantity: 0.01 }
    ]
  }
];

// ─── CARDÁPIO (MENU ITEMS) ──────────────────────────────────────────────

export const sushiMenu: MenuItem[] = [
  { id: 's1', name: 'Nigiri Salmão', category: 'Nigiri', price: 28.00, description: '2 unidades de nigiri com salmão fresco chileno.', available: true, image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?q=80&w=400', bestSeller: true },
  { id: 's2', name: 'Temaki Ebi Ten', category: 'Temaki', price: 34.50, description: 'Camarão empanado, cream cheese e cebolinha.', available: true, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=400' },
  { id: 's3', name: 'Uramaki Filadélfia', category: 'Uramaki', price: 22.00, description: '8 unidades de uramaki com salmão e cream cheese.', available: true, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400', bestSeller: true },
  { id: 's4', name: 'Sashimi Maguro', category: 'Sashimi', price: 42.00, description: '5 fatias de atum Maguro fresco.', available: true, image: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db76?q=80&w=400' },
  { id: 's5', name: 'Dragon Roll Premium', category: 'Especiais', price: 58.00, description: 'Uramaki de camarão com cobertura de abacate.', available: true, image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?q=80&w=400', spicy: true },
  { id: 's6', name: 'Joe Salmão', category: 'Especiais', price: 32.00, description: '4 unidades de joe com cream cheese e geleia de pimenta.', available: true, image: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?q=80&w=400' }
];

export const kitchenMenu: MenuItem[] = [
  { id: 'k1', name: 'Gyoza de Lombo', category: 'Entradas', price: 24.00, description: '5 unidades grelhadas.', available: true, image: 'https://images.unsplash.com/photo-1541696490-8744a5db0228?q=80&w=400' },
  { id: 'k2', name: 'Shimeji na Manteiga', category: 'Entradas', price: 32.00, description: '200g de shimeji refogado.', available: true, image: 'https://images.unsplash.com/photo-1615485240384-552e40019c41?q=80&w=400' },
  { id: 'k3', name: 'Yakisoba de Carne', category: 'Pratos Quentes', price: 48.00, description: 'Macarrão com legumes e carne bovina.', available: true, image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?q=80&w=400' },
  { id: 'k4', name: 'Missoshiru', category: 'Sopas', price: 12.00, description: 'Sopa tradicional de soja.', available: true, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=400', vegan: true },
  { id: 'k5', name: 'Tempura de Camarão', category: 'Fritos', price: 54.00, description: '6 unidades crocantes.', available: true, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=400' },
];

export const barMenu: MenuItem[] = [
  { id: 'b1', name: 'Sake Hakushika', category: 'Sake', price: 45.00, description: 'Dose 150ml.', available: true, image: 'https://images.unsplash.com/photo-1603539945037-4d99c438be5a?q=80&w=400' },
  { id: 'b2', name: 'Moscow Mule Wasabi', category: 'Drinks', price: 32.00, description: 'Vodka com toque de wasabi.', available: true, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=400' },
  { id: 'b4', name: 'Chá Verde Gelado', category: 'Soft Drinks', price: 12.00, description: 'Infusão gelada.', available: true, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=400', vegan: true },
  { id: 'b5', name: 'Cerveja Kirin', category: 'Cervejas', price: 18.00, description: 'Puro malte japonesa.', available: true, image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?q=80&w=400' },
];

// ─── ANÁLISES E HISTÓRICO (DADOS TÉCNICOS) ─────────────────────────────

export const consumptionHistory = [
  { day: 'Seg', salmao: 12, arroz: 15, nori: 40 },
  { day: 'Ter', salmao: 15, arroz: 18, nori: 45 },
  { day: 'Qua', salmao: 14, arroz: 16, nori: 42 },
  { day: 'Qui', salmao: 22, arroz: 25, nori: 65 },
  { day: 'Sex', salmao: 35, arroz: 40, nori: 90 },
  { day: 'Sáb', salmao: 42, arroz: 48, nori: 110 },
  { day: 'Dom', salmao: 38, arroz: 42, nori: 95 },
];

export const forecastingData = [
  { item: 'Salmão Fresh', consumo30d: 840, mediaDiaria: 28, projecao30d: 920, estoqueAtual: 4.5, unidade: 'kg' },
  { item: 'Arroz Shari', consumo30d: 600, mediaDiaria: 20, projecao30d: 650, estoqueAtual: 45, unidade: 'kg' },
  { item: 'Nori Gold', consumo30d: 1800, mediaDiaria: 60, projecao30d: 2100, estoqueAtual: 12, unidade: 'pct' },
  { item: 'Shoyu Premium', consumo30d: 120, mediaDiaria: 4, projecao30d: 135, estoqueAtual: 20, unidade: 'L' },
];

export const cmvCategoryData = [
  { name: 'Peixes/Proteínas', value: 48, color: '#e66337' },
  { name: 'Grãos/Arroz', value: 12, color: '#06b6d4' },
  { name: 'Bebidas', value: 20, color: '#10b981' },
  { name: 'Embalagens', value: 8, color: '#f59e0b' },
  { name: 'Outros', value: 12, color: '#6366f1' },
];