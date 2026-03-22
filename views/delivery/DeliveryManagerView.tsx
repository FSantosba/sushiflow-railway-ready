import React, { useState, useEffect, useCallback } from 'react';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem } from '../../types';

// ── Local types (independent from global Order to avoid conflicts) ────────────
type DStatus = 'pending' | 'preparing' | 'ready' | 'delivered';
type PayMethod = 'pix' | 'card' | 'cash';

interface DItem { item: MenuItem; qty: number; obs: string; }

interface DeliveryOrder {
    id: string;
    customerName: string;
    customerPhone: string;
    address: string;
    paymentMethod: PayMethod;
    items: DItem[];
    total: number;
    status: DStatus;
    createdAt: Date;
}

interface ManagedItem extends MenuItem {
    available: boolean;
    category: string;
}

interface Coupon {
    code: string;
    discount: number;
    type: 'percent' | 'fixed' | 'freeship';
    uses: number;
    active: boolean;
}

interface StoreSettings {
    open: boolean;
    name: string;
    deliveryFee: number;
    minOrder: number;
    estimatedTime: string;
    whatsapp: string;
    radius: number;
    paymentMethods: { pix: boolean; card: boolean; cash: boolean };
}

// ── Mock orders ───────────────────────────────────────────────
const MOCK_ORDERS: DeliveryOrder[] = [
    {
        id: 'DEL-001', customerName: 'Rafael Oliveira', customerPhone: '11 98765-4321',
        address: 'Rua das Flores, 142 – Apto 7, Jardins', paymentMethod: 'pix',
        items: [{ item: sushiMenu[0], qty: 2, obs: '' }, { item: sushiMenu[2], qty: 1, obs: 'sem cream cheese' }],
        total: 89.80, status: 'pending', createdAt: new Date(Date.now() - 4 * 60000),
    },
    {
        id: 'DEL-002', customerName: 'Juliana Costa', customerPhone: '11 91234-5678',
        address: 'Av. Paulista, 900 – conjunto 12', paymentMethod: 'card',
        items: [{ item: sushiMenu[1], qty: 3, obs: '' }],
        total: 143.70, status: 'preparing', createdAt: new Date(Date.now() - 18 * 60000),
    },
    {
        id: 'DEL-003', customerName: 'Lucas Mendes', customerPhone: '11 97777-8888',
        address: 'Rua Augusta, 500, Consolação', paymentMethod: 'cash',
        items: [{ item: barMenu[0], qty: 2, obs: '' }, { item: sushiMenu[3], qty: 1, obs: '' }],
        total: 71.40, status: 'ready', createdAt: new Date(Date.now() - 32 * 60000),
    },
    {
        id: 'DEL-004', customerName: 'Ana Lima', customerPhone: '11 92222-3333',
        address: 'Rua Oscar Freire, 28, Pinheiros', paymentMethod: 'pix',
        items: [{ item: sushiMenu[0], qty: 1, obs: '' }, { item: kitchenMenu[0], qty: 1, obs: '' }],
        total: 62.00, status: 'delivered', createdAt: new Date(Date.now() - 75 * 60000),
    },
    {
        id: 'DEL-005', customerName: 'Fernanda Rocha', customerPhone: '11 95555-6666',
        address: 'Alameda Santos, 1200, Jardim Paulista', paymentMethod: 'pix',
        items: [{ item: sushiMenu[2], qty: 4, obs: 'muito shoyu' }],
        total: 108.00, status: 'pending', createdAt: new Date(Date.now() - 60000),
    },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const elapsed = (d: Date) => {
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    return m < 1 ? 'agora' : `${m} min`;
};

const STATUS_META: Record<DStatus, { label: string; color: string; bg: string; border: string; icon: string; nextLabel: string | null; next: DStatus | null }> = {
    pending:   { label: 'Novo',       color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30',   icon: 'notifications_active', nextLabel: 'Aceitar pedido',      next: 'preparing' },
    preparing: { label: 'Preparando', color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/30',    icon: 'skillet',              nextLabel: 'Marcar como pronto',  next: 'ready'     },
    ready:     { label: 'Saindo',     color: 'text-violet-400',  bg: 'bg-violet-400/10',  border: 'border-violet-400/30',  icon: 'two_wheeler',          nextLabel: 'Despachar motoboy',   next: 'delivered' },
    delivered: { label: 'Entregue',   color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', icon: 'check_circle',          nextLabel: null,                  next: null        },
};

// ── NavTab ─────────────────────────────────────────────────────
const NavTab: React.FC<{ label: string; icon: string; active: boolean; badge?: number; onClick: () => void }> =
    ({ label, icon, active, badge, onClick }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap
                ${active
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                    : 'bg-card-dark text-slate-400 border-border-dark hover:text-white hover:border-slate-600'}`}
        >
            <span className="material-symbols-outlined text-sm">{icon}</span>
            {label}
            {badge !== undefined && badge > 0 && (
                <span className="bg-rose-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                    {badge}
                </span>
            )}
        </button>
    );

// ── StatCard ──────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; icon: string; iconClass: string; delta?: string }> =
    ({ label, value, icon, iconClass, delta }) => (
        <div className="bg-card-dark border border-border-dark rounded-2xl p-4 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-xl font-black text-white mt-0.5">{value}</p>
                {delta && <p className="text-xs text-emerald-400 font-semibold mt-0.5">{delta}</p>}
            </div>
        </div>
    );

// ── Toggle ────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 ${checked ? 'bg-primary' : 'bg-slate-700'}`}
    >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

// ── Order Card ────────────────────────────────────────────────
const OrderCard: React.FC<{ order: DeliveryOrder; onAdvance: (id: string) => void; onCancel: (id: string) => void }> =
    ({ order, onAdvance, onCancel }) => {
        const m = STATUS_META[order.status];
        const isNew = order.status === 'pending';

        return (
            <div className={`bg-card-dark border rounded-2xl overflow-hidden transition-all
                ${isNew ? 'border-amber-400/40 shadow-lg shadow-amber-500/5' : 'border-border-dark'}`}>

                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${m.bg} ${m.border} ${m.color}`}>
                        <span className="material-symbols-outlined text-xs">{m.icon}</span>
                        {m.label}
                    </span>
                    <span className="text-slate-500 text-xs">{elapsed(order.createdAt)} · {order.id}</span>
                </div>

                {/* Customer info */}
                <div className="px-4 pt-3 pb-2 border-b border-border-dark/40 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="material-symbols-outlined text-slate-500 text-sm">person</span>
                        {order.customerName}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-slate-500 text-sm mt-0.5">location_on</span>
                        {order.address}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-slate-500 text-sm">
                            {order.paymentMethod === 'pix' ? 'bolt' : order.paymentMethod === 'cash' ? 'payments' : 'credit_card'}
                        </span>
                        <span className="capitalize">{order.paymentMethod}</span>
                    </div>
                </div>

                {/* Items */}
                <div className="px-4 pt-2 pb-3 border-b border-border-dark/40 space-y-1">
                    {order.items.map((ci, i) => (
                        <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-300">{ci.qty}× {ci.item.name}</span>
                            <span className="text-slate-400 font-mono">{fmt(ci.item.price * ci.qty)}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-black text-white">{fmt(order.total)}</p>
                    </div>
                    <div className="flex gap-2">
                        {order.status !== 'delivered' && (
                            <>
                                <button onClick={() => onCancel(order.id)}
                                    className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all">
                                    Cancelar
                                </button>
                                {m.next && (
                                    <button onClick={() => onAdvance(order.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                            ${isNew ? 'bg-primary hover:bg-primary/80 text-white shadow-md shadow-primary/30' : 'bg-white/10 hover:bg-white/15 text-white'}`}>
                                        {m.nextLabel}
                                    </button>
                                )}
                            </>
                        )}
                        {order.status === 'delivered' && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Concluído
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

// ── Menu Item Card ────────────────────────────────────────────
const MenuItemCard: React.FC<{ item: ManagedItem; onToggle: () => void; onEditPrice: () => void }> =
    ({ item, onToggle, onEditPrice }) => (
        <div className={`bg-card-dark border rounded-xl p-3 flex items-center gap-3 transition-all ${item.available ? 'border-border-dark' : 'border-border-dark opacity-50'}`}>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/48'; }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-primary font-bold text-sm">{fmt(item.price)}</span>
                    <button onClick={onEditPrice} className="text-slate-600 hover:text-slate-400 transition-colors ml-1">
                        <span className="material-symbols-outlined text-xs">edit</span>
                    </button>
                </div>
            </div>
            <Toggle checked={item.available} onChange={onToggle} />
        </div>
    );

// ════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════
const DeliveryManagerView: React.FC = () => {
    const [tab, setTab] = useState<'orders' | 'menu' | 'settings' | 'analytics'>('orders');
    const [orders, setOrders] = useState<DeliveryOrder[]>(MOCK_ORDERS);
    const [tick, setTick] = useState(0); // forces re-render for elapsed time
    const [settings, setSettings] = useState<StoreSettings>({
        open: true, name: 'SushiFlow.delivery', deliveryFee: 6.00,
        minOrder: 30.00, estimatedTime: '35-45', whatsapp: '11 99999-0000',
        radius: 8, paymentMethods: { pix: true, card: true, cash: true },
    });
    const [coupons, setCoupons] = useState<Coupon[]>([
        { code: 'SUSHI10',  discount: 10, type: 'percent',  uses: 47, active: true },
        { code: 'BEMVINDO', discount: 15, type: 'percent',  uses: 23, active: true },
        { code: 'FRETE0',   discount: 0,  type: 'freeship', uses: 18, active: false },
    ]);

    const allItems = [...sushiMenu, ...barMenu, ...kitchenMenu];
    const [menuItems, setMenuItems] = useState<ManagedItem[]>(
        allItems.map(i => ({
            ...i,
            available: true,
            category: sushiMenu.includes(i) ? 'Sushi' : barMenu.includes(i) ? 'Bebidas' : 'Pratos Quentes'
        }))
    );
    const [menuSearch, setMenuSearch] = useState('');
    const [selCategory, setSelCategory] = useState('Todos');
    const categories = ['Todos', 'Sushi', 'Bebidas', 'Pratos Quentes'];

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(id);
    }, []);

    const advanceOrder = useCallback((id: string) => {
        setOrders(prev => prev.map(o => {
            if (o.id !== id) return o;
            const next = STATUS_META[o.status].next;
            return next ? { ...o, status: next } : o;
        }));
    }, []);

    const cancelOrder = useCallback((id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
    }, []);

    // ── Counts ──────────────────────────────────────────────
    const liveCount = orders.filter(o => o.status !== 'delivered').length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;

    // ── Analytics ───────────────────────────────────────────
    const delivered = orders.filter(o => o.status === 'delivered');
    const todayRev = delivered.reduce((s, o) => s + o.total, 0) + 224.30; // + historical
    const todayOrders = delivered.length + 8;
    const avgTicket = todayRev / todayOrders;

    const topItems = (() => {
        const map: Record<string, { name: string; qty: number; revenue: number }> = {};
        orders.forEach(o => o.items.forEach(ci => {
            const k = ci.item.name;
            if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0 };
            map[k].qty += ci.qty;
            map[k].revenue += ci.item.price * ci.qty;
        }));
        return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
    })();

    const filteredMenu = menuItems.filter(i =>
        (selCategory === 'Todos' || i.category === selCategory) &&
        i.name.toLowerCase().includes(menuSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-background-dark text-white overflow-hidden">

            {/* ── Top bar ──────────────────────────────────── */}
            <div className="px-6 py-4 border-b border-border-dark flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-lg">storefront</span>
                    </div>
                    <div>
                        <h1 className="text-base font-black text-white leading-tight">{settings.name}</h1>
                        <p className="text-xs text-slate-500">Painel do Estabelecimento</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {liveCount > 0 && (
                        <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm animate-pulse">notifications_active</span>
                            {liveCount} em andamento
                        </span>
                    )}
                    <button
                        onClick={() => setSettings(s => ({ ...s, open: !s.open }))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border
                            ${settings.open
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <span className={`w-2 h-2 rounded-full ${settings.open ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {settings.open ? 'Aberta' : 'Fechada'}
                    </button>
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="px-6 py-3 border-b border-border-dark flex gap-2 overflow-x-auto shrink-0">
                <NavTab label="Pedidos"        icon="receipt_long"     active={tab === 'orders'}    badge={pendingCount} onClick={() => setTab('orders')} />
                <NavTab label="Cardápio"       icon="restaurant_menu"  active={tab === 'menu'}                          onClick={() => setTab('menu')} />
                <NavTab label="Configurações"  icon="tune"             active={tab === 'settings'}                      onClick={() => setTab('settings')} />
                <NavTab label="Analytics"      icon="bar_chart_4_bars" active={tab === 'analytics'}                     onClick={() => setTab('analytics')} />
            </div>

            {/* ── Content ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ═════════ ORDERS ═════════ */}
                {tab === 'orders' && (
                    <div className="p-6">
                        {/* Status strip */}
                        <div className="grid grid-cols-4 gap-3 mb-6">
                            {(Object.keys(STATUS_META) as DStatus[]).map(s => {
                                const m = STATUS_META[s];
                                const count = orders.filter(o => o.status === s).length;
                                return (
                                    <div key={s} className={`rounded-xl p-3 border text-center ${m.bg} ${m.border}`}>
                                        <p className={`text-2xl font-black ${m.color}`}>{count}</p>
                                        <p className={`text-xs font-semibold ${m.color} opacity-80`}>{m.label}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Kanban grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {(Object.keys(STATUS_META) as DStatus[]).map(status => {
                                const m = STATUS_META[status];
                                const col = orders.filter(o => o.status === status);
                                return (
                                    <div key={status} className="space-y-3">
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${m.bg} ${m.border}`}>
                                            <span className={`material-symbols-outlined text-sm ${m.color}`}>{m.icon}</span>
                                            <span className={`text-sm font-bold ${m.color}`}>{m.label}</span>
                                            <span className={`ml-auto text-xs font-mono ${m.color}`}>{col.length}</span>
                                        </div>
                                        {col.length === 0
                                            ? <div className="rounded-xl border border-dashed border-border-dark p-6 text-center">
                                                <p className="text-slate-600 text-xs">Nenhum pedido</p>
                                              </div>
                                            : col.map(o => (
                                                <OrderCard key={o.id} order={o} onAdvance={advanceOrder} onCancel={cancelOrder} />
                                              ))
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ═════════ MENU ═════════ */}
                {tab === 'menu' && (
                    <div className="p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="relative flex-1 w-full">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                                <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                                    placeholder="Buscar item…"
                                    className="w-full bg-card-dark border border-border-dark rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary" />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {categories.map(c => (
                                    <button key={c} onClick={() => setSelCategory(c)}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                                            ${selCategory === c ? 'bg-primary text-white border-primary' : 'bg-card-dark text-slate-400 border-border-dark hover:text-white'}`}>
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 py-2 px-4 bg-card-dark rounded-xl border border-border-dark text-xs text-slate-400">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            <span>{filteredMenu.filter(i => i.available).length} de {filteredMenu.length} itens disponíveis</span>
                            <div className="flex gap-2 ml-auto">
                                <button onClick={() => setMenuItems(p => p.map(i => ({ ...i, available: true })))}
                                    className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">Ativar todos</button>
                                <span className="text-slate-600">·</span>
                                <button onClick={() => setMenuItems(p => p.map(i => ({ ...i, available: false })))}
                                    className="text-rose-400 hover:text-rose-300 font-semibold transition-colors">Desativar todos</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredMenu.map(item => (
                                <MenuItemCard key={item.id} item={item}
                                    onToggle={() => setMenuItems(p => p.map(i => i.id === item.id ? { ...i, available: !i.available } : i))}
                                    onEditPrice={() => {
                                        const val = prompt(`Novo preço para "${item.name}":`, String(item.price));
                                        const n = parseFloat(val ?? '');
                                        if (!isNaN(n) && n > 0) setMenuItems(p => p.map(i => i.id === item.id ? { ...i, price: n } : i));
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ═════════ SETTINGS ═════════ */}
                {tab === 'settings' && (
                    <div className="p-6 space-y-6 max-w-3xl">

                        {/* Store info */}
                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-black text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">store</span>
                                Informações da Loja
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {([
                                    { label: 'Nome', key: 'name', type: 'text' },
                                    { label: 'WhatsApp', key: 'whatsapp', type: 'text' },
                                    { label: 'Taxa de entrega (R$)', key: 'deliveryFee', type: 'number' },
                                    { label: 'Pedido mínimo (R$)', key: 'minOrder', type: 'number' },
                                    { label: 'Tempo estimado (min)', key: 'estimatedTime', type: 'text' },
                                    { label: 'Raio de entrega (km)', key: 'radius', type: 'number' },
                                ] as const).map(({ label, key, type }) => (
                                    <div key={key}>
                                        <label className="block text-xs text-slate-500 mb-1 font-medium">{label}</label>
                                        <input
                                            type={type}
                                            value={(settings as Record<string, any>)[key]}
                                            onChange={e => setSettings(s => ({
                                                ...s, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                                            }))}
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Payment methods */}
                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-2">
                            <h2 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-primary text-sm">credit_card</span>
                                Formas de Pagamento
                            </h2>
                            {([
                                { key: 'pix' as const,  label: 'PIX',      icon: 'bolt' },
                                { key: 'card' as const, label: 'Cartão',   icon: 'credit_card' },
                                { key: 'cash' as const, label: 'Dinheiro', icon: 'payments' },
                            ]).map(({ key, label, icon }) => (
                                <div key={key} className="flex items-center justify-between py-2 border-b border-border-dark/40 last:border-0">
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <span className="material-symbols-outlined text-slate-500 text-sm">{icon}</span>
                                        {label}
                                    </div>
                                    <Toggle
                                        checked={settings.paymentMethods[key]}
                                        onChange={() => setSettings(s => ({ ...s, paymentMethods: { ...s.paymentMethods, [key]: !s.paymentMethods[key] } }))}
                                    />
                                </div>
                            ))}
                        </section>

                        {/* Coupons */}
                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-2">
                            <h2 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-primary text-sm">sell</span>
                                Cupons de Desconto
                            </h2>
                            {coupons.map((c, i) => (
                                <div key={c.code} className="flex items-center gap-3 py-2 border-b border-border-dark/40 last:border-0">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-bold text-sm font-mono">{c.code}</span>
                                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                                {c.type === 'percent' ? `${c.discount}% OFF` : c.type === 'freeship' ? 'Frete Grátis' : fmt(c.discount)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{c.uses} usos</p>
                                    </div>
                                    <Toggle
                                        checked={c.active}
                                        onChange={() => setCoupons(p => p.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
                                    />
                                </div>
                            ))}
                        </section>

                        <button className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">save</span>
                            Salvar Configurações
                        </button>
                    </div>
                )}

                {/* ═════════ ANALYTICS ═════════ */}
                {tab === 'analytics' && (
                    <div className="p-6 space-y-6">

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="Receita do Dia"  value={fmt(todayRev)}        icon="payments"         iconClass="bg-emerald-500/10 text-emerald-400" delta="+12% vs ontem" />
                            <StatCard label="Pedidos Hoje"    value={String(todayOrders)}  icon="receipt_long"     iconClass="bg-blue-500/10 text-blue-400"       delta="+3 vs ontem" />
                            <StatCard label="Ticket Médio"    value={fmt(avgTicket)}        icon="bar_chart"        iconClass="bg-violet-500/10 text-violet-400" />
                            <StatCard label="Tempo Médio"     value="38 min"               icon="schedule"         iconClass="bg-amber-500/10 text-amber-400"    delta="-2 min vs ontem" />
                        </div>

                        {/* Top items */}
                        <div className="bg-card-dark border border-border-dark rounded-2xl p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
                                Itens Mais Vendidos Hoje
                            </h2>
                            <div className="space-y-3">
                                {topItems.map((item, i) => {
                                    const pct = (item.qty / (topItems[0]?.qty || 1)) * 100;
                                    return (
                                        <div key={item.name} className="flex items-center gap-3">
                                            <span className="text-slate-500 text-xs font-mono w-4">{i + 1}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm text-white font-medium truncate">{item.name}</span>
                                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                                        <span className="text-xs text-slate-400">{item.qty}x</span>
                                                        <span className="text-xs font-bold text-primary">{fmt(item.revenue)}</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment share */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'PIX',      icon: 'bolt',        pct: 62, bar: 'bg-emerald-400', ic: 'text-emerald-400 bg-emerald-400/10' },
                                { label: 'Cartão',   icon: 'credit_card', pct: 28, bar: 'bg-blue-400',    ic: 'text-blue-400 bg-blue-400/10' },
                                { label: 'Dinheiro', icon: 'payments',    pct: 10, bar: 'bg-amber-400',   ic: 'text-amber-400 bg-amber-400/10' },
                            ].map(m => (
                                <div key={m.label} className="bg-card-dark border border-border-dark rounded-2xl p-4">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${m.ic}`}>
                                        <span className="material-symbols-outlined text-sm">{m.icon}</span>
                                    </div>
                                    <p className="text-2xl font-black text-white">{m.pct}%</p>
                                    <p className="text-xs text-slate-500 mt-1">{m.label}</p>
                                    <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${m.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Hourly orders */}
                        <div className="bg-card-dark border border-border-dark rounded-2xl p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                                Pedidos por Hora
                            </h2>
                            <div className="flex items-end gap-1 h-20">
                                {[0,0,0,0,0,0,0,0,1,2,3,4,5,8,10,13,15,18,12,8,5,3,1,0].map((v, h) => (
                                    <div key={h} className="flex-1 flex flex-col items-center">
                                        <div
                                            className={`w-full rounded-sm transition-all ${v > 0 ? 'bg-primary/70' : 'bg-slate-800'}`}
                                            style={{ height: `${Math.max((v / 18) * 64, v > 0 ? 4 : 2)}px` }}
                                            title={`${h}h – ${v} pedidos`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 mt-1">
                                <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryManagerView;
