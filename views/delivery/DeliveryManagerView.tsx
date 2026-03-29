import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Circle, Marker } from '@react-google-maps/api';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { Order, OrderStatus, MenuItem } from '../../types';
import { useOrders } from '../../context/OrdersContext';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 }; // São Paulo

// ── Local types (not conflicting with global Order) ───────────────────────────
type PayMethod = 'pix' | 'card' | 'cash';

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

interface DeliveryZone {
    id: string;
    name: string;
    fee: number;
    minOrder: number;
    color: string;
    radiusKm: number;
}

interface NewZoneForm {
    name: string;
    radiusKm: string;
    fee: string;
    minOrder: string;
    color: string;
}

const ZONE_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
];

// ── Mapa de Zonas de Entrega ──────────────────────────────────────────────────
const MAP_CONTAINER_STYLE = { width: '100%', height: '320px', borderRadius: '12px' };
const MAP_OPTIONS: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bbf' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2e' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3554' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f2e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1420' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
};

type DeliveryMapSectionProps = {
    zones: DeliveryZone[];
    center: google.maps.LatLngLiteral;
};

const DeliveryMapSection: React.FC<DeliveryMapSectionProps> = ({ zones, center }) => {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'sushiflow-gmap',
        googleMapsApiKey: GOOGLE_MAPS_KEY,
    });

    if (loadError) return (
        <div className="w-full h-[320px] rounded-xl bg-slate-800 border border-rose-500/30 flex flex-col items-center justify-center text-rose-400 gap-2">
            <span className="material-symbols-outlined text-2xl">error</span>
            <p className="text-xs font-semibold">Erro ao carregar o Google Maps</p>
            <p className="text-[10px] text-slate-500">Verifique se a API key está correta e com Maps JavaScript API ativada</p>
        </div>
    );

    if (!isLoaded) return (
        <div className="w-full h-[320px] rounded-xl bg-slate-800 border border-border-dark flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Carregando mapa…</p>
            </div>
        </div>
    );

    const sortedZones = [...zones].sort((a, b) => b.radiusKm - a.radiusKm);
    const maxRadius = Math.max(...zones.map(z => z.radiusKm), 5);
    const zoom = maxRadius <= 3 ? 13 : maxRadius <= 7 ? 12 : maxRadius <= 15 ? 11 : 10;

    return (
        <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={center}
            zoom={zoom}
            options={MAP_OPTIONS}
        >
            {/* Marcador central do restaurante */}
            <Marker
                position={center}
                icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#f97316',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                }}
                title="Seu restaurante"
            />

            {/* Círculos de zonas (do maior para o menor para sobreposição correta) */}
            {sortedZones.map(zone => (
                <Circle
                    key={zone.id}
                    center={center}
                    radius={zone.radiusKm * 1000}
                    options={{
                        fillColor: zone.color,
                        fillOpacity: 0.12,
                        strokeColor: zone.color,
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                    }}
                />
            ))}
        </GoogleMap>
    );
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const elapsed = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 1 ? 'agora' : `${m} min`;
};

// ── Status metadata (mapeado para OrderStatus global) ─────────────────────────
const STATUS_META: Partial<Record<OrderStatus, {
    label: string; color: string; bg: string; border: string; icon: string;
    nextLabel: string | null; next: OrderStatus | null;
}>> = {
    [OrderStatus.NEW]: {
        label: 'Novo', color: 'text-amber-400', bg: 'bg-amber-400/10',
        border: 'border-amber-400/30', icon: 'notifications_active',
        nextLabel: 'Aceitar pedido', next: OrderStatus.PENDING,
    },
    [OrderStatus.PENDING]: {
        label: 'Pendente', color: 'text-blue-400', bg: 'bg-blue-400/10',
        border: 'border-blue-400/30', icon: 'shopping_bag',
        nextLabel: 'Avançar preparo', next: OrderStatus.PREPARING,
    },
    [OrderStatus.PREPARING]: {
        label: 'Preparando', color: 'text-violet-400', bg: 'bg-violet-400/10',
        border: 'border-violet-400/30', icon: 'skillet',
        nextLabel: 'Marcar como pronto', next: OrderStatus.READY,
    },
    [OrderStatus.READY]: {
        label: 'Saindo', color: 'text-orange-400', bg: 'bg-orange-400/10',
        border: 'border-orange-400/30', icon: 'two_wheeler',
        nextLabel: 'Despachar motoboy', next: OrderStatus.DELIVERY,
    },
    [OrderStatus.DELIVERY]: {
        label: 'Em Rota', color: 'text-primary', bg: 'bg-primary/10',
        border: 'border-primary/30', icon: 'local_shipping',
        nextLabel: 'Marcar entregue', next: OrderStatus.COMPLETED,
    },
    [OrderStatus.COMPLETED]: {
        label: 'Entregue', color: 'text-emerald-400', bg: 'bg-emerald-400/10',
        border: 'border-emerald-400/30', icon: 'check_circle',
        nextLabel: null, next: null,
    },
    [OrderStatus.CANCELADO]: {
        label: 'Cancelado', color: 'text-rose-400', bg: 'bg-rose-400/10',
        border: 'border-rose-400/30', icon: 'cancel',
        nextLabel: null, next: null,
    },
};

// Status visíveis no Kanban de delivery (excluindo estados de salão)
const DELIVERY_STATUSES: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.DELIVERY,
    OrderStatus.COMPLETED,
];

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

// ── Order Card (usa tipo global Order) ────────────────────────
const OrderCard: React.FC<{ order: Order; onAdvance: (id: string) => void; onCancel: (id: string) => void }> =
    ({ order, onAdvance, onCancel }) => {
        const m = STATUS_META[order.status];
        if (!m) return null;

        const isNew = order.status === OrderStatus.NEW || order.status === OrderStatus.PENDING;
        const isCanceled = order.status === OrderStatus.CANCELADO;
        const isDone = order.status === OrderStatus.COMPLETED;

        const customerName = order.customer || order.clienteNome || order.clienteId || 'Cliente';
        const address = order.address || (order.enderecoEntrega
            ? `${order.enderecoEntrega.rua}, ${order.enderecoEntrega.numero}${order.enderecoEntrega.bairro ? ' – ' + order.enderecoEntrega.bairro : ''}`
            : 'Balcão');
        const payMethod = (order.metodoPagamento || 'pix').toLowerCase() as PayMethod;
        const total = order.total ?? order.totalGeral ?? 0;

        return (
            <div className={`bg-card-dark border rounded-2xl overflow-hidden transition-all
                ${isNew ? 'border-amber-400/40 shadow-lg shadow-amber-500/5' : 'border-border-dark'}
                ${isCanceled ? 'opacity-50' : ''}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${m.bg} ${m.border} ${m.color}`}>
                        <span className="material-symbols-outlined text-xs">{m.icon}</span>
                        {m.label}
                    </span>
                    <span className="text-slate-500 text-xs">{elapsed(order.createdAt)} · #{order.id}</span>
                </div>

                {/* Customer info */}
                <div className="px-4 pt-3 pb-2 border-b border-border-dark/40 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="material-symbols-outlined text-slate-500 text-sm">person</span>
                        {customerName}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-slate-500 text-sm mt-0.5">location_on</span>
                        {address}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-slate-500 text-sm">
                            {payMethod === 'pix' ? 'bolt' : payMethod === 'cash' ? 'payments' : 'credit_card'}
                        </span>
                        <span className="capitalize">{order.metodoPagamento || 'PIX'}</span>
                        {order.platform && (
                            <span className="ml-auto text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-slate-500">{order.platform}</span>
                        )}
                    </div>
                </div>

                {/* Items */}
                <div className="px-4 pt-2 pb-3 border-b border-border-dark/40 space-y-1">
                    {order.items?.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-300">{item}</span>
                        </div>
                    ))}
                    {order.itens?.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-300">{item.quantidade}× {item.nome}</span>
                            <span className="text-slate-400 font-mono">{fmt(item.precoUnitario * item.quantidade)}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-black text-white">{fmt(total)}</p>
                    </div>
                    <div className="flex gap-2">
                        {!isDone && !isCanceled && (
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
                        {isDone && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Concluído
                            </span>
                        )}
                        {isCanceled && (
                            <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Cancelado
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
// Main Component
// ════════════════════════════════════════════════════════════
const DeliveryManagerView: React.FC = () => {
    // ── Estado global de pedidos ─────────────────────────────
    const { orders, updateOrder } = useOrders();

    // Filtra apenas pedidos de delivery
    const deliveryOrders = orders.filter(o =>
        DELIVERY_STATUSES.includes(o.status) ||
        o.enderecoEntrega?.rua ||
        o.address ||
        o.platform
    );

    const [tab, setTab] = useState<'orders' | 'menu' | 'settings' | 'analytics'>('orders');
    const [tick, setTick] = useState(0);
    const [settings, setSettings] = useState<StoreSettings>({
        open: true, name: 'SushiFlow.delivery', deliveryFee: 6.00,
        minOrder: 30.00, estimatedTime: '35-45', whatsapp: '11 99999-0000',
        radius: 8, paymentMethods: { pix: true, card: true, cash: true },
    });
    const [coupons, setCoupons] = useState<Coupon[]>([
        { code: 'SUSHI10', discount: 10, type: 'percent', uses: 47, active: true },
        { code: 'BEMVINDO', discount: 15, type: 'percent', uses: 23, active: true },
        { code: 'FRETE0', discount: 0, type: 'freeship', uses: 18, active: false },
    ]);
    const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([
        { id: 'z1', name: 'Zona 1', fee: 5.00, minOrder: 30.00, color: '#10b981', radiusKm: 3 },
        { id: 'z2', name: 'Zona 2', fee: 8.00, minOrder: 50.00, color: '#3b82f6', radiusKm: 7 },
    ]);
    const [mapCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
    const [showAddZone, setShowAddZone] = useState(false);
    const [newZone, setNewZone] = useState<NewZoneForm>({
        name: '', radiusKm: '5', fee: '6', minOrder: '30', color: ZONE_COLORS[0],
    });
    const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

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

    // ── Handlers usando OrdersContext ─────────────────────────
    const advanceOrder = useCallback((id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;
        const meta = STATUS_META[order.status];
        if (meta?.next) {
            updateOrder(id, { status: meta.next });
        }
    }, [orders, updateOrder]);

    const cancelOrder = useCallback((id: string) => {
        updateOrder(id, { status: OrderStatus.CANCELADO });
    }, [updateOrder]);

    // ── Counters ─────────────────────────────────────────────
    const liveCount = deliveryOrders.filter(o =>
        o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELADO
    ).length;

    const pendingCount = deliveryOrders.filter(o =>
        o.status === OrderStatus.NEW || o.status === OrderStatus.PENDING
    ).length;

    // ── Analytics ────────────────────────────────────────────
    const delivered = deliveryOrders.filter(o => o.status === OrderStatus.COMPLETED);
    const todayRev = delivered.reduce((s, o) => s + (o.total ?? o.totalGeral ?? 0), 0) + 224.30;
    const todayOrders = delivered.length + 8;
    const avgTicket = todayOrders > 0 ? todayRev / todayOrders : 0;

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
                <NavTab label="Pedidos" icon="receipt_long" active={tab === 'orders'} badge={pendingCount} onClick={() => setTab('orders')} />
                <NavTab label="Cardápio" icon="restaurant_menu" active={tab === 'menu'} onClick={() => setTab('menu')} />
                <NavTab label="Configurações" icon="tune" active={tab === 'settings'} onClick={() => setTab('settings')} />
                <NavTab label="Analytics" icon="bar_chart_4_bars" active={tab === 'analytics'} onClick={() => setTab('analytics')} />
            </div>

            {/* ── Content ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ═════════ ORDERS ═════════ */}
                {tab === 'orders' && (
                    <div className="p-6">
                        {/* Status strip */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                            {DELIVERY_STATUSES.map(s => {
                                const m = STATUS_META[s]!;
                                const count = deliveryOrders.filter(o => o.status === s).length;
                                return (
                                    <div key={s} className={`rounded-xl p-3 border text-center ${m.bg} ${m.border}`}>
                                        <p className={`text-2xl font-black ${m.color}`}>{count}</p>
                                        <p className={`text-xs font-semibold ${m.color} opacity-80`}>{m.label}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Kanban grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {DELIVERY_STATUSES.filter(s => s !== OrderStatus.COMPLETED).map(status => {
                                const m = STATUS_META[status]!;
                                const col = deliveryOrders.filter(o => o.status === status);
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

                        {/* Entregues hoje */}
                        {deliveryOrders.filter(o => o.status === OrderStatus.COMPLETED).length > 0 && (
                            <div className="mt-6">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Entregues Hoje</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {deliveryOrders.filter(o => o.status === OrderStatus.COMPLETED).map(o => (
                                        <OrderCard key={o.id} order={o} onAdvance={advanceOrder} onCancel={cancelOrder} />
                                    ))}
                                </div>
                            </div>
                        )}
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

                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-black text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">store</span>
                                Informações da Loja
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {([
                                    { label: 'Nome', key: 'name', type: 'text' },
                                    { label: 'WhatsApp', key: 'whatsapp', type: 'text' },
                                    { label: 'Taxa de entrega padrão (R$)', key: 'deliveryFee', type: 'number' },
                                    { label: 'Pedido mínimo padrão (R$)', key: 'minOrder', type: 'number' },
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

                        {/* ── Áreas de Entrega com Google Maps ── */}
                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-sm">map</span>
                                    Raios de Entrega
                                </h2>
                                <button
                                    onClick={() => setShowAddZone(v => !v)}
                                    className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-sm">{showAddZone ? 'close' : 'add'}</span>
                                    {showAddZone ? 'Cancelar' : 'Nova Zona'}
                                </button>
                            </div>

                            {/* Formulário de nova zona */}
                            {showAddZone && (
                                <div className="bg-background-dark border border-primary/30 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Nova zona de entrega</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Nome da zona</label>
                                            <input
                                                value={newZone.name}
                                                onChange={e => setNewZone(z => ({ ...z, name: e.target.value }))}
                                                placeholder="Ex: Zona Norte"
                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Raio (km)</label>
                                            <input
                                                type="number" min="0.5" step="0.5"
                                                value={newZone.radiusKm}
                                                onChange={e => setNewZone(z => ({ ...z, radiusKm: e.target.value }))}
                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Taxa de entrega (R$)</label>
                                            <input
                                                type="number" min="0" step="0.5"
                                                value={newZone.fee}
                                                onChange={e => setNewZone(z => ({ ...z, fee: e.target.value }))}
                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Pedido mínimo (R$)</label>
                                            <input
                                                type="number" min="0" step="1"
                                                value={newZone.minOrder}
                                                onChange={e => setNewZone(z => ({ ...z, minOrder: e.target.value }))}
                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-2">Cor da zona</label>
                                        <div className="flex gap-2">
                                            {ZONE_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setNewZone(z => ({ ...z, color: c }))}
                                                    className={`w-7 h-7 rounded-full transition-all ${
                                                        newZone.color === c ? 'ring-2 ring-offset-2 ring-offset-background-dark ring-white scale-110' : ''
                                                    }`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const rKm = parseFloat(newZone.radiusKm);
                                            const fee = parseFloat(newZone.fee);
                                            const minOrder = parseFloat(newZone.minOrder);
                                            if (!newZone.name || isNaN(rKm) || rKm <= 0) return;
                                            setDeliveryZones(z => [
                                                ...z,
                                                {
                                                    id: `z${Date.now()}`,
                                                    name: newZone.name,
                                                    radiusKm: rKm,
                                                    fee: isNaN(fee) ? 0 : fee,
                                                    minOrder: isNaN(minOrder) ? 0 : minOrder,
                                                    color: newZone.color,
                                                },
                                            ]);
                                            setNewZone({ name: '', radiusKm: '5', fee: '6', minOrder: '30', color: ZONE_COLORS[0] });
                                            setShowAddZone(false);
                                        }}
                                        className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-2 rounded-lg text-sm transition-all"
                                    >
                                        Adicionar zona ao mapa
                                    </button>
                                </div>
                            )}

                            {/* Mapa Google Maps com círculos */}
                            <DeliveryMapSection zones={deliveryZones} center={mapCenter} />

                            {/* Legenda / lista de zonas */}
                            <div className="space-y-2">
                                {[...deliveryZones].sort((a, b) => a.radiusKm - b.radiusKm).map(zone => {
                                    const isEditing = editingZoneId === zone.id;
                                    return (
                                        <div key={zone.id} className={`border bg-background-dark rounded-xl transition-all ${isEditing ? 'border-primary/50' : 'border-border-dark/40'}`}>
                                            {isEditing ? (
                                                /* ── Modo edição inline ── */
                                                <div className="p-3 space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1">Nome</label>
                                                            <input
                                                                value={zone.name}
                                                                onChange={e => setDeliveryZones(z => z.map(x => x.id === zone.id ? { ...x, name: e.target.value } : x))}
                                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1">Raio (km)</label>
                                                            <input
                                                                type="number" min="0.5" step="0.5"
                                                                value={zone.radiusKm}
                                                                onChange={e => setDeliveryZones(z => z.map(x => x.id === zone.id ? { ...x, radiusKm: parseFloat(e.target.value) || x.radiusKm } : x))}
                                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1">Taxa (R$)</label>
                                                            <input
                                                                type="number" min="0" step="0.5"
                                                                value={zone.fee}
                                                                onChange={e => setDeliveryZones(z => z.map(x => x.id === zone.id ? { ...x, fee: parseFloat(e.target.value) || 0 } : x))}
                                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1">Mínimo (R$)</label>
                                                            <input
                                                                type="number" min="0" step="1"
                                                                value={zone.minOrder}
                                                                onChange={e => setDeliveryZones(z => z.map(x => x.id === zone.id ? { ...x, minOrder: parseFloat(e.target.value) || 0 } : x))}
                                                                className="w-full bg-card-dark border border-border-dark rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-slate-500 mb-1.5">Cor</label>
                                                        <div className="flex gap-2">
                                                            {ZONE_COLORS.map(c => (
                                                                <button
                                                                    key={c}
                                                                    onClick={() => setDeliveryZones(z => z.map(x => x.id === zone.id ? { ...x, color: c } : x))}
                                                                    className="w-6 h-6 rounded-full transition-all shrink-0"
                                                                    style={{
                                                                        backgroundColor: c,
                                                                        outline: zone.color === c ? `2px solid #fff` : 'none',
                                                                        outlineOffset: '2px',
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={() => setEditingZoneId(null)}
                                                            className="flex-1 bg-primary hover:bg-primary/80 text-white text-xs font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-xs">check</span>
                                                            Salvar
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingZoneId(null)}
                                                            className="px-3 py-1.5 text-slate-400 hover:text-white border border-border-dark rounded-lg text-xs transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-xs">close</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ── Modo visualização ── */
                                                <div className="flex items-center justify-between p-3 group">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-4 h-4 rounded-full shrink-0"
                                                            style={{ backgroundColor: zone.color, outline: `2px solid ${zone.color}`, outlineOffset: '2px' }}
                                                        />
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{zone.name}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                <span className="text-slate-300 font-mono">{zone.radiusKm} km</span>
                                                                {' · '}
                                                                Taxa: <span className="text-emerald-400 font-mono">{fmt(zone.fee)}</span>
                                                                {' · '}
                                                                Mín: <span className="font-mono">{fmt(zone.minOrder)}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setEditingZoneId(zone.id)}
                                                            className="p-1.5 text-slate-500 hover:text-primary transition-colors"
                                                            title="Editar zona"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setDeliveryZones(z => z.filter(x => x.id !== zone.id))}
                                                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                                                            title="Remover zona"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {deliveryZones.length === 0 && (
                                    <p className="text-center text-xs text-slate-600 py-4">Nenhuma zona cadastrada. Adicione uma acima.</p>
                                )}
                            </div>
                        </section>

                        <section className="bg-card-dark border border-border-dark rounded-2xl p-5 space-y-2">
                            <h2 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-primary text-sm">credit_card</span>
                                Formas de Pagamento
                            </h2>
                            {([
                                { key: 'pix' as const, label: 'PIX', icon: 'bolt' },
                                { key: 'card' as const, label: 'Cartão', icon: 'credit_card' },
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
                            <StatCard label="Receita do Dia" value={fmt(todayRev)} icon="payments" iconClass="bg-emerald-500/10 text-emerald-400" delta="+12% vs ontem" />
                            <StatCard label="Pedidos Hoje" value={String(todayOrders)} icon="receipt_long" iconClass="bg-blue-500/10 text-blue-400" delta="+3 vs ontem" />
                            <StatCard label="Ticket Médio" value={fmt(avgTicket)} icon="bar_chart" iconClass="bg-violet-500/10 text-violet-400" />
                            <StatCard label="Tempo Médio" value="38 min" icon="schedule" iconClass="bg-amber-500/10 text-amber-400" delta="-2 min vs ontem" />
                        </div>

                        {/* Distribuição por status */}
                        <div className="bg-card-dark border border-border-dark rounded-2xl p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">donut_small</span>
                                Distribuição por Status
                            </h2>
                            <div className="space-y-3">
                                {DELIVERY_STATUSES.map(s => {
                                    const m = STATUS_META[s]!;
                                    const count = deliveryOrders.filter(o => o.status === s).length;
                                    const pct = deliveryOrders.length > 0 ? (count / deliveryOrders.length) * 100 : 0;
                                    return (
                                        <div key={s} className="flex items-center gap-3">
                                            <span className={`text-xs font-bold w-20 shrink-0 ${m.color}`}>{m.label}</span>
                                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${m.bg.replace('/10', '')}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment share */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'PIX', icon: 'bolt', pct: 62, bar: 'bg-emerald-400', ic: 'text-emerald-400 bg-emerald-400/10' },
                                { label: 'Cartão', icon: 'credit_card', pct: 28, bar: 'bg-blue-400', ic: 'text-blue-400 bg-blue-400/10' },
                                { label: 'Dinheiro', icon: 'payments', pct: 10, bar: 'bg-amber-400', ic: 'text-amber-400 bg-amber-400/10' },
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
                                {[0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 8, 10, 13, 15, 18, 12, 8, 5, 3, 1, 0].map((v, h) => (
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