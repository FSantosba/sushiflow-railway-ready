import React, { useState, useEffect } from 'react';
import { useTables } from '../../context/TableContext';
import { useOrders } from '../../context/OrdersContext';
import { useReservations } from '../../context/ReservationContext';
import { useCMV } from '../../context/CMVContext';
import { TableStatus, OrderStatus } from '../../types';
import type { CartItem } from '../../context/TableContext';
import { isCloudMode } from '../../utils/env';

const DashboardView: React.FC = () => {
    const { tables, openTables, closedTickets } = useTables();
    const { orders } = useOrders();
    const { waitingList } = useReservations();
    const { getOverallCMV } = useCMV();
    const [now, setNow] = useState(Date.now());
    const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month'>('today');
    const [cloudData, setCloudData] = useState<{faturamento: number, tickets: number, comandasFechadas: any[], comandasAbertas: number} | null>(null);

    useEffect(() => {
        if (isCloudMode()) {
             fetch('/api/cloud-dashboard')
                .then(r => r.json())
                .then(data => { if (data.ok) setCloudData(data) });
        }
    }, [periodFilter]);


    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Calcular métricas do turno
    const ocupadas = tables.filter(t => t.status === TableStatus.OCCUPIED).length;
    const livres = tables.filter(t => t.status === TableStatus.FREE).length;
    const limpeza = tables.filter(t => t.status === TableStatus.CLEANING).length;
    const reservadas = tables.filter(t => t.status === TableStatus.RESERVED).length;
    const ocupacaoRate = Math.round((ocupadas / tables.length) * 100);

    const pedidosAtivos = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PREPARING).length;
    const pedidosEntrega = orders.filter(o => o.status === OrderStatus.DELIVERY).length;

    // Filtro de período
    const periodMs = periodFilter === 'today' ? 24 * 60 * 60 * 1000
        : periodFilter === 'week' ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;

    const filteredTickets = closedTickets.filter(t => now - t.closedAt < periodMs);
    const isCloud = isCloudMode();
    const faturamentoHoje = isCloud ? (cloudData?.faturamento || 0) : filteredTickets.reduce((acc, t) => acc + t.total, 0);
    const ticketsHoje = isCloud ? (cloudData?.tickets || 0) : filteredTickets.length;
    const ticketMedio = ticketsHoje > 0 ? faturamentoHoje / ticketsHoje : 0;
    const ticketsExibidos = isCloud ? (cloudData?.comandasFechadas || []) : closedTickets;

    const faturamentoMesas = Object.entries(openTables).reduce((acc, [_, items]) => {
        return acc + (items as CartItem[]).reduce((s, i) => s + i.price * i.qty, 0);
    }, 0);

    const itensNaCozinha = (Object.values(openTables).flat() as CartItem[]).filter(i => i.status === 'PENDING').length;
    const itensProntos = (Object.values(openTables).flat() as CartItem[]).filter(i => i.status === 'READY').length;

    // ✨ Tempo médio de preparo REAL do KDS (baseado no histórico de tickets e mesas abertas)
    let totalPrepMs = 0;
    let prepItemsCount = 0;

    filteredTickets.forEach(ticket => {
        ticket.items.forEach(item => {
            if (item.prepTimeMs) {
                totalPrepMs += item.prepTimeMs;
                prepItemsCount++;
            }
        });
    });

    const openReadyItems = (Object.values(openTables).flat() as CartItem[])
        .filter(i => (i.status === 'READY' || i.status === 'SERVED') && i.readyAt);

    openReadyItems.forEach(item => {
        totalPrepMs += (item.readyAt! - item.createdAt);
        prepItemsCount++;
    });

    const avgPrepMin = prepItemsCount > 0 ? Math.floor(totalPrepMs / prepItemsCount / 60000) : 0;

    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

    // ✨ CMV integrado
    const overallCMV = getOverallCMV();
    const cmvColor = overallCMV.percent === 0 ? 'slate'
        : overallCMV.percent <= 30 ? 'emerald'
            : overallCMV.percent <= 42 ? 'amber' : 'rose';

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-[#080c10]">
            {/* Hero Header */}
            <div className="relative px-8 pt-8 pb-6 border-b border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
                <div className="relative z-10 flex items-end justify-between flex-wrap gap-4">
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{saudacao} — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <h1 className="text-4xl font-black tracking-tighter italic uppercase text-white">Visão Geral do Turno</h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Monitoramento em tempo real de todas as operações</p>
                    </div>
                    {/* Filtro de Período */}
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 gap-1">
                        {([['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês']] as const).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setPeriodFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${periodFilter === val ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >{label}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-8 space-y-8 pb-16">
                {/* KPIs Principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        label="Faturamento"
                        value={`R$ ${faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        sub={`${ticketsHoje} ticket${ticketsHoje !== 1 ? 's' : ''} fechado${ticketsHoje !== 1 ? 's' : ''}`}
                        icon="payments"
                        color="primary"
                    />
                    <KpiCard
                        label="Ticket Médio"
                        value={`R$ ${ticketMedio.toFixed(2)}`}
                        sub={ticketsHoje > 0 ? 'Por ticket fechado' : 'Sem dados'}
                        icon="receipt"
                        color="cyan"
                    />
                    <KpiCard
                        label="CMV Geral"
                        value={overallCMV.percent > 0 ? `${overallCMV.percent.toFixed(1)}%` : '--'}
                        sub={overallCMV.percent > 0 ? (overallCMV.percent <= 35 ? '✅ Dentro da meta' : '⚠️ Acima de 35%') : 'Sem tickets fechados'}
                        icon="price_check"
                        color={cmvColor}
                    />
                    <KpiCard
                        label="Pedidos Delivery"
                        value={`${pedidosAtivos + pedidosEntrega}`}
                        sub={`${pedidosAtivos} prep. • ${pedidosEntrega} entrega`}
                        icon="delivery_dining"
                        color="rose"
                    />
                </div>

                {/* Linha 2: Mesas + Cozinha */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Status das Mesas */}
                    <div className={`lg:col-span-2 bg-[#111820] border border-white/5 rounded-[2rem] p-6 shadow-2xl`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-2xl">table_restaurant</span>
                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Mapa de Ocupação</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black ${ocupacaoRate > 80 ? 'text-rose-500' : ocupacaoRate > 50 ? 'text-warning' : 'text-emerald-500'}`}>{ocupacaoRate}%</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">ocupado</span>
                            </div>
                        </div>

                        {/* Barra de ocupação */}
                        <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden mb-6 border border-white/5">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${ocupacaoRate > 80 ? 'bg-rose-500' : ocupacaoRate > 50 ? 'bg-warning' : 'bg-emerald-500'}`}
                                style={{ width: `${ocupacaoRate}%` }}
                            />
                        </div>

                        {/* Grid de mesas */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {tables.map(table => {
                                const cartItems = openTables[table.id] || [];
                                const total = cartItems.reduce((acc, i) => acc + i.price * i.qty, 0);
                                const statusColor =
                                    table.status === TableStatus.OCCUPIED ? 'border-rose-500/50 bg-rose-500/5' :
                                        table.status === TableStatus.RESERVED ? 'border-warning/50 bg-warning/5' :
                                            table.status === TableStatus.CLEANING ? 'border-blue-500/30 bg-blue-500/5' :
                                                'border-white/5 bg-white/[0.02]';
                                const dotColor =
                                    table.status === TableStatus.OCCUPIED ? 'bg-rose-500' :
                                        table.status === TableStatus.RESERVED ? 'bg-warning' :
                                            table.status === TableStatus.CLEANING ? 'bg-blue-400' :
                                                'bg-emerald-500';

                                return (
                                    <div key={table.id} className={`p-4 rounded-2xl border transition-all ${statusColor}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-lg font-black text-white">#{table.id}</span>
                                            <span className={`size-2.5 rounded-full ${dotColor} ${table.status === TableStatus.OCCUPIED ? 'animate-pulse' : ''}`} />
                                        </div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase leading-none">{table.capacity} pax</p>
                                        {table.status === TableStatus.OCCUPIED && total > 0 && (
                                            <p className="text-[10px] font-black text-primary mt-1">R$ {total.toFixed(0)}</p>
                                        )}
                                        {table.timeActive && (
                                            <p className="text-[9px] text-slate-600 font-mono mt-0.5">{table.timeActive}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-6 mt-6 pt-4 border-t border-white/5">
                            {[
                                { label: 'Ocupadas', count: ocupadas, color: 'bg-rose-500' },
                                { label: 'Livres', count: livres, color: 'bg-emerald-500' },
                                { label: 'Reservadas', count: reservadas, color: 'bg-warning' },
                                { label: 'Limpeza', count: limpeza, color: 'bg-blue-400' },
                            ].map(({ label, count, color }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <span className={`size-2 rounded-full ${color}`} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{count} {label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status da Cozinha */}
                    <div className={`bg-[#111820] border border-white/5 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-5`}>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-cyan-400 text-2xl">skillet</span>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Cozinha</h3>
                        </div>

                        <KitchenStat label="Na Fila (Pendente)" value={itensNaCozinha} icon="hourglass_top" color="text-warning" />
                        <KitchenStat label="Prontos p/ Servir" value={itensProntos} icon="check_circle" color="text-emerald-500" pulse={itensProntos > 0} />
                        <KitchenStat label="Delivery Ativo" value={pedidosAtivos} icon="restaurant" color="text-primary" />
                        <KitchenStat label="Em Entrega" value={pedidosEntrega} icon="delivery_dining" color="text-cyan-400" />

                        {/* ✨ Tempo Médio de Preparo */}
                        <div className="mt-auto pt-3 border-t border-white/5">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Tempo Médio de Preparo</p>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-3xl font-black ${avgPrepMin > 20 ? 'text-rose-500' : avgPrepMin > 10 ? 'text-amber-400' : 'text-emerald-500'
                                    }`}>{avgPrepMin || '--'}</span>
                                <span className="text-xs text-slate-500 font-bold">min</span>
                                {avgPrepMin > 0 && avgPrepMin <= 10 && <span className="text-[9px] text-emerald-500 font-black">Excelente</span>}
                                {avgPrepMin > 10 && avgPrepMin <= 20 && <span className="text-[9px] text-amber-400 font-black">Normal</span>}
                                {avgPrepMin > 20 && <span className="text-[9px] text-rose-500 font-black">Lento</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_#10b981]" />
                            <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Sistema Ativo</span>
                        </div>
                        <p className="text-[9px] text-slate-600 font-bold mt-1">Atualiza a cada 30s</p>
                    </div>
                </div>
            </div>

            {/* Últimos Tickets Fechados */}
            <div className="bg-[#111820] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">history</span>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Últimos Tickets Fechados {isCloud && '(Nuvem)'}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ticketsExibidos.length} total</span>
                </div>
                {ticketsExibidos.length === 0 ? (
                    <div className="p-12 text-center opacity-30">
                        <span className="material-symbols-outlined text-6xl text-slate-600">receipt_long</span>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest mt-4">Nenhum ticket fechado ainda</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead>
                                <tr className="bg-black/20 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5">
                                    <th className="px-6 py-3">Mesa</th>
                                    <th className="px-6 py-3">Horário</th>
                                    <th className="px-6 py-3">Itens</th>
                                    <th className="px-6 py-3">Pagamento</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {ticketsExibidos.slice(0, 10).map((ticket: any) => (
                                    <tr key={ticket.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-white">Mesa {ticket.tableId || ticket.mesa_id}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                            {new Date(ticket.closedAt || ticket.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {isCloud ? '--' : (ticket.items?.length || 0) + ' itens'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <PaymentBadge method={ticket.paymentMethod} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-emerald-500">R$ {ticket.total.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Componentes auxiliares ---
const KpiCard: React.FC<{ label: string; value: string; sub: string; icon: string; color: string }> = ({ label, value, sub, icon, color }) => {
    const colorMap: Record<string, string> = {
        primary: 'text-primary bg-primary/10',
        cyan: 'text-cyan-400 bg-cyan-400/10',
        warning: 'text-warning bg-warning/10',
        green: 'text-emerald-500 bg-emerald-500/10',
        emerald: 'text-emerald-400 bg-emerald-400/10',
        amber: 'text-amber-400 bg-amber-400/10',
        rose: 'text-rose-400 bg-rose-400/10',
        slate: 'text-slate-500 bg-slate-500/10',
    };
    return (
        <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6 shadow-xl">
            <div className={`size-12 rounded-2xl flex items-center justify-center mb-4 ${colorMap[color]}`}>
                <span className="material-symbols-outlined text-2xl">{icon}</span>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <h4 className="text-2xl font-black text-white leading-none">{value}</h4>
            <p className="text-[10px] text-slate-600 font-bold mt-2">{sub}</p>
        </div>
    );
};

const KitchenStat: React.FC<{ label: string; value: number; icon: string; color: string; pulse?: boolean }> = ({ label, value, icon, color, pulse }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
            <span className="text-xs font-bold text-slate-400">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {pulse && value > 0 && <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />}
            <span className={`text-2xl font-black ${color}`}>{value}</span>
        </div>
    </div>
);

const PaymentBadge: React.FC<{ method: string }> = ({ method }) => {
    const map: Record<string, { label: string; cls: string }> = {
        pix: { label: 'PIX', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
        card: { label: 'CARTÃO', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        cash: { label: 'DINHEIRO', cls: 'bg-warning/10 text-warning border-warning/20' },
    };
    const style = map[method] || { label: method.toUpperCase(), cls: 'bg-slate-700/30 text-slate-400 border-slate-700/30' };
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${style.cls}`}>{style.label}</span>
    );
};

export default DashboardView;
