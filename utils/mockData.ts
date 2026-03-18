
import { Order, OrderStatus, Table, TableStatus, Printer, PrintRoute, Transaction, PaymentMethod, Employee, EmployeeRole, EmployeeStatus, Goal, BonusEntry, Reservation, ReservationStatus, WaitingEntry, MenuItem, User, UserRole, DeliveryTracking, WalletTransaction } from '../types';

export const mockReservations: Reservation[] = [
  { id: 'R1', customer: 'Fernanda Lima', phone: '11988884444', people: 4, time: '20:00', date: 'Hoje', status: ReservationStatus.CONFIRMED, tablePreference: 'Janela' },
  { id: 'R2', customer: 'Roberto Shinyashiki', phone: '11977773333', people: 2, time: '20:30', date: 'Hoje', status: ReservationStatus.PENDING, notes: 'Anivers\u00e1rio de Casamento' },
  { id: 'R3', customer: 'Juliana Paes', phone: '11966662222', people: 6, time: '21:00', date: 'Hoje', status: ReservationStatus.CONFIRMED, tablePreference: 'Tatame' },
  { id: 'R4', customer: 'Marcos Mion', phone: '11955551111', people: 3, time: '19:30', date: 'Amanh\u00e3', status: ReservationStatus.CONFIRMED }
];

export const mockWaitingList: WaitingEntry[] = [
  { id: 'W1', customer: 'Bruno Gagliasso', phone: '11911112222', people: 2, startTime: Date.now() - 1000 * 60 * 25, needsHighChair: false, notified: true },
  { id: 'W2', customer: 'Grazi Massafera', phone: '11922223333', people: 4, startTime: Date.now() - 1000 * 60 * 12, needsHighChair: true, notified: false },
  { id: 'W3', customer: 'L\u00e1zaro Ramos', phone: '11933334444', people: 5, startTime: Date.now() - 1000 * 60 * 5, needsHighChair: false, notified: false }
];

export const mockEmployees: Employee[] = [
  {
    id: 'emp1',
    name: 'Takashi Mitsui',
    role: EmployeeRole.SUSHIMAN,
    status: EmployeeStatus.ONLINE,
    performance: 92,
    shiftStart: '17:00',
    tasksCompleted: 45,
    avatar: 'https://i.pravatar.cc/150?u=emp1',
    phone: '11988887777'
  },
  {
    id: 'emp2',
    name: 'Carla Oliveira',
    role: EmployeeRole.WAITER,
    status: EmployeeStatus.ONLINE,
    performance: 85,
    shiftStart: '18:30',
    tasksCompleted: 28,
    avatar: 'https://i.pravatar.cc/150?u=emp2',
    phone: '11977776666'
  },
  {
    id: 'emp3',
    name: 'Kenji Sato',
    role: EmployeeRole.MANAGER,
    status: EmployeeStatus.ONLINE,
    performance: 98,
    shiftStart: '16:00',
    tasksCompleted: 12,
    avatar: 'https://i.pravatar.cc/150?u=emp3',
    phone: '11966665555'
  },
  {
    id: 'emp4',
    name: 'Bruno Lima',
    role: EmployeeRole.DELIVERY,
    status: EmployeeStatus.BREAK,
    performance: 70,
    shiftStart: '19:00',
    tasksCompleted: 15,
    avatar: 'https://i.pravatar.cc/150?u=emp4',
    phone: '11955554444'
  },
  {
    id: 'emp5',
    name: 'Ana Silva',
    role: EmployeeRole.HOSTESS,
    status: EmployeeStatus.OFFLINE,
    performance: 0,
    shiftStart: '-',
    tasksCompleted: 0,
    avatar: 'https://i.pravatar.cc/150?u=emp5',
    phone: '11944443333'
  }
];

export const mockGoals: Goal[] = [
  { id: 'g1', title: 'Faturamento Mensal', target: 250000, current: 185000, unit: 'R$', category: 'store', description: 'Meta global de vendas brutas do m\u00eas.' },
  { id: 'g2', title: 'Tempo M\u00e9dio KDS', target: 12, current: 14.5, unit: 'min', category: 'store', description: 'Tempo m\u00e9dio entre pedido e finaliza\u00e7\u00e3o na cozinha.' },
  { id: 'g3', title: 'Avalia\u00e7\u00e3o iFood', target: 4.8, current: 4.7, unit: '\u2605', category: 'store', description: 'M\u00e9dia de avalia\u00e7\u00f5es dos clientes no delivery.' },
  { id: 'g4', title: 'Venda de Sobremesas', target: 15, current: 12, unit: '%', category: 'individual', description: 'Percentual de mesas que consomem sobremesa.' },
];

export const mockBonuses: BonusEntry[] = [
  { employeeId: 'emp1', employeeName: 'Takashi Mitsui', amount: 450.00, reason: 'Meta de Desperd\u00edcio Zero atingida', status: 'released', date: '25/10/2023' },
  { employeeId: 'emp2', employeeName: 'Carla Oliveira', amount: 320.50, reason: 'Comiss\u00e3o sobre Vinhos e Saq\u00eas', status: 'pending', date: '28/10/2023' },
  { employeeId: 'emp3', employeeName: 'Kenji Sato', amount: 1200.00, reason: 'B\u00f4nus de Performance Loja (EBITDA)', status: 'pending', date: '28/10/2023' },
  { employeeId: 'emp4', employeeName: 'Bruno Lima', amount: 180.00, reason: 'Meta de Tempo de Entrega', status: 'released', date: '20/10/2023' },
];

export const mockUsers: User[] = [
  { id: 'u1', nome: 'Yuki Tanaka', email: 'yuki@email.com', telefone: '11999998888', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u2', nome: 'Sato Kenji', email: 'sato@email.com', telefone: '11988887777', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u3', nome: 'Akira Mori', email: 'akira@email.com', telefone: '11977776666', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u4', nome: 'Rin Takahashi', email: 'rin@email.com', telefone: '11966665555', tipo: 'cliente', createdAt: new Date().toISOString() },
  { id: 'u5', nome: 'Hana Kim', email: 'hana@email.com', telefone: '11955554444', tipo: 'cliente', createdAt: new Date().toISOString() },
  
  { id: 'm1', nome: 'Takashi Mitsui', email: 'takashi@moto.com', telefone: '11988776655', tipo: 'motoboy', statusDisponibilidade: true, createdAt: new Date().toISOString() },
  { id: 'm2', nome: 'Carlos Oliveira', email: 'carlos@moto.com', telefone: '11977665544', tipo: 'motoboy', statusDisponibilidade: true, createdAt: new Date().toISOString() },
];

export const mockOrders: Order[] = [
  {
    id: '4922',
    clienteId: 'u1',
    clienteNome: 'Yuki Tanaka',
    itens: [
      { productId: 's1', nome: '2x Salmon Nigiri', quantidade: 2, precoUnitario: 14.0 },
      { productId: 's5', nome: '1x Dragon Roll', quantidade: 1, precoUnitario: 58.0 },
      { productId: 'k4', nome: '1x Missoshiru', quantidade: 1, precoUnitario: 12.0 }
    ],
    valorItens: 98.0,
    taxaEntrega: 6.5,
    totalGeral: 104.5,
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    status: OrderStatus.PENDING,
    enderecoEntrega: {
      rua: 'Av. Paulista',
      numero: '1578',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      lat: -23.5614,
      lng: -46.6565,
      observacoes: 'Retirar o wasabi do Dragon Roll. Favor enviar hashis descartáveis e bastante shoyu.'
    },
    metodoPagamento: 'PIX',
    tempoEstimadoMinutos: 45
  },
  {
    id: '4923',
    clienteId: 'u2',
    clienteNome: 'Sato Kenji',
    itens: [
      { productId: 'p_poke_1', nome: '1x Poke Bowl (Grande)', quantidade: 1, precoUnitario: 45.0 },
      { productId: 'b4', nome: '1x Chá Verde', quantidade: 1, precoUnitario: 12.0 }
    ],
    valorItens: 57.0,
    taxaEntrega: 5.0,
    totalGeral: 62.0,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: OrderStatus.PAGO,
    enderecoEntrega: {
      rua: 'Rua Oscar Freire',
      numero: '585',
      bairro: 'Jardins',
      cidade: 'São Paulo',
      lat: -23.5654,
      lng: -46.6665,
      observacoes: 'Sem cebola no poke.'
    },
    metodoPagamento: 'Cartão de Crédito',
    tempoEstimadoMinutos: 30
  },
  {
    id: '4918',
    clienteId: 'u3',
    clienteNome: 'Akira Mori',
    itens: [
      { productId: 's2', nome: '4x Temaki Salmão', quantidade: 4, precoUnitario: 34.5 },
      { productId: 'k1', nome: '2x Gyoza', quantidade: 2, precoUnitario: 24.0 }
    ],
    valorItens: 186.0,
    taxaEntrega: 8.0,
    totalGeral: 194.0,
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: OrderStatus.EM_PREPARO,
    enderecoEntrega: {
      rua: 'Al. Santos',
      numero: '1000',
      bairro: 'Cerqueira César',
      cidade: 'São Paulo',
      lat: -23.5630,
      lng: -46.6540,
      observacoes: 'Gyoza bem tostadinho, por favor.'
    },
    tempoEstimadoMinutos: 50
  },
  {
    id: '4912',
    clienteId: 'u4',
    clienteNome: 'Rin Takahashi',
    motoboyId: 'm1',
    motoboyNome: 'Takashi Mitsui',
    itens: [
      { productId: 'combo_1', nome: 'Combo Premium (20p)', quantidade: 1, precoUnitario: 124.0 }
    ],
    valorItens: 124.0,
    taxaEntrega: 7.5,
    totalGeral: 131.5,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: OrderStatus.EM_ROTA,
    enderecoEntrega: {
      rua: 'Rua Augusta',
      numero: '2800',
      bairro: 'Jardins',
      cidade: 'São Paulo',
      lat: -23.5600,
      lng: -46.6600,
      observacoes: 'Endereço comercial, deixar na recepção com o segurança Jorge.'
    },
    tempoEstimadoMinutos: 35
  },
  {
    id: '4899',
    clienteId: 'u5',
    clienteNome: 'Hana Kim',
    motoboyId: 'm2',
    motoboyNome: 'Carlos Oliveira',
    itens: [
      { productId: 'k5', nome: 'Tempura de Camarão', quantidade: 1, precoUnitario: 54.0 }
    ],
    valorItens: 54.0,
    taxaEntrega: 6.0,
    totalGeral: 60.0,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: OrderStatus.ENTREGUE,
    enderecoEntrega: {
      rua: 'Rua da Consolação',
      numero: '1500',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      lat: -23.5500,
      lng: -46.6550
    },
    metodoPagamento: 'PIX',
    tempoEstimadoMinutos: 40
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

export const mockTables: Table[] = [
  { id: '01', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '45 min', currentTotal: 145.00 },
  { id: '02', status: TableStatus.FREE, capacity: 2 },
  { id: '03', status: TableStatus.RESERVED, capacity: 6, timeActive: '19:45' },
  { id: '04', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '15 min', currentTotal: 88.00 },
  { id: '05', status: TableStatus.FREE, capacity: 2 },
  { id: '06', status: TableStatus.CLEANING, capacity: 4, timeActive: '04:52' },
  { id: '07', status: TableStatus.OCCUPIED, capacity: 4, timeActive: '54 min', currentTotal: 210.00 },
  { id: '08', status: TableStatus.CLEANING, capacity: 4, timeActive: '08:12' },
  { id: 'VIP 1', status: TableStatus.FREE, capacity: 10 },
];

export const consumptionHistory = [
  { day: 'Seg', salmao: 12, arroz: 15, nori: 40 },
  { day: 'Ter', salmao: 15, arroz: 18, nori: 45 },
  { day: 'Qua', salmao: 14, arroz: 16, nori: 42 },
  { day: 'Qui', salmao: 22, arroz: 25, nori: 65 },
  { day: 'Sex', salmao: 35, arroz: 40, nori: 90 },
  { day: 'S\u00e1b', salmao: 42, arroz: 48, nori: 110 },
  { day: 'Dom', salmao: 38, arroz: 42, nori: 95 },
];

export const forecastingData = [
  { item: 'Salm\u00e3o Fresh', consumo30d: 840, mediaDiaria: 28, projecao30d: 920, estoqueAtual: 12, unidade: 'kg' },
  { item: 'Arroz Shari', consumo30d: 600, mediaDiaria: 20, projecao30d: 650, estoqueAtual: 45, unidade: 'kg' },
  { item: 'Nori Gold', consumo30d: 1800, mediaDiaria: 60, projecao30d: 2100, estoqueAtual: 180, unidade: 'un' },
  { item: 'Shoyu Premium', consumo30d: 120, mediaDiaria: 4, projecao30d: 135, estoqueAtual: 22, unidade: 'L' },
];

export const cmvCategoryData = [
  { name: 'Peixes/Prote\u00ednas', value: 48, color: '#e66337' },
  { name: 'Gr\u00e3os/Arroz', value: 12, color: '#06b6d4' },
  { name: 'Bebidas', value: 20, color: '#10b981' },
  { name: 'Embalagens', value: 8, color: '#f59e0b' },
  { name: 'Outros', value: 12, color: '#6366f1' },
];


export const sushiMenu: MenuItem[] = [
  { id: 's1', name: 'Nigiri Salm\u00e3o Trufado', category: 'Nigiri', price: 28.00, description: '2 unidades de nigiri com azeite de trufas e flor de sal.', available: true, image: 'https://images.unsplash.com/photo-1617196034183-421b4917c92d?q=80&w=400&auto=format&fit=crop', glutenFree: true, bestSeller: true },
  { id: 's2', name: 'Temaki Ebi Ten', category: 'Temaki', price: 34.50, description: 'Cone de alga com camar\u00e3o empanado, cream cheese e cebolinha.', available: true, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=400&auto=format&fit=crop' },
  { id: 's3', name: 'Uramaki Filad\u00e9lfia', category: 'Uramaki', price: 22.00, description: '8 unidades com salm\u00e3o, cream cheese e gergelim.', available: true, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400&auto=format&fit=crop', bestSeller: true },
  { id: 's4', name: 'Sashimi Maguro', category: 'Sashimi', price: 42.00, description: '5 fatias de atum fresco selecionado.', available: false, image: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db76?q=80&w=400&auto=format&fit=crop', glutenFree: true },
  { id: 's5', name: 'Dragon Roll Premium', category: 'Especiais', price: 58.00, description: 'Uramaki de camar\u00e3o com cobertura de abacate e ovas.', available: true, image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?q=80&w=400&auto=format&fit=crop', spicy: true },
];

export const barMenu: MenuItem[] = [
  { id: 'b1', name: 'Sake Hakushika', category: 'Sake', price: 45.00, description: 'Dose de sake japon\u00eas seco de alta qualidade.', available: true, image: 'https://images.unsplash.com/photo-1603539945037-4d99c438be5a?q=80&w=400&auto=format&fit=crop', vegan: true },
  { id: 'b2', name: 'Moscow Mule Wasabi', category: 'Drinks', price: 32.00, description: 'Vodka, lim\u00e3o, ginger beer e toque de wasabi.', available: true, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=400&auto=format&fit=crop', spicy: true },
  { id: 'b3', name: 'Gin Tonic Yuzu', category: 'Drinks', price: 38.00, description: 'Gin premium com t\u00f4nica e xarope de yuzu.', available: true, image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=400&auto=format&fit=crop' },
  { id: 'b4', name: 'Ch\u00e1 Verde Gelado', category: 'Soft Drinks', price: 12.00, description: 'Infus\u00e3o gelada de ch\u00e1 verde japon\u00eas.', available: true, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=400&auto=format&fit=crop', vegan: true },
  { id: 'b5', name: 'Cerveja Kirin Ichiban', category: 'Cervejas', price: 18.00, description: 'Cerveja puro malte japonesa 355ml.', available: true, image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?q=80&w=400&auto=format&fit=crop', vegan: true },
];

export const kitchenMenu: MenuItem[] = [
  { id: 'k1', name: 'Gyoza de Lombo', category: 'Entradas', price: 24.00, description: '5 unidades de past\u00e9is japoneses grelhados com recheio de porco.', available: true, image: 'https://images.unsplash.com/photo-1541696490-8744a5db0228?q=80&w=400&auto=format&fit=crop' },
  { id: 'k2', name: 'Shimeji na Manteiga', category: 'Entradas', price: 32.00, description: 'Cogumelos shimeji refogados na manteiga e shoyu.', available: true, image: 'https://images.unsplash.com/photo-1615485240384-552e40019c41?q=80&w=400&auto=format&fit=crop', vegan: true },
  { id: 'k3', name: 'Yakisoba de Carne', category: 'Pratos Quentes', price: 48.00, description: 'Macarr\u00e3o frito com legumes e tiras de carne ao molho especial.', available: true, image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?q=80&w=400&auto=format&fit=crop' },
  { id: 'k4', name: 'Missoshiru', category: 'Sopas', price: 12.00, description: 'Sopa tradicional de pasta de soja com tofu e cebolinha.', available: true, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=400&auto=format&fit=crop', vegan: true },
  { id: 'k5', name: 'Tempura de Camar\u00e3o', category: 'Fritos', price: 54.00, description: '6 unidades de camar\u00f5es empanados em massa leve e crocante.', available: true, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=400&auto=format&fit=crop' },
];

export const mockPrinters: Printer[] = [
  { id: 'p1', name: 'Term\u00f4metro Cozinha Quente', ip: '192.168.1.50', status: 'online', location: 'Cozinha Central', paperLevel: 85 },
  { id: 'p2', name: 'Sushibar 1 (Nigiri/Temaki)', ip: '192.168.1.51', status: 'online', location: 'Balc\u00e3o Sushi', paperLevel: 12 },
  { id: 'p3', name: 'Bar Central (Bebidas)', ip: '192.168.1.52', status: 'online', location: 'Bar', paperLevel: 94 },
  { id: 'p4', name: 'Caixa / Checkout', ip: '192.168.1.53', status: 'offline', location: 'Recep\u00e7\u00e3o', paperLevel: 0 },
];

export const initialRoutes: PrintRoute[] = [
  { category: 'Sake', printerId: 'p3' },
  { category: 'Drinks', printerId: 'p3' },
  { category: 'Nigiri', printerId: 'p2' },
  { category: 'Uramaki', printerId: 'p2' },
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

// ─── CMV: Insumos e Fichas Técnicas ─────────────────────────────────────────
import { Ingredient, Recipe } from '../types';

export const mockIngredients: Ingredient[] = [
  { id: 'ing01', name: 'Salmão Fresco (Kg)', unit: 'kg', costPerUnit: 75.00, stock: 8.5, minStock: 5.0, category: 'proteina' },
  { id: 'ing02', name: 'Atum Fresco (Kg)', unit: 'kg', costPerUnit: 95.00, stock: 3.2, minStock: 2.5, category: 'proteina' },
  { id: 'ing03', name: 'Camarão (Kg)', unit: 'kg', costPerUnit: 48.00, stock: 5.0, minStock: 3.0, category: 'proteina' },
  { id: 'ing04', name: 'Arroz para Sushi (Kg)', unit: 'kg', costPerUnit: 12.00, stock: 25.0, minStock: 15.0, category: 'carboidrato' },
  { id: 'ing05', name: 'Alga Nori (Pacote 10un)', unit: 'cx', costPerUnit: 18.00, stock: 12, minStock: 15, category: 'carboidrato' },
  { id: 'ing06', name: 'Cream Cheese (Kg)', unit: 'kg', costPerUnit: 32.00, stock: 4.0, minStock: 3.0, category: 'misc' },
  { id: 'ing07', name: 'Pepino (Kg)', unit: 'kg', costPerUnit: 6.00, stock: 3.0, minStock: 2.0, category: 'misc' },
  { id: 'ing08', name: 'Abacate (Kg)', unit: 'kg', costPerUnit: 14.00, stock: 2.5, minStock: 2.0, category: 'misc' },
  { id: 'ing09', name: 'Shoyu (L)', unit: 'L', costPerUnit: 9.00, stock: 10, minStock: 8, category: 'molho' },
  { id: 'ing10', name: 'Gergelim (Kg)', unit: 'kg', costPerUnit: 25.00, stock: 1.5, minStock: 1.0, category: 'misc' },
  { id: 'ing11', name: 'Vinagre de Arroz (L)', unit: 'L', costPerUnit: 11.00, stock: 5, minStock: 5, category: 'molho' },
  { id: 'ing12', name: 'Embalagem Delivery (un)', unit: 'un', costPerUnit: 1.80, stock: 200, minStock: 300, category: 'embalagem' },
  { id: 'ing13', name: 'Masago (Kg)', unit: 'kg', costPerUnit: 120.00, stock: 0.8, minStock: 0.5, category: 'proteina' },
  { id: 'ing14', name: 'Manga (Kg)', unit: 'kg', costPerUnit: 8.00, stock: 2.0, minStock: 1.5, category: 'misc' },
  { id: 'ing15', name: 'Cream de Trufas (g)', unit: 'g', costPerUnit: 0.85, stock: 300, minStock: 100, category: 'molho' },
];

export const mockRecipes: Recipe[] = [
  {
    menuItemId: 's1', // Nigiri Salmão Trufado
    yield: 2, // 2 peças
    prepTime: 4,
    prepSteps: [
      "No processador, adicione o arroz shari e modele delicadamente à mão os dois bolinhos da base.",
      "Corte as fatias de salmão fresco em pequenos recortes grossos diagonais.",
      "Posicione a fatia de peixe sobre o arroz aplicando leve pressão digital (técnica de 2 toques).",
      "Com a bisnaga de azeite trufado, pingue de 2 a 3 gotas controladas no centro de cada salmão.",
      "Salpique flor de sal por cima e use o maçarico em até 6cm de distância para liberar os aromas. Sirva imediatamente."
    ],
    items: [
      { ingredientId: 'ing01', quantity: 0.05 },  // 50g salmão
      { ingredientId: 'ing04', quantity: 0.03 },  // 30g arroz
      { ingredientId: 'ing15', quantity: 2 },     // 2g trufa
    ]
  },
  {
    menuItemId: 's2', // Temaki Ebi Ten
    yield: 1,
    prepTime: 6,
    prepSteps: [
      "Empane o camarão na massa de tempurá e frite em óleo quente (180°C) até dourar.",
      "Corte meia alga (Nori) com as mãos sempre secas.",
      "Espalhe o shari num ângulo triangular e aplique uma das faixas do Cream Cheese.",
      "Posicione o camarão quente na transversal deixando a cauda para fora da folha.",
      "Enrole pressionando a base em formato cônico e feche a ponta com um grão de shari."
    ],
    items: [
      { ingredientId: 'ing03', quantity: 0.06 },  // 60g camarão
      { ingredientId: 'ing04', quantity: 0.05 },  // 50g arroz
      { ingredientId: 'ing05', quantity: 0.05 },  // nori
      { ingredientId: 'ing06', quantity: 0.02 },  // 20g cream cheese
    ]
  },
  {
    menuItemId: 's3', // Uramaki Filadélfia (8 peças)
    yield: 1,
    items: [
      { ingredientId: 'ing01', quantity: 0.07 },  // 70g salmão
      { ingredientId: 'ing04', quantity: 0.07 },  // 70g arroz
      { ingredientId: 'ing05', quantity: 0.1 },   // 1/10 nori
      { ingredientId: 'ing06', quantity: 0.05 },  // 50g cream cheese
      { ingredientId: 'ing10', quantity: 0.003 }, // 3g gergelim
    ]
  },
  {
    menuItemId: 's4', // Sashimi Maguro (5 fatias)
    yield: 1,
    items: [
      { ingredientId: 'ing02', quantity: 0.10 },  // 100g atum
      { ingredientId: 'ing09', quantity: 0.01 },  // 10ml shoyu
    ]
  },
  {
    menuItemId: 's5', // Dragon Roll Premium
    yield: 1,
    items: [
      { ingredientId: 'ing03', quantity: 0.08 },  // 80g camarão
      { ingredientId: 'ing04', quantity: 0.08 },  // 80g arroz
      { ingredientId: 'ing05', quantity: 0.1 },   // nori
      { ingredientId: 'ing08', quantity: 0.06 },  // 60g abacate
      { ingredientId: 'ing13', quantity: 0.01 },  // 10g masago
      { ingredientId: 'ing10', quantity: 0.005 }, // gergelim
    ]
  },
  {
    menuItemId: 'k1', // Gyoza de Lombo
    yield: 1,
    items: [
      { ingredientId: 'ing03', quantity: 0.06 },  // 60g camarão (proteína)
      { ingredientId: 'ing07', quantity: 0.04 },  // 40g pepino
      { ingredientId: 'ing09', quantity: 0.01 },  // 10ml shoyu
    ]
  },
  {
    menuItemId: 'k5', // Tempura de Camarão (6 un.)
    yield: 1,
    items: [
      { ingredientId: 'ing03', quantity: 0.18 },  // 180g camarão
      { ingredientId: 'ing09', quantity: 0.02 },  // 20ml shoyu
    ]
  },
  {
    menuItemId: 'k4', // Missoshiru
    yield: 1,
    items: [
      { ingredientId: 'ing09', quantity: 0.015 }, // 15ml shoyu/dashi
    ]
  },
];

