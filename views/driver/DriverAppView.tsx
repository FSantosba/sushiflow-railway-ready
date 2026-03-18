import React, { useState, useEffect, useRef } from 'react';
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
        'Direto': { label: 'Próprio', cls: 'bg-primary/20 text-primary border-primary/30' },
        'iFood': { label: 'iFood', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
        'UberEats': { label: 'Uber', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    };
    const s = map[platform] ?? { label: platform, cls: 'bg-white/10 text-slate-400 border-white/10' };
    return (
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ─── Confete ─────────────────────────────────────────────
const ConfettiCelebration: React.FC = () => {
    const pieces = ['🎉', '🍣', '✅', '⭐', '🏍️', '💰', '🎊'];
    return (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} className="absolute text-2xl animate-bounce"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 65}%`,
                        animationDelay: `${Math.random() * 0.8}s`,
                        animationDuration: `${0.5 + Math.random() * 0.8}s`,
                        opacity: 0.3 + Math.random() * 0.7,
                    }}>
                    {pieces[i % pieces.length]}
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

// ─── Componente Principal ─────────────────────────────────
const DriverAppView: React.FC = () => {
    const { orders, updateOrder } = useOrders();
    const { currentUser } = useAuth();

    const [routes, setRoutes] = useState<RouteGroup[]>([]);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
    const [completedCount, setCompletedCount] = useState(0);
    const [showHistory, setShowHistory] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [turnoHistory, setTurnoHistory] = useState<CompletedDelivery[]>([]);
    const [walletData, setWalletData] = useState<any>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const prevCount = useRef(0);

    const driverName = currentUser?.name?.split(' ')[0] ?? 'Motoboy';
    const apiEnabled = isMapsApiConfigured();

    const availableOrders = orders.filter(o =>
        o.status === OrderStatus.EM_PREPARO &&
        (o.platform === 'Direto' || o.platform === 'iFood' || o.platform === 'UberEats')
    );

    const activeRouteOrders = orders.filter(o =>
        o.deliveryMan === 'Motoboy Atual' && o.status === OrderStatus.EM_ROTA
    );
    const totalRouteOrders = activeRouteOrders.length + completedCount;
    const estimatedMinutesLeft = activeRouteOrders.length * 12;

    // ── Serviço de Rastreamento Background (Cada 15s em Rota) ──
    const watchIdRef = useRef<number | null>(null);
    const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        // Se não tiver pedido ativo na rua, limpa tracking e aborta
        if (activeRouteOrders.length === 0) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return;
        }

        // Pede permissão e inicia o tracking se estiver com pedidos EM_ROTA
        if ('geolocation' in navigator && watchIdRef.current === null) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    lastPosRef.current = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                },
                (error) => console.error('[Tracking] Erro Geolocation:', error),
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
        }

        // Loop de sincronização com o backend (A cada 15 segundos)
        const pendingSyncsRef = { current: [] as any[] };

        const syncInterval = setInterval(async () => {
            if (!lastPosRef.current) return;
            
            // 1. Preparamos o pacote de sincronização para todos os pedidos ativos
            const currentSyncs = activeRouteOrders.map(order => ({
                pedido_id: order.id,
                lat: lastPosRef.current!.lat,
                lng: lastPosRef.current!.lng,
                timestamp: Date.now()
            }));

            // 2. Unimos com o que eventualmente falhou antes
            const totalToSync = [...pendingSyncsRef.current, ...currentSyncs];
            pendingSyncsRef.current = []; // limpamos temporariamente para tentar o envio

            for (const item of totalToSync) {
                try {
                    await axios.post('http://localhost:3001/api/rastreamento', item);
                    console.log(`[Tracking] Posição sync ok: ${item.pedido_id}`);
                } catch (err) {
                    console.error(`[Tracking] Falha no envio, salvando para retry: ${item.pedido_id}`);
                    // Se falhar de novo, volta pra fila de pendentes (limitando a fila para não explodir memória)
                    if (pendingSyncsRef.current.length < 100) {
                        pendingSyncsRef.current.push(item);
                    }
                }
            }
        }, 15000);

        return () => {
            clearInterval(syncInterval);
        };
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

    useEffect(() => {
        if (showWallet) fetchWallet();
    }, [showWallet]);

    // ── Recalcula rotas quando os pedidos disponíveis mudam ──
    useEffect(() => {
        if (activeRouteOrders.length > 0) return; // já saiu na rua

        setRoutesLoading(true);
        const payload = availableOrders.map(o => ({
            id: o.id,
            address: o.address ?? '',
            customer: o.customer,
        }));

        buildOptimizedRoutes(payload, 3)
            .then(setRoutes)
            .finally(() => setRoutesLoading(false));

        // Vibração quando nova rota aparece
        if (availableOrders.length > prevCount.current && prevCount.current === 0) {
            navigator.vibrate?.([200, 100, 200, 100, 300]);
        }
        prevCount.current = availableOrders.length;
    }, [availableOrders.length]);

    const handleAcceptRoute = (route: RouteGroup) => {
        route.orderIds.forEach(id => {
            updateOrder(id, { status: OrderStatus.EM_ROTA, deliveryMan: 'Motoboy Atual' });
        });
        navigator.vibrate?.(100);
    };

    const handleConfirmDelivery = async () => {
        if (!confirmingOrderId) return;
        const order = orders.find(o => o.id === confirmingOrderId);
        if (order) {
            try {
                // Sincroniza com o backend para registrar o crédito
                await axios.post('http://localhost:3001/api/admin/confirm-delivery', { 
                    pedido_id: order.id
                });
                
                // Na vdd devíamos ter um endpoint de "entregar_pedido"
                // Mas vamos usar o updateOrder do context que já funciona pra UI
                updateOrder(confirmingOrderId, { status: OrderStatus.ENTREGUE });
                
                setTurnoHistory(prev => [...prev, {
                    id: order.id, customer: order.customer,
                    address: order.address ?? '', total: order.total,
                    platform: order.platform, completedAt: Date.now(),
                }]);
                
                setCompletedCount(c => {
                    const next = c + 1;
                    if (next >= totalRouteOrders) {
                        setTimeout(() => {
                            setShowCelebration(true);
                            setTimeout(() => setShowCelebration(false), 3500);
                        }, 300);
                    }
                    return next;
                });
            } catch (err) {
                console.error("Erro ao confirmar entrega no server:", err);
            }
        }
        navigator.vibrate?.([100, 50, 100]);
        setConfirmingOrderId(null);
    };

    const handleWithdraw = async () => {
        if (!currentUser?.id || isWithdrawing) return;
        setIsWithdrawing(true);
        try {
            const { data } = await axios.post(`http://localhost:3001/api/driver/withdraw/${currentUser.id}`);
            alert(data.message);
            fetchWallet();
        } catch (err: any) {
            alert(err.response?.data?.error || "Erro ao solicitar saque.");
        } finally {
            setIsWithdrawing(false);
        }
    };

    const turnoTotal = turnoHistory.reduce((a, d) => a + d.total, 0);

    // ─────────────────────────────────────────────────────────
    return (
        <div className="h-full w-full flex justify-center bg-[#000000] overflow-hidden font-sans">
            {showCelebration && <ConfettiCelebration />}
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
                            {/* ✨ Indicador: API ativa ou modo local */}
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

                    {/* ✨ Barra de progresso */}
                    {(activeRouteOrders.length > 0 || completedCount > 0) && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-in slide-in-from-top-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Progresso</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-white">{completedCount}/{totalRouteOrders}</span>
                                    {estimatedMinutesLeft > 0 && (
                                        <span className="text-[10px] font-bold text-slate-500">~{estimatedMinutesLeft} min restantes</span>
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

                            {activeRouteOrders.map((order, index) => (
                                <div key={order.id} className="bg-[#0d1117] border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 rounded-l-3xl" />
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parada {index + 1}</p>
                                                <PlatformBadge platform={order.platform} />
                                            </div>
                                            <h3 className="text-lg font-black text-white">{order.customer}</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">A Cobrar</p>
                                            <span className="text-lg font-black italic text-emerald-400">R$ {order.total.toFixed(2)}</span>
                                        </div>
                                    </div>

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

                                    {/* ✨ Botões de navegação */}
                                    <div className="flex gap-2 mb-3">
                                        <button onClick={() => window.open(buildWazeMultiStopUrl([order.address ?? order.customer]), '_blank')}
                                            className="flex-1 py-3 bg-[#0a1f2e] hover:bg-[#0d2638] border border-[#33d4ff]/20 text-[#33d4ff] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                            🚗 Waze
                                        </button>
                                        <button onClick={() => window.open(buildMapsMultiStopUrl([order.address ?? order.customer]), '_blank')}
                                            className="flex-1 py-3 bg-[#0a1a1e] hover:bg-[#0d2025] border border-emerald-500/20 text-emerald-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                            🗺️ Maps
                                        </button>
                                        {order.deliveryPhone && (
                                            <button onClick={() => {
                                                const msg = encodeURIComponent(`Olá ${order.customer}, sou o entregador do SushiFlow e estou a caminho!`);
                                                window.open(`https://wa.me/55${order.deliveryPhone!.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                            }}
                                                className="flex-1 py-3 bg-[#0a1f14] hover:bg-[#0d2619] border border-[#25D366]/20 text-[#25D366] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all">
                                                📱 Zap
                                            </button>
                                        )}
                                    </div>

                                    <button onClick={() => setConfirmingOrderId(order.id)}
                                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-colors shadow-[0_5px_20px_rgba(16,185,129,0.25)]">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        Confirmar Entrega
                                    </button>
                                </div>
                            ))}

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
                                {/* ✨ Status da otimização */}
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
                                                            {/* ✨ Bairro real extraído */}
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{route.region}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-black block mb-1">
                                                            {route.orderIds.length} parada{route.orderIds.length !== 1 ? 's' : ''}
                                                        </span>
                                                        {/* ✨ Tempo e distância estimados */}
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
                                                            <PlatformBadge platform={o.platform} />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* ✨ Botões de rota multi-parada + aceitar */}
                                                <div className="flex gap-2 mb-3">
                                                    <button onClick={() => window.open(route.wazeUrl, '_blank')}
                                                        className="flex-1 py-2.5 bg-[#0a1f2e] border border-[#33d4ff]/20 text-[#33d4ff] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1 transition-all hover:bg-[#0d2638]">
                                                        🚗 Waze
                                                    </button>
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
                return (
                    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: 480, margin: '0 auto' }}>
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmingOrderId(null)} />
                        <div className="relative z-10 w-full bg-[#0d1117] border-t border-white/10 rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom-8">
                            <div className="size-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                                <span className="material-symbols-outlined text-emerald-400 text-3xl">where_to_vote</span>
                            </div>
                            <h3 className="text-xl font-black text-white text-center italic mb-1">Confirmar Entrega?</h3>
                            <p className="text-slate-400 text-sm text-center font-bold mb-1">{order.customer}</p>
                            <p className="text-slate-600 text-xs text-center mb-8">{order.address}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmingOrderId(null)}
                                    className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-300 rounded-2xl font-black text-sm uppercase hover:bg-white/10 transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleConfirmDelivery}
                                    className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm uppercase shadow-[0_8px_24px_rgba(16,185,129,0.3)] transition-all">
                                    ✓ Entregue!
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
                                    </div>
                                    <span className="text-sm font-black text-emerald-400 shrink-0">R$ {d.total.toFixed(2)}</span>
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
                        {/* Header Carteira */}
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white italic">Minha Carteira</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo e Recebimentos</p>
                            </div>
                            <button onClick={() => setShowWallet(false)} className="size-10 bg-white/5 rounded-full flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Card de Saldo */}
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
                                className="w-full py-4 bg-white text-primary rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform disabled:opacity-50"
                            >
                                {isWithdrawing ? 'Processando...' : 'Solicitar Saque (Pix)'}
                            </button>
                        </div>

                        {/* Excellence Ranking */}
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

                        {/* Extrato do Dia */}
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
                                            <p className="text-xs font-black text-white">{t.tipo === 'credito_entrega' ? `Entrega #${t.pedido_id?.slice(0,4)}` : 'Saque Solicitado'}</p>
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
