import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTables } from '../../context/TableContext';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem, TableStatus } from '../../types';

const ALL_ITEMS = [...sushiMenu, ...kitchenMenu, ...barMenu];
// Selecionando itens mais pedidos como "Atalhos"
const TOP_ITEMS = ALL_ITEMS.filter(item => item.bestSeller).slice(0, 8);

const QUICK_NOTES = [
    "Sem cebolinha",
    "Sem gergelim",
    "Sem cream cheese",
    "Maçaricado",
    "Molho à parte",
    "Bem passado",
    "Sem gelo",
    "Limão extra"
];

type TabId = 'mesas' | 'comanda' | 'cardapio' | 'alertas';
type Category = 'all' | 'sushi' | 'kitchen' | 'drinks';

const STATUS_META = {
    [TableStatus.FREE]: { label: 'Livre', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', text: 'text-emerald-400', gradient: 'from-emerald-500/20 to-transparent' },
    [TableStatus.OCCUPIED]: { label: 'Ocupada', bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400', text: 'text-rose-400', gradient: 'from-rose-500/20 to-transparent' },
    [TableStatus.RESERVED]: { label: 'Reserva', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400', text: 'text-amber-400', gradient: 'from-amber-500/20 to-transparent' },
    [TableStatus.CLEANING]: { label: 'Limpeza', bg: 'bg-slate-500/10', border: 'border-slate-500/30', dot: 'bg-slate-400', text: 'text-slate-400', gradient: 'from-slate-500/20 to-transparent' },
};

const WaiterView: React.FC = () => {
    const {
        tables, openTables, activeTableId, selectActiveTable,
        addItemToTable, removeItemFromTable, sendTableOrder,
        updateItemStatus, getTableTotal, closeTable,
        notifyReadyCount, clearReadyNotifications,
    } = useTables();

    const [activeTab, setActiveTab] = useState<TabId>('mesas');
    const [category, setCategory] = useState<Category>('all');
    const [search, setSearch] = useState('');

    // Add item flow
    const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
    const [noteText, setNoteText] = useState('');

    // Checkout flow
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'summary' | 'processing' | 'success'>('summary');
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    // Toasts
    const [globalToast, setGlobalToast] = useState<{ message: string, id: number } | null>(null);
    const prevNotifyCount = useRef(notifyReadyCount);

    // Timer
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Notificações em Tempo Real (Toast)
    useEffect(() => {
        if (notifyReadyCount > prevNotifyCount.current) {
            const id = Date.now();
            setGlobalToast({ message: '🔔 Pratos prontos na cozinha!', id });
            setTimeout(() => {
                setGlobalToast(current => current?.id === id ? null : current);
            }, 4000);
        }
        prevNotifyCount.current = notifyReadyCount;
    }, [notifyReadyCount]);

    const formatElapsed = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
        return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };

    const activeTable = tables.find(t => t.id === activeTableId);
    const currentCart = openTables[activeTableId] || [];
    const currentTotal = getTableTotal(activeTableId);
    const serviceFee = currentTotal * 0.1;
    const grandTotal = currentTotal + serviceFee;
    const hasDrafts = currentCart.some(i => i.status === 'DRAFT');
    const readyItems = currentCart.filter(i => i.status === 'READY');

    const readyByTable = useMemo(() => {
        const result: { tableId: string; items: typeof currentCart }[] = [];
        Object.entries(openTables).forEach(([tid, items]) => {
            const ready = (items as typeof currentCart).filter(i => i.status === 'READY');
            if (ready.length > 0) result.push({ tableId: tid, items: ready });
        });
        return result;
    }, [openTables]);

    const filteredItems = ALL_ITEMS.filter(item => {
        const matchCat = category === 'all'
            || (category === 'sushi' && sushiMenu.includes(item))
            || (category === 'kitchen' && kitchenMenu.includes(item))
            || (category === 'drinks' && barMenu.includes(item));
        return matchCat && (!search || item.name.toLowerCase().includes(search.toLowerCase()));
    });

    const handleSelectTable = (id: string) => {
        selectActiveTable(id);
        setActiveTab('comanda');
    };

    const handleTapItem = (item: MenuItem, fastAdd = false) => {
        if (!item.available) return;
        if (fastAdd) {
            // Fast add without notes
            addItemToTable(activeTableId, item, undefined);
            // Optional: vibration feedback if supported
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            setPendingItem(item);
            setNoteText('');
        }
    };

    const toggleQuickNote = (note: string) => {
        setNoteText(prev => {
            const notes = prev.split(',').map(n => n.trim()).filter(Boolean);
            if (notes.includes(note)) {
                return notes.filter(n => n !== note).join(', ');
            } else {
                return [...notes, note].join(', ');
            }
        });
    };

    const confirmAdd = () => {
        if (!pendingItem) return;
        addItemToTable(activeTableId, pendingItem, noteText.trim() || undefined);
        setPendingItem(null);
        setNoteText('');
    };

    const handleFinishPayment = (mode: string) => {
        setPaymentStep('processing');
        setTimeout(() => {
            setPaymentStep('success');
            setTimeout(() => {
                closeTable(activeTableId, mode);
                setIsCheckoutOpen(false);
                setPaymentStep('summary');
                setSelectedMethod(null);
                setActiveTab('mesas');
            }, 2000);
        }, 1500);
    };

    // ─── 1. Visão Geral do Salão (Mapa de Mesas Melhorado) ──────────────────────
    const TabMesas = () => {
        // Organizar por status para destacar as que precisam de atenção (Ocupadas e Reservas)
        const sortedTables = [...tables].sort((a, b) => {
            if (a.status === TableStatus.OCCUPIED && b.status !== TableStatus.OCCUPIED) return -1;
            if (a.status !== TableStatus.OCCUPIED && b.status === TableStatus.OCCUPIED) return 1;
            return 0;
        });

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-background-dark">
                <div className="px-4 py-4 bg-card-dark border-b border-border-dark flex justify-between items-center shadow-lg z-10">
                    <div>
                        <h1 className="text-xl font-black text-white italic">VISÃO GERAL</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selecione uma mesa</p>
                    </div>
                    <div className="flex gap-2 text-[10px] font-black uppercase text-slate-500">
                        <div className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400"></span> Livre</div>
                        <div className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-400"></span> Ocupada</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {sortedTables.map(table => {
                            const meta = STATUS_META[table.status] ?? STATUS_META[TableStatus.FREE];
                            const cart = openTables[table.id] || [];
                            const hasReady = cart.some(i => i.status === 'READY');
                            const total = getTableTotal(table.id);

                            const oldest = cart.reduce((min, i) => {
                                const ts = (i as any).createdAt || now;
                                return ts < min ? ts : min;
                            }, now);
                            const elapsedMs = now - oldest;
                            const elapsed = cart.length > 0 ? formatElapsed(elapsedMs) : null;

                            // Progress bar logic (e.g. max 2 horas = 7200000ms)
                            const maxTime = 7200000;
                            const progressPct = table.status === TableStatus.OCCUPIED && cart.length > 0 ? Math.min(100, (elapsedMs / maxTime) * 100) : 0;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table.id)}
                                    className={`relative overflow-hidden p-4 rounded-3xl border-2 flex flex-col gap-3 text-left transition-all active:scale-95 bg-card-dark ${meta.border} shadow-lg`}
                                >
                                    <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${meta.gradient} opacity-50`}></div>

                                    {hasReady && (
                                        <span className="absolute top-4 right-4 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </span>
                                    )}

                                    <div className="relative z-10 flex items-center justify-between">
                                        <span className="text-3xl font-black text-white italic tracking-tighter">Mesa {table.id}</span>
                                    </div>

                                    <div className="relative z-10 flex items-center justify-between text-xs mt-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${meta.border} ${meta.text} bg-background-dark/80 backdrop-blur`}>
                                            {meta.label}
                                        </span>
                                        <span className="text-slate-400 font-bold">{table.capacity} pax</span>
                                    </div>

                                    {table.status === TableStatus.OCCUPIED && (
                                        <div className="relative z-10 mt-auto pt-4 space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono text-sm font-bold text-slate-300">⏱ {elapsed || '00:00'}</span>
                                                <span className={`text-lg font-black ${meta.text}`}>R$ {total.toFixed(2)}</span>
                                            </div>
                                            {/* Linha de tempo visual */}
                                            <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                                                <div className={`h-full ${progressPct > 75 ? 'bg-danger' : progressPct > 50 ? 'bg-warning' : 'bg-primary'} transition-all`} style={{ width: `${progressPct}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                    {table.status === TableStatus.FREE && (
                                        <div className="relative z-10 mt-auto pt-6 flex justify-center">
                                            <div className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">restaurant</span>
                                                Abrir Mesa
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // ─── 2. Comanda com Atalhos Rápidos ─────────────────────────────────────────
    const TabComanda = () => {
        const oldest = currentCart.reduce((min, i) => {
            const ts = (i as any).createdAt || now;
            return ts < min ? ts : min;
        }, now);
        const elapsed = currentCart.length > 0 ? formatElapsed(now - oldest) : null;

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-background-dark">
                {/* Mesa header */}
                <div className="px-4 py-4 bg-card-dark border-b border-white/10 flex items-center justify-between z-10 shadow-lg">
                    <div>
                        <h2 className="text-2xl font-black italic text-white tracking-tighter">MESA {activeTableId || '—'}</h2>
                        {elapsed && <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1">⏱ Ativa há {elapsed}</p>}
                    </div>
                    <button
                        onClick={() => { setActiveTab('cardapio'); }}
                        className="size-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all group"
                    >
                        <span className="material-symbols-outlined text-white text-3xl group-hover:rotate-90 transition-transform">add</span>
                    </button>
                </div>

                {/* Atalhos Rápidos (Rodízio & À La Carte) */}
                {activeTableId && (
                    <div className="px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">bolt</span>
                                Lançamento Rápido
                            </span>
                            <span className="text-[9px] text-slate-600 font-bold">1-Click</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {TOP_ITEMS.map((item, idx) => (
                                <button
                                    key={`top-${idx}`}
                                    onClick={() => handleTapItem(item, true)}
                                    className="shrink-0 w-28 bg-card-dark border border-white/10 rounded-xl p-2 flex flex-col gap-1 active:scale-95 active:bg-white/10 transition-all shadow-sm"
                                >
                                    <div className="h-14 rounded-lg bg-background-dark overflow-hidden mb-1">
                                        <img src={item.image} className="w-full h-full object-cover opacity-80" alt={item.name} />
                                    </div>
                                    <span className="text-[9px] font-bold text-white leading-tight truncate">{item.name}</span>
                                    <span className="text-[10px] font-black text-primary">R$ {item.price.toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista de itens */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {currentCart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 p-8">
                            <span className="material-symbols-outlined text-7xl font-thin">receipt_long</span>
                            <p className="text-sm font-bold uppercase tracking-widest text-center">Nenhum item lançado</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-2">
                            {currentCart.map((item, idx) => {
                                const isReady = item.status === 'READY';
                                const isDraft = item.status === 'DRAFT';
                                return (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${isDraft ? 'bg-card-dark border border-amber-500/20 shadow-lg relative overflow-hidden' :
                                            isReady ? 'bg-emerald-500/10 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' :
                                                'bg-card-dark border border-white/5'
                                            }`}
                                    >
                                        {isDraft && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>}

                                        {/* Status badge */}
                                        <span className={`shrink-0 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase flex flex-col items-center justify-center text-center leading-none ${isDraft ? 'bg-amber-500/10 text-amber-500' :
                                            isReady ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' :
                                                'bg-blue-500/10 text-blue-400'
                                            }`}>
                                            {isDraft ? <><span className="material-symbols-outlined text-lg mb-0.5">draft</span>NOVO</> :
                                                isReady ? <><span className="material-symbols-outlined text-lg mb-0.5">room_service</span>PRONTO</> :
                                                    <><span className="material-symbols-outlined text-lg mb-0.5">skillet</span>PREPARO</>}
                                        </span>

                                        <div className="flex-1 min-w-0 pl-2">
                                            <p className="text-base font-black text-white truncate">{item.qty}x {item.name}</p>
                                            {item.notes && <p className="text-xs text-amber-400/80 font-bold italic mt-0.5">📝 {item.notes}</p>}
                                            <p className="text-sm text-slate-400 font-bold font-mono mt-1">R$ {(item.price * item.qty).toFixed(2)}</p>
                                        </div>

                                        {/* Ações */}
                                        {isReady && (
                                            <button
                                                onClick={() => updateItemStatus(activeTableId, item.id, 'SERVED')}
                                                className="shrink-0 size-12 bg-white text-emerald-600 rounded-xl flex items-center justify-center font-black active:scale-90 transition-all shadow-xl"
                                            >
                                                <span className="material-symbols-outlined text-2xl">check</span>
                                            </button>
                                        )}
                                        {isDraft && (
                                            <button
                                                onClick={() => removeItemFromTable(activeTableId, item.id)}
                                                className="shrink-0 p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-colors active:scale-90"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Rodapé de ações */}
                {currentCart.length > 0 && (
                    <div className="p-5 border-t border-border-dark bg-[#12161b] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-500 font-bold uppercase">Subtotal R$ {currentTotal.toFixed(2)}</span>
                            <span className="text-xs text-slate-500 font-bold uppercase">Taxa R$ {serviceFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-sm font-black uppercase text-slate-300">Total da Mesa</span>
                            <span className="text-3xl font-black text-primary tracking-tighter italic">R$ {grandTotal.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-3">
                            {hasDrafts ? (
                                <button
                                    onClick={() => sendTableOrder(activeTableId)}
                                    className="flex-1 py-4.5 rounded-2xl bg-emerald-500 text-white text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                                >
                                    <span className="material-symbols-outlined text-xl">send</span>
                                    Lançar para Cozinha
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setIsCheckoutOpen(true); setPaymentStep('summary'); }}
                                    className="flex-1 py-4.5 rounded-2xl bg-white text-black text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-white/10"
                                >
                                    <span className="material-symbols-outlined text-xl">receipt_long</span>
                                    Resumo da Conta
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ─── 3. Cardápio Completo ───────────────────────────────────────────────────
    const TabCardapio = () => (
        <div className="flex-1 flex flex-col overflow-hidden bg-background-dark">
            <div className="px-4 py-4 bg-card-dark border-b border-white/10 space-y-4 shadow-md z-10">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(['all', 'sushi', 'kitchen', 'drinks'] as Category[]).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${category === cat ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-[#1a2329] border border-white/5 text-slate-400'}`}
                        >
                            {cat === 'all' ? 'Tudo' : cat === 'sushi' ? '🍱 Sushi' : cat === 'kitchen' ? '🍳 Cozinha' : '🍹 Bar'}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar prato ou bebida..."
                        className="w-full pl-12 pr-4 py-3.5 bg-[#1a2329] border border-white/5 rounded-2xl text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-bold"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleTapItem(item, false)}
                            disabled={!item.available}
                            className={`bg-card-dark border border-white/5 rounded-3xl p-3 flex flex-col gap-2 text-left active:scale-[0.97] transition-all relative overflow-hidden shadow-lg ${!item.available ? 'opacity-40 grayscale' : 'hover:border-primary/50'}`}
                        >
                            {item.bestSeller && (
                                <span className="absolute top-3 left-3 px-2 py-1 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg z-10 shadow-md">Top</span>
                            )}
                            <div className="aspect-square rounded-2xl overflow-hidden bg-black/50">
                                <img src={item.image} className="w-full h-full object-cover mix-blend-overlay opacity-90" alt={item.name} />
                            </div>
                            <div className="pt-1 px-1">
                                <p className="text-[12px] font-black text-white line-clamp-2 leading-tight h-8">{item.name}</p>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-sm font-black text-primary font-mono">R$ {item.price.toFixed(2)}</p>
                                    <div className="size-6 rounded-full bg-white/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[14px] text-white">add</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-2 py-20 flex flex-col items-center text-slate-600">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">search_off</span>
                            <p className="text-sm font-black uppercase tracking-widest">Nenhum item encontrado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ─── 4. Alertas (Notificações em Tempo Real) ────────────────────────────────
    const TabAlertas = () => (
        <div className="flex-1 overflow-y-auto p-4 bg-background-dark">
            {readyByTable.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20 py-20">
                    <div className="size-24 rounded-full border-4 border-current flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl">notifications_off</span>
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-center">Tudo Servido<br /><span className="text-[10px] opacity-70">Aguardando Cozinha</span></p>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="px-2 pb-2 border-b border-white/5">
                        <h2 className="text-lg font-black text-white italic">PRATOS PRONTOS</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Leve até a mesa imediatamente</p>
                    </div>
                    {readyByTable.map(({ tableId, items }) => (
                        <div key={tableId} className="bg-card-dark border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(16,185,129,0.1)] relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-emerald-500/5">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-3 w-3 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-2xl font-black text-white italic tracking-tighter">MESA {tableId}</span>
                                </div>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-full border border-emerald-500/20">
                                    {items.length} item{items.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="divide-y divide-white/5">
                                {items.map((item, idx) => (
                                    <div key={idx} className="p-4 pl-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div>
                                            <p className="text-base font-black text-slate-200">{item.qty}x {item.name}</p>
                                            {item.notes && <p className="text-xs text-amber-400/80 font-bold italic mt-1">📝 {item.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-black/20">
                                <button
                                    onClick={() => items.forEach(i => updateItemStatus(tableId, i.id, 'SERVED'))}
                                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-sm font-black uppercase tracking-[0.15em] shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">done_all</span>
                                    Marcar como Servidos
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const tabs: { id: TabId; icon: string; label: string; badge?: number }[] = [
        { id: 'mesas', icon: 'grid_view', label: 'Salão' },
        { id: 'comanda', icon: 'receipt_long', label: 'Comanda', badge: readyItems.length > 0 ? readyItems.length : undefined },
        { id: 'cardapio', icon: 'restaurant_menu', label: 'Cardápio' },
        { id: 'alertas', icon: 'notifications', label: 'Alertas', badge: notifyReadyCount > 0 ? notifyReadyCount : undefined },
    ];

    return (
        <div className="h-full flex flex-col bg-background-dark overflow-hidden relative">

            {/* 🔔 Global Toast Notification */}
            {globalToast && (
                <div className="absolute top-6 left-4 right-4 z-[100] animate-in slide-in-from-top-10 fade-in duration-300">
                    <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.4)] flex justify-between items-center border-2 border-emerald-400">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl animate-bounce">room_service</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-widest">{globalToast.message}</h4>
                                <p className="text-xs text-emerald-100 font-bold mt-0.5">Toque na aba Alertas para ver.</p>
                            </div>
                        </div>
                        <button onClick={() => setGlobalToast(null)} className="p-2 bg-white/10 rounded-xl">
                            <span className="material-symbols-outlined text-white">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === 'mesas' && <TabMesas />}
                {activeTab === 'comanda' && <TabComanda />}
                {activeTab === 'cardapio' && <TabCardapio />}
                {activeTab === 'alertas' && <TabAlertas />}
            </div>

            {/* Bottom Navigation */}
            <nav className="shrink-0 bg-[#0d1317] border-t border-white/5 pb-safe pt-1 relative z-50">
                <div className="flex">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (tab.id === 'alertas') clearReadyNotifications();
                                }}
                                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 relative transition-all duration-300 ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span className="absolute top-1.5 right-[25%] translate-x-2 size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-[#0d1317] animate-pulse">
                                        {tab.badge > 9 ? '9+' : tab.badge}
                                    </span>
                                )}

                                <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-125 -translate-y-1' : ''}`}>
                                    <span className={`material-symbols-outlined text-2xl ${isActive ? 'fill-1' : ''}`}>
                                        {tab.icon}
                                    </span>
                                    {isActive && (
                                        <span className="absolute -inset-2 bg-primary/20 rounded-full blur-md -z-10"></span>
                                    )}
                                </div>

                                <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-1'}`}>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </nav>

            {/* Botton Sheet: Adicionar item detalhado */}
            {pendingItem && (
                <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setPendingItem(null)}>
                    <div className="w-full max-w-lg bg-[#12161b] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
                        <div className="flex items-start gap-4 mb-6">
                            <div className="size-20 rounded-2xl overflow-hidden bg-background-dark shrink-0 shadow-lg border border-white/5">
                                <img src={pendingItem.image} className="w-full h-full object-cover" alt={pendingItem.name} />
                            </div>
                            <div className="pt-1">
                                <span className="px-2 py-0.5 bg-white/10 text-slate-300 text-[9px] font-black uppercase rounded mb-1 inline-block">Mesa {activeTableId || '?'}</span>
                                <h3 className="text-xl font-black text-white leading-tight">{pendingItem.name}</h3>
                                <p className="text-primary font-black text-xl mt-1 font-mono">R$ {pendingItem.price.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Atalhos de Observação */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 -mx-2 px-2">
                            {QUICK_NOTES.map(note => {
                                const isActive = noteText.split(',').map(n => n.trim()).includes(note);
                                return (
                                    <button
                                        key={note}
                                        onClick={() => toggleQuickNote(note)}
                                        className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${isActive
                                                ? 'bg-primary/20 text-primary border border-primary/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {isActive && <span className="material-symbols-outlined text-[11px] mr-1 align-middle">check</span>}
                                        {note}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="bg-black/30 rounded-2xl p-4 border border-white/5 mb-6 focus-within:border-primary focus-within:bg-black/50 transition-colors">
                            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1 mb-2">
                                <span className="material-symbols-outlined text-xs">edit_note</span> Observação Adicional
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                                placeholder="Ex: sem cebola, limão extra..."
                                className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-600 font-bold"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setPendingItem(null)} className="w-20 shrink-0 py-4.5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-black flex items-center justify-center active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <button onClick={confirmAdd} className="flex-1 py-4.5 bg-primary rounded-2xl text-white text-sm font-black uppercase tracking-[0.1em] shadow-xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
                                Adicionar e Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 5. Resumo da Conta (Modal Avançado) ───────────────────────────────── */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => paymentStep === 'summary' && setIsCheckoutOpen(false)}>
                    <div className="w-full max-w-lg bg-[#12161b] border-t border-white/10 rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-[0_-20px_60px_rgba(230,99,55,0.15)] animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-4 mb-2 shrink-0"></div>

                        {paymentStep === 'summary' && (
                            <div className="p-6 flex flex-col h-full overflow-hidden">
                                <div className="flex items-center justify-between mb-6 shrink-0">
                                    <div>
                                        <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">MESA {activeTableId}</h2>
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">Conferência de Conta</p>
                                    </div>
                                    <button onClick={() => setIsCheckoutOpen(false)} className="size-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 border border-white/5 hover:bg-white/10 transition-colors">
                                        <span className="material-symbols-outlined text-2xl">close</span>
                                    </button>
                                </div>

                                {/* Resumo itens scrollable */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/30 rounded-3xl p-5 border border-white/5 mb-6 space-y-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Itens Consumidos ({currentCart.length})</p>
                                    {currentCart.map((item, i) => (
                                        <div key={i} className="flex justify-between items-start text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                            <div>
                                                <span className="text-white font-bold">{item.qty}x {item.name}</span>
                                                {item.notes && <p className="text-[10px] text-amber-500 font-bold italic mt-0.5">↳ {item.notes}</p>}
                                            </div>
                                            <span className="text-slate-400 font-mono shrink-0 ml-4 font-bold">R$ {(item.price * item.qty).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Totais shrink-0 */}
                                <div className="bg-gradient-to-br from-card-dark to-[#0d1317] rounded-3xl p-5 border border-white/10 shrink-0 shadow-lg mb-6">
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-slate-400 text-sm font-bold">
                                            <span>Subtotal Consumo</span><span className="font-mono">R$ {currentTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400 text-sm font-bold">
                                            <span>Taxa de Serviço (10%)</span><span className="font-mono text-primary">R$ {serviceFee.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/10 flex justify-between items-center bg-black/20 -mx-5 -mb-5 p-5 rounded-b-3xl">
                                        <span className="font-black text-white text-lg">TOTAL FINAL</span>
                                        <span className="text-4xl font-black text-primary italic tracking-tighter">R$ {grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="shrink-0 space-y-3">
                                    <button
                                        onClick={() => handleFinishPayment('solicitado')}
                                        className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_10px_30px_rgba(255,255,255,0.15)]"
                                    >
                                        <span className="material-symbols-outlined text-xl">payments</span>
                                        Solicitar Fechamento no Caixa
                                    </button>
                                    <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alerte o caixa para emitir a nota</p>
                                </div>
                            </div>
                        )}

                        {paymentStep === 'processing' && (
                            <div className="h-80 flex flex-col items-center justify-center gap-6">
                                <div className="relative size-24">
                                    <div className="absolute inset-0 border-8 border-primary/20 rounded-full" />
                                    <div className="absolute inset-0 border-8 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white text-center">Notificando Caixa</h3>
                                    <p className="text-xs text-slate-500 font-bold text-center mt-2">Aguarde um momento...</p>
                                </div>
                            </div>
                        )}

                        {paymentStep === 'success' && (
                            <div className="h-80 flex flex-col items-center justify-center gap-8 text-center px-8">
                                <div className="size-28 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.4)] relative">
                                    <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                                    <span className="material-symbols-outlined text-white text-6xl font-black animate-bounce">done_all</span>
                                </div>
                                <div>
                                    <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter">Tudo Certo!</h3>
                                    <p className="text-sm text-slate-400 font-bold mt-2 leading-relaxed">Conta enviada para o caixa.<br />Mesa bloqueada para novos lançamentos.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterView;
