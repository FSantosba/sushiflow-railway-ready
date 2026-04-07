// ─── Unified User (Usuarios) ────────────────────────────────────────────────
export type UserRole = 'cliente' | 'motoboy' | 'admin' | 'cozinha';

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: UserRole;
  statusDisponibilidade?: boolean; // Mainly for motoboys
  createdAt: string; // ISO date string
}

// ─── Product (Cardápio Sincronizado) ─────────────────────────────────────────
export interface Product {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  estoqueAtivo: boolean;
  categoria?: string;
  imagemUrl?: string;
}

// ─── Orders (O Coração) ──────────────────────────────────────────────────────
export enum OrderStatus {
  NEW = 'novo',
  PENDING = 'pendente',
  PAGO = 'pago',
  PREPARING = 'em_preparo',
  EM_PREPARO = 'em_preparo', // Backward compatibility
  PRONTO_COLETA = 'pronto_coleta',
  READY = 'pronto',
  DELIVERY = 'em_rota',
  EM_ROTA = 'em_rota', // Backward compatibility
  COMPLETED = 'entregue',
  ENTREGUE = 'entregue', // Backward compatibility
  CANCELADO = 'cancelado',
  CANCELED = 'cancelado'
}

export interface AddressJSONB {
  rua: string;
  numero: string;
  bairro?: string;
  cidade?: string;
  lat?: number;
  lng?: number;
  [key: string]: any;
}

export interface Order {
  id: string;
  clienteId: string;
  motoboyId?: string;
  valorItens: number;
  taxaEntrega: number;
  totalGeral: number;
  status: OrderStatus;
  enderecoEntrega: AddressJSONB;
  metodoPagamento?: string;
  tempoEstimadoMinutos?: number;
  createdAt: string; // ISO date string
  
  // Frontend Helpers (Populated via joins in a real backend, mocked here)
  clienteNome?: string;
  customer?: string; // Compatibility with LogisticsKanban
  motoboyNome?: string;
  itens?: { productId: string; nome: string; quantidade: number; precoUnitario: number; printerRoute?: 'KITCHEN' | 'BAR' }[];
  platform?: string; // Kanban mock
  items?: any[]; // Kanban mock
  total?: number; // Kanban mock
  time?: string; // Kanban mock
  address?: string; // Kanban mock
  deliveryMan?: string; // Driver app mock — stores driverKey
  notes?: string; // Order notes / obs
  clientePhone?: string; // Phone for WhatsApp contact
}

// ─── Tracking (Logística Real-Time) ──────────────────────────────────────────
export interface DeliveryTracking {
  id: string;
  pedidoId: string;
  lat: number;
  lng: number;
  ultimaAtualizacao: string; // ISO date string
}

// ─── Wallet (Carteira Digital) ───────────────────────────────────────────────
export type TransactionType = 'credito_entrega' | 'debito_taxa' | 'venda_restaurante';

export interface WalletTransaction {
  id: string;
  usuarioId: string;
  pedidoId?: string;
  valor: number;
  tipo: TransactionType;
  dataTransacao: string; // ISO date string
}

export interface ClosedTicket {
  id: string;
  tableId: string;
  closedAt: number; // timestamp ms
  items: { name: string; qty: number; price: number; prepTimeMs?: number }[];
  subtotal: number;
  total: number;
  paymentMethod: string;
}

export enum TableStatus {
  FREE = 'LIVRE',
  OCCUPIED = 'OCUPADA',
  RESERVED = 'RESERVA',
  CLEANING = 'EM LIMPEZA'
}

export interface Table {
  id: string;
  status: TableStatus;
  capacity: number;
  timeActive?: string;
  currentTotal?: number;
}

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMADA',
  PENDING = 'AGUARDANDO',
  ARRIVED = 'CHEGOU',
  CANCELED = 'CANCELADA'
}

export interface Reservation {
  id: string;
  customer: string;
  phone: string;
  people: number;
  time: string;
  date: string;
  status: ReservationStatus;
  tablePreference?: string;
  notes?: string;
}

export interface WaitingEntry {
  id: string;
  customer: string;
  phone: string;
  people: number;
  startTime: number; // timestamp
  needsHighChair: boolean;
  notified: boolean;
}

export interface Printer {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'error';
  location: string;
  paperLevel: number;
}

export interface PrintRoute {
  category: string;
  printerId: string;
}

export enum PaymentMethod {
  PIX = 'PIX',
  CREDIT = 'CRÉDITO',
  DEBIT = 'DÉBITO',
  CASH = 'DINHEIRO',
  VOUCHER = 'VOUCHER'
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT'; // IN: Venda, OUT: Sangria/Despesa
  method: PaymentMethod | 'SANGRIA';
  amount: number;
  description: string;
  time: string;
  user: string;
}

export enum EmployeeRole {
  MANAGER = 'GERENTE',
  SUSHIMAN = 'SUSHIMAN',
  WAITER = 'GARÇOM',
  DELIVERY = 'MOTOBOY',
  HOSTESS = 'RECEPÇÃO'
}

export enum EmployeeStatus {
  ONLINE = 'EM SERVIÇO',
  BREAK = 'EM PAUSA',
  OFFLINE = 'OFFLINE'
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  performance: number; // 0-100
  shiftStart: string;
  tasksCompleted: number;
  avatar: string;
  phone: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  category: 'store' | 'individual';
  description: string;
}

export interface BonusEntry {
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  status: 'pending' | 'released';
  date: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  image: string;
  spicy?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  bestSeller?: boolean;
  printerRoute?: 'KITCHEN' | 'BAR';
}

// ─── CMV: Custo de Mercadoria Vendida ───────────────────────────────────────

export interface Ingredient {
  id: string;
  name: string;
  image?: string; // URL da foto do insumo
  unit: 'kg' | 'g' | 'L' | 'ml' | 'un' | 'cx' | 'pct';
  costPerUnit: number;
  stock: number;
  minStock?: number;
  category: 'proteina' | 'carboidrato' | 'molho' | 'embalagem' | 'misc';
}

export interface InventoryLog {
  id: string;
  timestamp: number;
  user: string; // Nome de quem retirou/adicionou
  type: 'RETIRADA' | 'ENTRADA' | 'AJUSTE';
  items: {
    ingredientId: string;
    ingredientName: string;
    quantity: number; // Positivo para entrada, negativo para retirada
  }[];
  notes?: string;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number; // na unidade do ingrediente
}

export interface Recipe {
  menuItemId: string;
  items: RecipeItem[];
  yield: number; // quantas porções essa receita rende (padrão 1)
  prepTime?: number; // Tempo de preparo em minutos
  prepSteps?: string[]; // Arrays de passos descritivos
}
