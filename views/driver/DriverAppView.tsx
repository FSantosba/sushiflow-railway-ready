import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useOrders } from '../../context/OrdersContext';
import { useAuth } from '../../context/AuthContext';
import { OrderStatus, Order } from '../../types';
import {
    buildOptimizedRoutes,
    buildWazeMultiStopUrl,
    buildMapsMultiStopUrl,
    extractNeighborhood,
    isMapsApiConfigured,
    RouteGroup,
} from '../../utils/mapsService';

// ─── Badge de Plataforma ─────────────────────────────────
const PlatformBadge: React.FC<{ platform: string }> = ({ platform }) => {
    const map: Record<string, { label: string; cls: string }> = {
        'Direto':    { label: 'Próprio',  cls: 'bg-primary/20 text-primary border-primary/30' },
        'iFood':     { label: 'iFood',    cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
        'UberEats':  { label: 'Uber',     cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
        'Rappi':     { label: 'Rappi',    cls: 'bg-orange-400/20 text-orange-300 border-orange-400/30' },
        'Goomer':    { label: 'Goomer',   cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    };
    const s = map[platform] ?? { label: platform, cls: 'bg-white/10 text-slate-400 border-white/10' };
    return (
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ─── Toast ───────────────────────────────────────────────
interface ToastMsg { id: number; text: string; type: 'success' | 'error' | 'info' }
const Toast: React.FC<{ toasts: ToastMsg[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-[90%] max-w-[400px] pointer-events-none">
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border pointer-events-auto cursor-pointer animate-in slide-in-from-top-3 duration-300
                    ${t.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-300' :
                      t.type === 'error'   ? 'bg-rose-900/90 border-rose-500/40 text-rose-300' :
                                             'bg-[#1a1f2e]/95 border-white/10 text-slate-200'}`}>
                <span className="material-symbols-outlined text-sm shrink-0">
                    {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
                </span>
                <p className="text-xs font-bold flex-1">{t.text}</p>
            </div>
        ))}
    </div>
);

// ─── Confete (posições estabilizadas com useMemo) ─────────
const ConfettiCelebration: React.FC = () => {
    const pieces = ['🎉', '🍣', '✅', '⭐', '🏍️', '💰', '🎊'];
    const items = useMemo(() => Array.from({ length: 22 }).map((_, i) => ({
        left: `${(i * 4.7 + 3) % 100}%`,
        top: `${(i * 3.1 + 5) % 65}%`,
        delay: `${(i * 0.037) % 0.8}s`,
        duration: `${0.5 + (i * 0.038) % 0.8}s`,
        opacity: 0.3 + (i * 0.032) % 0.7,
        emoji: pieces[i % pieces.length],
    })), []);
    return (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            {items.map((item, i) => (
                <div key={i} className="absolute text-2xl animate-bounce"
                    style={{ left: item.left, top: item.top, animationDelay: item.delay, animationDuration: item.duration, opacity: item.opacity }}>
                    {item.emoji}
                </div>
            ))}
        </div>
    );
};

// ─── Tipos internos ───────────────────────────────────────
interface CompletedDelivery {
    id: string; customer: string; address: string;
    total: number; platform: string; completedAt: number;
}

// ─── Utilidades ──────────────────────────────────────────
/** Plataformas que cobram o cliente online — motoboy não precisa cobrar */
const PREPAID_PLATFORMS = new Set(['iFood', 'UberEats', 'Rappi', 'Goomer']);

const TURNO_STORAGE_KEY = 'sushiflow_driver_turno';

function loadTurno(): CompletedDelivery[] {
    try {
        const raw = localStorage.getItem(TURNO_STORAGE_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        // Invalida se for de outro dia
        if (data.date !== new Date().toDateString()) return [];
        return data.history ?? [];
    } catch { return []; }
}

function saveTurno(history: CompletedDelivery[]) {
    localStorage.setItem(TURNO_STORAGE_KEY, JSON.stringify({
        date: new Date().toDateString(),
        history,
    }));
}

// ─── Componente Principal ─────────────────────────────────
const DriverAppView: React.FC = () => {
    const { orders, updateOrder } = useOrders();
    const { currentUser } = useAuth();

    const [routes, setRoutes] = useState<RouteGroup[]>([]);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false); // #5 — Loading ao confirmar
    const [completedCount, setCompletedCount] = useState(0);
    const [showHistory, setShowHistory] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [turnoHistory, setTurnoHistory] = useState<CompletedDelivery[]>(loadTurno); // #9 — Persiste
    const [walletData, setWalletData] = useState<any>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [activeRouteETA, setActiveRouteETA] = useState<number | null>(null); // #4 — Tempo real
    const [collapsedOrders, setCollapsedOrders] = useState<Set<string>>(new Set()); // #8 — Colapso
    const [toasts, setToasts] = useState<ToastMsg[]>([]); // #2 — Custom toast
    const [lastOrderTime, setLastOrderTime] = useState<number | null>(null); // #11 — Timestamp vazio
    const prevCount = useRef(0);

    const driverName = currentUser?.name?.split(' ')[0] ?? 'Motoboy';
    const driverKey = currentUser?.id ?? 'Motoboy Atual'; // #1 — Usa ID real
    const apiEnabled = isMapsApiConfigured();

    // ── Toast helpers ───────────────────────────────────────
    const addToast = useCallback((text: string, type: ToastMsg['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

    // #1 — Filtro correto: usa o driverKey baseado no ID real
    const availableOrders = orders.filter(o =>
        o.status === OrderStatus.EM_PREPARO &&
        (o.platform === 'Direto' || o.platform === 'iFood' || o.platform === 'UberEats' || o.platform === 'Rappi' || o.platform === 'Goomer')
    );

    const activeRouteOrders = orders.filter(o =>
        o.deliveryMan === driverKey && o.status === OrderStatus.EM_ROTA
    );
    const totalRouteOrders = activeRouteOrders.length + completedCount;

    // #4 — Usa tempo real salvo da rota, não o placeholder de 12 min/parada
    const estimatedMinutesLeft = activeRouteETA !== null
        ? Math.max(0, activeRouteETA - completedCount * 12)
        : activeRouteOrders.length * 12;

    // ── GPS Tracking ─────────────────────────────────────────
    const watchIdRef = useRef<number | null>(null);
    const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (activeRouteOrders.length === 0) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return;
        }

        if ('geolocation' in navigator && watchIdRef.current === null) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    lastPosRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
                },
                (error) => console.error('[Tracking] Erro Geolocation:', error),
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
        }

        const pendingSyncsRef = { current: [] as any[] };
        const syncInterval = setInterval(async () => {
            if (!lastPosRef.current) return;
            const currentSyncs = activeRouteOrders.map(order => ({
                pedido_id: order.id, lat: lastPosRef.current!.lat, lng: lastPosRef.current!.lng, timestamp: Date.now()
            }));
            const totalToSync = [...pendingSyncsRef.current, ...currentSyncs];
            pendingSyncsRef.current = [];
            for (const item of totalToSync) {
                try {
                    await axios.post('http://localhost:3001/api/rastreamento', item);
                } catch {
                    if (pendingSyncsRef.current.length < 100) pendingSyncsRef.current.push(item);
                }
            }
        }, 15000);
        return () => clearInterval(syncInterval);
    }, [activeRouteOrders]);

    const fetchWallet = async () => {
        if (!currentUser?.id) return;
        try {
            const { data } = await axios.get(`http://localhost:3001/api/driver/wallet/${currentUser.id}`);
            setWalletData(data);
        } catch (err) {
            console.error("Erro ao buscar carteira:", err);
        }
    };

    useEffect(() => { if (showWallet) fetchWallet(); }, [showWallet]);

    // ── Recalcula rotas ────────────────────────────────────
    useEffect(() => {
        if (activeRouteOrders.length > 0) return;
        setRoutesLoading(true);
        const payload = availableOrders.map(o => ({ id: o.id, address: o.address ?? '', customer: o.customer ?? '' }));
        buildOptimizedRoutes(payload, 3).then(setRoutes).finally(() => setRoutesLoading(false));

        if (availableOrders.length > prevCount.current) {
            if (prevCount.current === 0) navigator.vibrate?.([200, 100, 200, 100, 300]);
            setLastOrderTime(Date.now()); // #11
        }
        prevCount.current = availableOrders.length;
    }, [availableOrders.length]);

    // #9 — Persiste turnoHistory no localStorage sempre que muda
    useEffect(() => { saveTurno(turnoHistory); }, [turnoHistory]);

    // ── Aceitar rota ────────────────────────────────────────
    const handleAcceptRoute = (route: RouteGroup) => {
        route.orderIds.forEach(id => {
            updateOrder(id, { status: OrderStatus.EM_ROTA, deliveryMan: driverKey }); // #1
        });
        setActiveRouteETA(route.estimatedMinutes); // #4 — Salva o tempo real da rota
        navigator.vibrate?.(100);
    };

    // ── Confirmar entrega ───────────────────────────────────
    const handleConfirmDelivery = async () => {
        if (!confirmingOrderId || isConfirming) return;
        const order = orders.find(o => o.id === confirmingOrderId);
        if (!order) return;

        setIsConfirming(true); // #5
        try {
            await axios.post('http://localhost:3001/api/admin/confirm-delivery', { pedido_id: order.id });
            updateOrder(confirmingOrderId, { status: OrderStatus.ENTREGUE });
            const delivered: CompletedDelivery = {
                id: order.id, customer: order.customer ?? '',
                address: order.address ?? '', total: order.total ?? 0,
                platform: order.platform ?? 'Direto', completedAt: Date.now(),
            };
            setTurnoHistory(prev => [...prev, delivered]);
            setCompletedCount(c => {
                const next = c + 1;
                if (next >= totalRouteOrders) {
                    setTimeout(() => { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3500); }, 300);
                }
                return next;
            });
            // #8 — Colapsa automaticamente o pedido confirmado
            setCollapsedOrders(prev => new Set([...prev, confirmingOrderId]));
            addToast(`✅ Entrega de ${order.customer} confirmada!`, 'success'); // #2
        } catch (err) {
            console.error("Erro ao confirmar entrega no server:", err);
            addToast('Falha na sincronização com o servidor. Entrega salva localmente.', 'error'); // #2
            // Mesmo sem backend, confirma localmente para não bloquear o motoboy
            updateOrder(confirmingOrderId, { status: OrderStatus.ENTREGUE });
        } finally {
            setIsConfirming(false);
        }
        navigator.vibrate?.([100, 50, 100]);
        setConfirmingOrderId(null);
    };

    // ── Saque ────────────────────────────────────────────────
    const handleWithdraw = async () => {
        if (!currentUser?.id || isWithdrawing) return;
        setIsWithdrawing(true);
        try {
            const { data } = await axios.post(`http://localhost:3001/api/driver/withdraw/${currentUser.id}`);
            addToast(data.message || 'Saque solicitado com sucesso! 💸', 'success'); // #2
            fetchWallet();
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Erro ao solicitar saque.', 'error'); // #2
        } finally {
            setIsWithdrawing(false);
        }
    };

    const turnoTotal = turnoHistory.reduce((a, d) => a + d.total, 0);

    // ─────────────────────────────────────────────────────────
    return (
        <div className="h-full w-full flex justify-center bg-[#000000] overflow-hidden font-sans">
            {showCelebration && <ConfettiCelebration />}
            {/* #2 — Toast global */}
            <Toast toasts={toasts} onRemove={removeToast} />

            <div className="w-full max-w-[480px] h-full bg-[#000000] flex flex-col border-x border-white/5 mx-auto">

                {/* ── Header ─────────────────────────────── */}
                <header className="px-6 py-6 bg-gradient-to-b from-black to-transparent shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-black italic tracking-tighter text-white">
                                SushiFlow<span className="text-orange-500">.</span>Driver
                            </h1>
                            <p className="text-xs text-slate-400 font-bold">Olá, {driverName} 👋</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase border ${apiEnabled
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-white/5 text-slate-500 border-white/5'
                                }`}>
                                {apiEnabled ? '🗺️ Maps ativo' : '📍 Modo local'}
                            </span>

                            {turnoHistory.length > 0 && (
                                <button onClick={() => setShowHistory(true)}
                                    className="relative px-3 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-1.5 text-slate-300 hover:bg-white/10 transition-all">
                                    <span className="material-symbols-outlined text-sm">history</span>
                                    <span className="text-[10px] font-black">{turnoHistory.length}</span>
                                    <span className="absolute -top-1 -right-1 size-2 bg-orange-500 rounded-full"></span>
                                </button>
                            )}

                            <button onClick={() => setShowWallet(true)}
                                className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-white text-lg">account_balance_wallet</span>
                                {walletData?.saldo > 0 && (
                                    <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 rounded-full border-2 border-black" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Barra de progresso */}
                    {(activeRouteOrders.length > 0 || completedCount > 0) && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-in slide-in-from-top-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Progresso</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-white">{completedCount}/{totalRouteOrders}</span>
                                    {estimatedMinutesLeft > 0 && (
                                        <span className="text-[10px] font-bold text-slate-500">
                                            ~{estimatedMinutesLeft} min restantes
                                            {/* #4 — Indica se é tempo real ou estimativa */}
                                            {activeRouteETA !== null && <span className="text-emerald-600"> · real</span>}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full transition-all duration-700"
                                    style={{ width: totalRouteOrders > 0 ? `${(completedCount / totalRouteOrders) * 100}%` : '0%' }}
                                />
                            </div>
                        </div>
                    )}
                </header>

                {/* ── Main ───────────────────────────────── */}
                <main className="flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar">

                    {/* ── NA RUA: entregas ativas ─── */}
                    {activeRouteOrders.length > 0 ? (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Na Rua
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                    {activeRouteOrders.length} parada{activeRouteOrders.length !== 1 ? 's' : ''} restante{activeRouteOrders.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {activeRouteOrders.map((order, index) => {
                                const isCollapsed = collapsedOrders.has(order.id);
                                const isPrepaid = PREPAID_PLATFORMS.has(order.platform ?? ''); // #6

                                return (
                                    <div key={order.id} className="bg-[#0d1117] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 rounded-l-3xl" />

                                        {/* #8 — Header clicável para colapsar */}
                                        <button
                                            className="w-full p-5 text-left flex justify-between items-center"
                                            onClick={() => setCollapsedOrders(prev => {
                                                const next = new Set(prev);
                                                next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                                                return next;
                                            })}>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parada {index + 1}</p>
                                                        <PlatformBadge platform={order.platform ?? 'Direto'} />
                                                    </div>
                                                    <h3 className="text-base font-black text-white">{order.customer}</h3>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    {/* #6 — Distingue pago vs. a cobrar */}
                                                    {isPrepaid ? (
                                                        <div>
                                                            <p className="text-[9px] text-emerald-600 font-black uppercase">✅ Pago pelo App</p>
                                                            <span className="text-sm font-black italic text-slate-500 line-through">R$ {(order.total ?? 0).toFixed(2)}</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase">A Cobrar</p>
                                                            <span className="text-lg font-black italic text-emerald-400">R$ {(order.total ?? 0).toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="material-symbols-outlined text-slate-600 text-sm transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                                    expand_more
                                                </span>
                                            </div>
                                        </button>

                                        {/* #8 — Conteúdo colapsável */}
                                        {!isCollapsed && (
                                            <div className="px-5 pb-5">
                                                <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3 flex gap-3 items-start">
                                                    <span className="material-symbols-outlined text-slate-500 shrink-0 text-base mt-0.5">location_on</span>
                                                    <p className="text-sm font-bold text-white leading-snug">{order.address || 'Endereço não informado'}</p>
                                                </div>

                                                {order.notes && (
                                                    <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20 mb-3 flex gap-3 items-start">
                                                        <span className="material-symbols-outlined text-amber-400 shrink-0 text-base mt-0.5">sticky_note_2</span>
                                                        <p className="text-xs font-bold text-amber-300 leading-snug">{order.notes}</p>
                                                    </div>
                                                )}

                                                {/* Botões de navegação */}
                                                <div className="flex gap-2 mb-3">
                                                    {/* #3 — Tooltip de limitação do Waze */}
                                                    <div className="flex-1 relative group">
                                                        <button
                                                            onClick={() => window.open(buildWazeMultiStopUrl([order.address ?? order.customer ?? '']), '_blank')}
                                                            className="w-full py-3 bg-[#0a1f2e] hover:bg-[#0d2638] border border-[#33d4ff]/20 text-[#33d4ff] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                                            🚗 Waze
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1f2e] border border-white/10 rounded-lg text-[9px] text-slate-400 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                            1 parada por vez
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => window.open(buildMapsMultiStopUrl([order.address ?? order.customer ?? '']), '_blank')}
                                                        className="flex-1 py-3 bg-[#0a1a1e] hover:bg-[#0d2025] border border-emerald-500/20 text-emerald-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                                        🗺️ Maps
                                                    </button>
                                                    {order.clientePhone && (
                                                        <button
                                                            onClick={() => {
                                                                const msg = encodeURIComponent(`Olá ${order.customer ?? 'cliente'}, sou o entregador do SushiFlow e estou a caminho!`);
                                                                window.open(`https://wa.me/55${order.clientePhone!.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                                            }}
                                                            className="flex-1 py-3 bg-[#0a1f14] hover:bg-[#0d2619] border border-[#25D366]/20 text-[#25D366] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                                            📱 Zap
                                                        </button>
                                                    )}
                                                </div>

                                                {/* #5 — Botão com loading state */}
                                                <button onClick={() => setConfirmingOrderId(order.id)}
                                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-colors shadow-[0_5px_20px_rgba(16,185,129,0.25)]">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    Confirmar Entrega
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {activeRouteOrders.length === 0 && completedCount > 0 && (
                                <div className="text-center py-16">
                                    <div className="size-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                                        <span className="text-5xl">🍣</span>
                                    </div>
                                    <h3 className="text-white font-black text-2xl italic mb-2">Rota Concluída! 🎉</h3>
                                    <p className="text-slate-400 text-sm mb-1">{completedCount} entrega{completedCount !== 1 ? 's' : ''} realizadas</p>
                                    <p className="text-emerald-400 font-black text-lg">R$ {turnoTotal.toFixed(2)} cobrado</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── ROTAS DISPONÍVEIS ─── */
                        <div>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Rotas Disponíveis</h2>
                                {routesLoading && (
                                    <span className="text-[10px] text-orange-400 font-bold animate-pulse flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">route</span>
                                        Otimizando...
                                    </span>
                                )}
                                {!routesLoading && routes.length > 0 && (
                                    <span className="text-[10px] text-slate-500 font-bold">
                                        {apiEnabled ? '🗺️ por distância real' : '📍 por bairro'}
                                    </span>
                                )}
                            </div>

                            {routes.length === 0 && !routesLoading ? (
                                <div className="text-center py-20 opacity-40">
                                    <span className="material-symbols-outlined text-5xl mb-3 text-slate-500 block">coffee</span>
                                    <p className="text-sm font-bold text-slate-400">Nenhuma rota disponível.</p>
                                    <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto mt-2">
                                        Aguarde a cozinha liberar pedidos de delivery.
                                    </p>
                                    {/* #11 — Timestamp do último pedido */}
                                    {lastOrderTime && (
                                        <p className="text-[9px] text-slate-700 mt-3">
                                            Último pedido: {new Date(lastOrderTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {routes.map(route => {
                                        const routeOrders = orders.filter(o => route.orderIds.includes(o.id));
                                        return (
                                            <div key={route.id} className="bg-[#0d1117] border border-white/5 rounded-3xl p-5 hover:border-orange-500/40 transition-colors">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-orange-500 text-lg">route</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-black text-white italic">Rota {route.id}</h3>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{route.region}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-black block mb-1">
                                                            {route.orderIds.length} parada{route.orderIds.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold block">
                                                            ~{route.estimatedMinutes} min
                                                            {route.totalDistanceKm > 0 && ` · ${route.totalDistanceKm} km`}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2.5 mb-5">
                                                    {routeOrders.map((o, i) => (
                                                        <div key={o.id} className="flex items-center gap-2 text-xs">
                                                            <span className="size-5 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                                            <span className="text-slate-300 font-bold truncate flex-1">{o.customer}</span>
                                                            <span className="text-slate-600 text-[9px] truncate max-w-[100px]">{extractNeighborhood(o.address ?? '')}</span>
                                                            <PlatformBadge platform={o.platform ?? 'Direto'} />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Botões Waze/Maps com tooltip #3 */}
                                                <div className="flex gap-2 mb-3">
                                                    <div className="flex-1 relative group">
                                                        <button
                                                            onClick={() => window.open(route.wazeUrl ?? '', '_blank')}
                                                            className="w-full py-2.5 bg-[#0a1f2e] border border-[#33d4ff]/20 text-[#33d4ff] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1 transition-all hover:bg-[#0d2638]">
                                                            🚗 Waze
                                                        </button>
                                                        {route.orderIds.length > 1 && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1f2e] border border-white/10 rounded-lg text-[9px] text-amber-400 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                                ⚠️ Waze: abre só 1ª parada
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => window.open(route.mapsUrl, '_blank')}
                                                        className="flex-1 py-2.5 bg-[#0a1a1e] border border-emerald-500/20 text-emerald-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1 transition-all hover:bg-[#0d2025]">
                                                        🗺️ Maps
                                                    </button>
                                                </div>

                                                <button onClick={() => handleAcceptRoute(route)}
                                                    className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-colors shadow-[0_10px_30px_rgba(249,115,22,0.25)]">
                                                    Aceitar Rota
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* ── Modal: Confirmar Entrega ───────────────── */}
            {confirmingOrderId && (() => {
                const order = orders.find(o => o.id === confirmingOrderId);
                if (!order) return null;
                const isPrepaid = PREPAID_PLATFORMS.has(order.platform ?? '');
                return (
                    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: 480, margin: '0 auto' }}>
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isConfirming && setConfirmingOrderId(null)} />
                        <div className="relative z-10 w-full bg-[#0d1117] border-t border-white/10 rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom-8">
                            <div className="size-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                                <span className="material-symbols-outlined text-emerald-400 text-3xl">where_to_vote</span>
                            </div>
                            <h3 className="text-xl font-black text-white text-center italic mb-1">Confirmar Entrega?</h3>
                            <p className="text-slate-400 text-sm text-center font-bold mb-1">{order.customer ?? ''}</p>
                            <p className="text-slate-600 text-xs text-center mb-2">{order.address ?? ''}</p>
                            {/* #6 — Aviso de pagamento no modal de confirmação */}
                            {isPrepaid ? (
                                <div className="mb-6 py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                                    <p className="text-emerald-400 text-xs font-black">✅ Pago pelo App — não cobrar do cliente</p>
                                </div>
                            ) : (
                                <div className="mb-6 py-2 px-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                                    <p className="text-amber-400 text-xs font-black">💵 A Cobrar: R$ {(order.total ?? 0).toFixed(2)}</p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmingOrderId(null)} disabled={isConfirming}
                                    className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-300 rounded-2xl font-black text-sm uppercase hover:bg-white/10 transition-all disabled:opacity-40">
                                    Cancelar
                                </button>
                                {/* #5 — Botão com loading state */}
                                <button onClick={handleConfirmDelivery} disabled={isConfirming}
                                    className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm uppercase shadow-[0_8px_24px_rgba(16,185,129,0.3)] transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
                                    {isConfirming
                                        ? <><span className="material-symbols-outlined text-sm animate-spin">refresh</span> Confirmando...</>
                                        : '✓ Entregue!'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Modal: Histórico do Turno ──────────────── */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: 480, margin: '0 auto' }}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
                    <div className="relative z-10 w-full bg-[#0d1117] border-t border-white/10 rounded-t-[2.5rem] p-6 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center mb-5 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-white italic">Histórico do Turno</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">
                                    {turnoHistory.length} entrega{turnoHistory.length !== 1 ? 's' : ''} ·{' '}
                                    <span className="text-emerald-400">R$ {turnoTotal.toFixed(2)}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowHistory(false)}
                                className="size-8 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {turnoHistory.map((d, i) => (
                                <div key={d.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="size-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                                        <span className="text-emerald-400 text-xs font-black">{i + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-white truncate">{d.customer}</p>
                                            <PlatformBadge platform={d.platform} />
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate">{d.address}</p>
                                        <p className="text-[9px] text-slate-700">{new Date(d.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className="text-sm font-black text-emerald-400 shrink-0">
                                        {PREPAID_PLATFORMS.has(d.platform) ? (
                                            <span className="text-slate-500 text-[10px]">Pago App</span>
                                        ) : `R$ ${d.total.toFixed(2)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Carteira Digital ───────────────── */}
            {showWallet && (
                <div className="fixed inset-0 z-[150] flex items-end justify-center" style={{ maxWidth: 480, margin: '0 auto' }}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowWallet(false)} />
                    <div className="relative z-10 w-full bg-[#0d1117] border-t border-white/10 rounded-t-[2.5rem] p-6 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white italic">Minha Carteira</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo e Recebimentos</p>
                            </div>
                            <button onClick={() => setShowWallet(false)} className="size-10 bg-white/5 rounded-full flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="bg-gradient-to-br from-primary to-orange-600 rounded-[2rem] p-8 mb-8 shadow-[0_20px_40px_rgba(230,99,55,0.2)]">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Saldo Disponível</p>
                                    <h2 className="text-4xl font-black text-white italic">R$ {parseFloat(walletData?.saldo || 0).toFixed(2)}</h2>
                                </div>
                                <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white">payments</span>
                                </div>
                            </div>
                            <button
                                onClick={handleWithdraw}
                                disabled={isWithdrawing || !walletData?.saldo || walletData?.saldo <= 0}
                                className="w-full py-4 bg-white text-primary rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform disabled:opacity-50">
                                {isWithdrawing ? 'Processando...' : 'Solicitar Saque (Pix)'}
                            </button>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="size-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-500">military_tech</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Ranking de Excelência</p>
                                    <h4 className="text-white font-bold">Nível Ouro</h4>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-emerald-400 font-black text-xl italic">{((walletData?.performance?.no_prazo / walletData?.performance?.total) * 100 || 100).toFixed(0)}%</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase">No Prazo</p>
                            </div>
                        </div>

                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-2">Extrato Recente</h4>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {walletData?.extrato?.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-xl flex items-center justify-center ${t.tipo === 'credito_entrega' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                            <span className="material-symbols-outlined text-sm">
                                                {t.tipo === 'credito_entrega' ? 'add_circle' : 'payout'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white">{t.tipo === 'credito_entrega' ? `Entrega #${t.pedido_id?.slice(0, 4)}` : 'Saque Solicitado'}</p>
                                            <p className="text-[10px] text-slate-500 font-bold">{new Date(t.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black italic ${t.tipo === 'credito_entrega' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                            {t.tipo === 'credito_entrega' ? '+' : '-'} R$ {parseFloat(t.valor).toFixed(2)}
                                        </p>
                                        <p className="text-[8px] text-slate-600 font-black uppercase">{t.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverAppView;
