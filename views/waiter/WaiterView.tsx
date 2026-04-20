import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTables } from '../../context/TableContext';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem, TableStatus } from '../../types';

const INITIAL_ALL_ITEMS = [...sushiMenu, ...kitchenMenu, ...barMenu];

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
        notifyReadyCount, clearReadyNotifications, moveTableItems,
    } = useTables();

    const { isOnline, sendOrder, pendingQueueCount } = useServer();
    const { currentUser: authUser, logout } = useAuth();
    const currentUser = authUser || { name: 'Garçom', id: '', role: 'waiter', pin: '', avatar: '', color: '', allowedScreens: [] };

    const [activeTab, setActiveTab] = useState<TabId>('mesas');
    const [category, setCategory] = useState<Category>('all');
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false); // ✨ Novo estado da Lupa

    const [customItems, setCustomItems] = useState<MenuItem[]>(() => {
        try {
            const saved = localStorage.getItem('sushiflow_menu_items');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const ALL_ITEMS = useMemo(() => [...INITIAL_ALL_ITEMS, ...customItems], [customItems]);

    const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
    const [noteText, setNoteText] = useState('');

    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'summary' | 'processing' | 'success'>('summary');
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    const [isSending, setIsSending] = useState(false);
    const [isSwitchTableOpen, setIsSwitchTableOpen] = useState(false);

    const [globalToast, setGlobalToast] = useState<{ message: string; type: 'info' | 'success'; id: number } | null>(null);
    const prevNotifyCount = useRef(notifyReadyCount);

    const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
        const id = Date.now();
        setGlobalToast({ message, type, id });
        setTimeout(() => setGlobalToast(c => c?.id === id ? null : c), 3500);
    }, []);

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (notifyReadyCount > prevNotifyCount.current) {
            showToast('🔔 Pratos prontos na cozinha!', 'info');
        }
        prevNotifyCount.current = notifyReadyCount;
    }, [notifyReadyCount, showToast]);

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
    const draftItemsCount = currentCart.filter(i => i.status === 'DRAFT').reduce((acc, curr) => acc + curr.qty, 0);
    const draftItemsValue = currentCart.filter(i => i.status === 'DRAFT').reduce((acc, curr) => acc + (curr.qty * curr.price), 0);

    const freeTables = useMemo(() =>
        tables.filter(t => t.status === TableStatus.FREE && t.id !== activeTableId),
        [tables, activeTableId]
    );

    const readyByTable = useMemo(() => {
        const result: { tableId: string; items: typeof currentCart }[] = [];
        Object.entries(openTables).forEach(([tid, items]) => {
            const ready = (items as typeof currentCart).filter(i => i.status === 'READY');
            if (ready.length > 0) result.push({ tableId: tid, items: ready });
        });
        return result;
    }, [openTables]);

    const filteredItems = ALL_ITEMS.filter(item => {
        let matchCat = category === 'all'
            || (category === 'sushi' && sushiMenu.includes(item as any))
            || (category === 'kitchen' && kitchenMenu.includes(item as any))
            || (category === 'drinks' && barMenu.includes(item as any));
            
        if (!matchCat && customItems.includes(item)) {
            const cat = item.category?.toLowerCase() || '';
            if (category === 'sushi' && cat.includes('sushi')) matchCat = true;
            else if (category === 'kitchen' && (cat.includes('quente') || cat.includes('cozinha'))) matchCat = true;
            else if (category === 'drinks' && (cat.includes('bebida') || cat.includes('drink') || cat.includes('bar'))) matchCat = true;
            else if (category === 'all') matchCat = true; // should be caught by top category==='all' anyway
        }

        return matchCat && (!search || item.name.toLowerCase().includes(search.toLowerCase()));
    });

    const handleSelectTable = (id: string) => {
        selectActiveTable(id);
        setActiveTab('comanda');
    };

    const handleInstantAdd = (item: MenuItem) => {
        if (!item.available) return;
        addItemToTable(activeTableId, item, undefined);
        if (navigator.vibrate) navigator.vibrate(50);
        showToast(`✅ ${item.name} adicionado!`, 'success');
    };

    const handleOpenNotes = (item: MenuItem) => {
        if (!item.available) return;
        setPendingItem(item);
        setNoteText('');
    };

    const toggleQuickNote = (note: string) => {
        setNoteText(prev => {
            const notes = prev.split(',').map(n => n.trim()).filter(Boolean);
            if (notes.includes(note)) return notes.filter(n => n !== note).join(', ');
            return [...notes, note].join(', ');
        });
    };

    const confirmAdd = () => {
        if (!pendingItem) return;
        addItemToTable(activeTableId, pendingItem, noteText.trim() || undefined);
        showToast(`✅ ${pendingItem.name} adicionado com obs!`, 'success');
        setPendingItem(null);
        setNoteText('');
    };

    const handleSendOrder = async () => {
        if (isSending || !hasDrafts) return;
        setIsSending(true);

        try {
            // Pega os itens que ainda não foram enviados (DRAFT)
            const pedidosParaEnviar = currentCart.filter(i => i.status === 'DRAFT');

            const result = await sendOrder({
                mesaId: activeTableId,
                garcom: currentUser.name || 'Garçom',
                items: pedidosParaEnviar.map(i => ({
                    id: i.id,
                    menuItemId: i.id,
                    name: i.name,
                    price: i.price,
                    qty: i.qty,
                    notes: i.notes,
                    printerRoute: (i as any).printerRoute || 'KITCHEN',
                    createdAt: (i as any).createdAt || Date.now()
                }))
            });

            if (result.ok) {
                sendTableOrder(activeTableId);
                if (result.print?.ok) {
                    showToast('✅ Pedido Gravado e Impresso!', 'success');
                } else {
                    showToast('✅ Pedido Gravado (impressão pendente)', 'info');
                }
            } else {
                showToast('❌ Erro ao enviar pedido', 'info');
            }
        } catch (error) {
            console.error(error);
            showToast('⚠️ Erro: Ligue o "node server.js" no seu PC!', 'info');
        } finally {
            setIsSending(false);
        }
    };

    const handleSwitchTable = (targetId: string) => {
        moveTableItems(activeTableId, targetId);
        selectActiveTable(targetId);
        setIsSwitchTableOpen(false);
        showToast(`✅ Transferido para Mesa ${targetId}`, 'success');
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

    // ─── 1. VISÃO GERAL DO SALÃO ─────────────────────────────────────────────────
    const renderMesas = () => {
        const sortedTables = [...tables].sort((a, b) => {
            if (a.status === TableStatus.OCCUPIED && b.status !== TableStatus.OCCUPIED) return -1;
            if (a.status !== TableStatus.OCCUPIED && b.status === TableStatus.OCCUPIED) return 1;
            return 0;
        });

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1218]">
                <div className="px-5 py-6 bg-[#11161d] border-b border-white/5 flex justify-between items-center shadow-lg z-10 shrink-0">
                    <div>
                        <h1 className="text-2xl font-black text-white italic tracking-tighter">SALÃO</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Olá, {currentUser.name}</p>
                    </div>
                    <button onClick={() => { logout(); }} className="text-[10px] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 px-3 py-2 rounded-xl font-bold transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">logout</span> Sair
                    </button>
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
                            const maxTime = 7200000;
                            const progressPct = table.status === TableStatus.OCCUPIED && cart.length > 0 ? Math.min(100, (elapsedMs / maxTime) * 100) : 0;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table.id)}
                                    className={`relative overflow-hidden p-5 rounded-[2rem] border-2 flex flex-col gap-3 text-left transition-all active:scale-95 bg-[#11161d] ${meta.border} shadow-xl h-44`}
                                >
                                    <div className={`absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b ${meta.gradient} opacity-30`}></div>
                                    {hasReady && (
                                        <span className="absolute top-4 right-4 flex h-4 w-4">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                                        </span>
                                    )}
                                    <div className="relative z-10">
                                        <span className="text-3xl font-black text-white italic tracking-tighter">MESA {table.id}</span>
                                    </div>
                                    <div className="relative z-10 flex items-center justify-between text-xs mt-1">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${meta.border} ${meta.text} bg-black/40 backdrop-blur`}>
                                            {meta.label}
                                        </span>
                                    </div>
                                    {table.status === TableStatus.OCCUPIED && (
                                        <div className="relative z-10 mt-auto pt-4 space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono text-sm font-bold text-slate-300 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> {elapsed || '00:00'}</span>
                                                <span className={`text-xl font-black ${meta.text}`}>R$ {total.toFixed(0)}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                                                <div className={`h-full ${progressPct > 75 ? 'bg-rose-500' : progressPct > 50 ? 'bg-amber-400' : 'bg-emerald-500'} transition-all`} style={{ width: `${progressPct}%` }}></div>
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

    // ─── 2. COMANDA E FECHAMENTO ─────────────────────────────────────────────────
    const renderComanda = () => {
        if (!activeTable) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0d1218] opacity-50">
                    <span className="material-symbols-outlined text-7xl">table_restaurant</span>
                    <p className="text-sm font-black uppercase tracking-widest text-center">Selecione uma mesa<br /><span className="text-xs opacity-60">Volte para o Salão</span></p>
                </div>
            );
        }

        const drafts = currentCart.filter(i => i.status === 'DRAFT');
        const sent = currentCart.filter(i => i.status !== 'DRAFT');
        const elapsed = currentCart.length > 0 ? formatElapsed(now - currentCart.reduce((min, i) => Math.min((i as any).createdAt || now, min), now)) : null;

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1218]">
                <div className="p-5 bg-[#11161d] border-b border-white/5 flex items-center justify-between z-10 shadow-lg shrink-0">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-3xl font-black italic text-white tracking-tighter">MESA {activeTableId}</h2>
                        {elapsed && <p className="text-sm text-indigo-400 font-bold uppercase tracking-widest">Ativa há {elapsed}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        {currentCart.length > 0 && (
                            <button onClick={() => setIsSwitchTableOpen(true)} className="size-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-2xl">swap_horiz</span>
                            </button>
                        )}
                        <button onClick={() => setActiveTab('cardapio')} className="size-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-3xl">add</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {currentCart.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                            <span className="material-symbols-outlined text-7xl font-thin">receipt_long</span>
                            <p className="text-base font-bold uppercase tracking-widest text-center">Nenhum item lançado</p>
                        </div>
                    ) : (
                        <>
                            {drafts.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase text-amber-500 tracking-[0.2em] px-2 flex items-center gap-2"><span className="material-symbols-outlined text-sm">warning</span> Rascunho</h3>
                                    <div className="bg-amber-500/5 border-2 border-amber-500/20 rounded-[2rem] p-2 space-y-2">
                                        {drafts.map((item, idx) => (
                                            <div key={`draft-${idx}`} className="bg-[#11161d] p-4 rounded-2xl flex items-center justify-between shadow-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-lg font-black text-white truncate">{item.qty}x {item.name}</p>
                                                    {item.notes && <p className="text-sm text-amber-400/80 font-bold italic mt-1">📝 {item.notes}</p>}
                                                </div>
                                                <div className="flex items-center gap-4 ml-4 shrink-0">
                                                    <span className="text-base font-black text-amber-400 font-mono">R$ {(item.price * item.qty).toFixed(2)}</span>
                                                    <button onClick={() => removeItemFromTable(activeTableId, item.id)} className="size-12 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center active:scale-90 transition-all">
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sent.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] px-2">Itens do Pedido</h3>
                                    <div className="space-y-2">
                                        {sent.map((item, idx) => {
                                            const isReady = item.status === 'READY';
                                            const isPending = item.status === 'PENDING';
                                            return (
                                                <div key={`sent-${idx}`} className={`p-5 rounded-3xl flex items-center justify-between border ${isReady ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/5'}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-lg font-black truncate ${isReady ? 'text-emerald-400' : 'text-slate-200'}`}>{item.qty}x {item.name}</p>
                                                        {item.notes && <p className="text-sm text-slate-400 font-bold italic mt-1">↳ {item.notes}</p>}
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${isReady ? 'bg-emerald-500 text-white' : isPending ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                                {isReady ? 'Pronto (Levar)' : isPending ? 'Na Cozinha' : 'Servido'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
                                                        <span className="text-base font-black text-slate-400 font-mono">R$ {(item.price * item.qty).toFixed(2)}</span>
                                                        {isReady && (
                                                            <button onClick={() => updateItemStatus(activeTableId, item.id, 'SERVED')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase active:scale-95 shadow-lg flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-sm">check</span> Entregue
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {currentCart.length > 0 && (
                    <div className="p-5 border-t border-white/5 bg-[#11161d] pb-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
                        <div className="flex justify-between items-end mb-5">
                            <div>
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total da Mesa</span>
                                <p className="text-4xl font-black text-indigo-400 tracking-tighter italic">R$ {grandTotal.toFixed(2)}</p>
                            </div>
                            <span className="text-xs text-slate-500 font-bold uppercase">+10% R$ {serviceFee.toFixed(2)}</span>
                        </div>

                        {hasDrafts ? (
                            <button onClick={handleSendOrder} disabled={isSending} className={`w-full h-16 rounded-[1.5rem] text-white text-base font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-2xl ${isSending ? 'bg-amber-600' : 'bg-amber-500 shadow-amber-500/20'}`}>
                                {isSending ? <div className="size-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="material-symbols-outlined text-2xl">send</span> Lançar Pedidos ({draftItemsCount})</>}
                            </button>
                        ) : (
                            <button onClick={() => { setIsCheckoutOpen(true); setPaymentStep('summary'); }} className="w-full h-16 rounded-[1.5rem] bg-white text-black text-base font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-white/10">
                                <span className="material-symbols-outlined text-2xl">receipt_long</span> Fechar Conta
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ─── 3. CARDÁPIO (Focado na Zona do Polegar) ────────────────────────────────
    const renderCardapio = () => (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1218] relative">
            {/* Header: Categorias + Botão de Lupa */}
            <div className="px-4 py-3 bg-[#11161d] border-b border-white/5 shadow-md z-10 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {/* Botão para mostrar/esconder a pesquisa */}
                    <button
                        onClick={() => {
                            if (showSearch) setSearch(''); // Limpa a busca ao fechar
                            setShowSearch(!showSearch);
                        }}
                        className={`shrink-0 size-12 rounded-2xl flex items-center justify-center transition-all ${showSearch || search ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-slate-400'}`}
                    >
                        <span className="material-symbols-outlined text-xl">{showSearch ? 'close' : 'search'}</span>
                    </button>

                    {/* Filtros de Categoria */}
                    {(['all', 'sushi', 'kitchen', 'drinks'] as Category[]).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`shrink-0 px-5 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${category === cat ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 border border-white/5 text-slate-400'}`}
                        >
                            {cat === 'all' ? 'Tudo' : cat === 'sushi' ? '🍱 Sushi' : cat === 'kitchen' ? '🍳 Cozinha' : '🍹 Bebidas'}
                        </button>
                    ))}
                </div>

                {/* Barra de Pesquisa Dinâmica (Só aparece se a Lupa for clicada) */}
                {showSearch && (
                    <div className="mt-3 relative animate-in fade-in slide-in-from-top-2">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl">search</span>
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar nome do prato..."
                            className="w-full pl-12 pr-4 h-12 bg-black border border-indigo-500/50 rounded-2xl text-sm text-white outline-none focus:border-indigo-500 transition-all font-bold shadow-inner"
                        />
                    </div>
                )}
            </div>

            {/* A lista de produtos precisa de um espaço em branco no final (pb-32 ou pb-40) 
                para que o último prato não fique escondido atrás do botão flutuante Laranja */}
            <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${draftItemsCount > 0 ? 'pb-40' : 'pb-10'}`}>
                <div className="space-y-3">
                    {filteredItems.map(item => (
                        <div key={item.id} className={`bg-[#11161d] border border-white/5 rounded-[2rem] p-4 flex items-center gap-4 relative overflow-hidden shadow-lg ${!item.available ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <div className="size-20 rounded-2xl overflow-hidden bg-black shrink-0 relative">
                                {item.bestSeller && <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded">Top</span>}
                                <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                                <h3 className="text-base font-black text-white leading-tight truncate">{item.name}</h3>
                                <p className="text-sm font-black text-indigo-400 mt-1 font-mono">R$ {item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                <button onClick={() => handleInstantAdd(item)} className="size-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                    <span className="material-symbols-outlined text-2xl">add</span>
                                </button>
                                <button onClick={() => handleOpenNotes(item)} className="size-10 bg-white/5 text-slate-400 border border-white/10 rounded-xl flex items-center justify-center active:scale-90 transition-all">
                                    <span className="material-symbols-outlined text-lg">edit_note</span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="py-20 flex flex-col items-center text-slate-600">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">search_off</span>
                            <p className="text-sm font-black uppercase tracking-widest">Nenhum item encontrado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* CARRINHO FLUTUANTE DE RASCUNHO (Ancorado Corretamente) */}
            {draftItemsCount > 0 && (
                <div
                    onClick={() => setActiveTab('comanda')}
                    className="absolute bottom-6 left-4 right-4 bg-amber-500 text-black rounded-[2rem] shadow-[0_10px_40px_rgba(245,158,11,0.4)] flex items-center justify-between p-5 cursor-pointer active:scale-[0.98] transition-all z-40 animate-in slide-in-from-bottom-10"
                >
                    <div className="flex items-center gap-4">
                        <div className="size-12 bg-black/10 rounded-2xl flex items-center justify-center relative">
                            <span className="material-symbols-outlined text-3xl font-black">receipt_long</span>
                            <div className="absolute -top-2 -right-2 bg-black text-amber-500 text-xs font-black size-6 rounded-full flex items-center justify-center shadow-md">{draftItemsCount}</div>
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-widest leading-none">Lançar Pedidos</h3>
                            <p className="text-sm font-bold text-black/70 mt-1">R$ {draftItemsValue.toFixed(2)}</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-3xl">chevron_right</span>
                </div>
            )}
        </div>
    );

    // ─── 4. ALERTAS (Pratos Prontos) ────────────────────────────────────────────
    const renderAlertas = () => (
        <div className="flex-1 overflow-y-auto p-4 bg-[#0d1218]">
            {readyByTable.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20 py-20">
                    <span className="material-symbols-outlined text-7xl">notifications_off</span>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-center">Nenhum Alerta<br /><span className="text-[10px] opacity-70">Cozinha Vazia</span></p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="px-2 pb-2 border-b border-white/5 mt-4">
                        <h2 className="text-2xl font-black text-white italic">PRATOS PRONTOS</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Retire no balcão imediatamente</p>
                    </div>
                    {readyByTable.map(({ tableId, items }) => (
                        <div key={tableId} className="bg-[#11161d] border-2 border-emerald-500/50 rounded-[2.5rem] overflow-hidden shadow-[0_10px_40px_rgba(16,185,129,0.15)] relative">
                            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-emerald-500/10">
                                <div className="flex items-center gap-4">
                                    <span className="flex h-4 w-4 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-3xl font-black text-emerald-400 italic tracking-tighter">MESA {tableId}</span>
                                </div>
                            </div>
                            <div className="divide-y divide-white/5 p-2">
                                {items.map((item, idx) => (
                                    <div key={idx} className="p-4 flex flex-col gap-1">
                                        <p className="text-lg font-black text-white">{item.qty}x {item.name}</p>
                                        {item.notes && <p className="text-sm text-emerald-400/80 font-bold italic">↳ {item.notes}</p>}
                                    </div>
                                ))}
                            </div>
                            <div className="p-5 bg-black/20">
                                <button onClick={() => items.forEach(i => updateItemStatus(tableId, i.id, 'SERVED'))} className="w-full h-16 bg-emerald-500 text-white rounded-[1.5rem] text-base font-black uppercase tracking-[0.15em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <span className="material-symbols-outlined text-2xl">done_all</span> Marcar Entregues
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const tabs: { id: TabId; icon: string; label: string; badge?: number; badgeColor?: string }[] = [
        { id: 'mesas', icon: 'grid_view', label: 'Salão' },
        { id: 'comanda', icon: 'receipt_long', label: 'Comanda', badge: draftItemsCount > 0 ? draftItemsCount : undefined, badgeColor: 'bg-amber-500' },
        { id: 'cardapio', icon: 'restaurant_menu', label: 'Cardápio' },
        { id: 'alertas', icon: 'notifications_active', label: 'Alertas', badge: notifyReadyCount > 0 ? notifyReadyCount : undefined, badgeColor: 'bg-emerald-500' },
    ];

    return (
        <div className="h-full flex flex-col bg-[#0d1218] overflow-hidden relative">

            {/* 🔔 TOASTS */}
            {globalToast && (
                <div className="absolute top-6 left-4 right-4 z-[100] animate-in slide-in-from-top-10 fade-in duration-300">
                    <div className={`p-5 rounded-3xl shadow-2xl flex justify-between items-center border-2 ${globalToast.type === 'success' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-[#11161d] border-indigo-500 text-white'}`}>
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-3xl">{globalToast.type === 'success' ? 'check_circle' : 'room_service'}</span>
                            <h4 className="text-base font-black">{globalToast.message}</h4>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {activeTab === 'mesas' && renderMesas()}
                {activeTab === 'comanda' && renderComanda()}
                {activeTab === 'cardapio' && renderCardapio()}
                {activeTab === 'alertas' && renderAlertas()}
            </div>

            {/* BOTTOM NAVIGATION (GIGANTE PARA POLEGAR) */}
            <nav className="shrink-0 bg-[#0d1317] border-t border-white/5 pb-safe pt-2 relative z-50">
                {/* Indicador do Servidor Local */}
                <div className="flex items-center justify-center gap-2 py-1">
                    <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isOnline ? 'Cozinha Online' : 'Sem Servidor'}
                    </span>
                    {pendingQueueCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded-full border border-amber-500/30">
                            {pendingQueueCount} aguardando sync
                        </span>
                    )}
                </div>
                <div className="flex px-2">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); if (tab.id === 'alertas') clearReadyNotifications(); }}
                                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative transition-all duration-300 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}
                            >
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span className={`absolute top-1 right-[20%] translate-x-2 size-6 rounded-full ${tab.badgeColor} text-white text-[11px] font-black flex items-center justify-center shadow-lg border-2 border-[#0d1317] animate-pulse z-10`}>
                                        {tab.badge > 9 ? '9+' : tab.badge}
                                    </span>
                                )}
                                <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110 -translate-y-1' : ''}`}>
                                    <span className={`material-symbols-outlined text-[28px] ${isActive ? 'fill-1' : ''}`}>{tab.icon}</span>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-70'}`}>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* ── MODAL: NOTAS (OBSERVAÇÃO) ────────────────────────────────────────────── */}
            {pendingItem && (
                <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setPendingItem(null)}>
                    <div className="w-full bg-[#11161d] border-t border-white/10 rounded-t-[3rem] p-6 pb-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-1.5 bg-white/20 rounded-full mx-auto mb-8"></div>
                        <div className="flex items-center gap-5 mb-8">
                            <div className="size-20 rounded-2xl overflow-hidden bg-black shrink-0 border border-white/10 shadow-lg">
                                <img src={pendingItem.image} className="w-full h-full object-cover" alt={pendingItem.name} />
                            </div>
                            <div>
                                <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg mb-2 inline-block">Mesa {activeTableId}</span>
                                <h3 className="text-2xl font-black text-white leading-tight">{pendingItem.name}</h3>
                            </div>
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Toques Rápidos</p>
                        <div className="flex gap-2 flex-wrap mb-8">
                            {QUICK_NOTES.map(note => {
                                const isActive = noteText.split(',').map(n => n.trim()).includes(note);
                                return (
                                    <button
                                        key={note}
                                        onClick={() => toggleQuickNote(note)}
                                        className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 active:scale-95 ${isActive ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500' : 'bg-white/5 text-slate-300 border-transparent'}`}
                                    >
                                        {note}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="bg-black/50 rounded-[1.5rem] p-5 border border-white/5 mb-8">
                            <input autoFocus type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva uma observação livre..." className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-600 font-bold" />
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setPendingItem(null)} className="px-8 py-5 bg-white/5 rounded-[1.5rem] text-slate-400 font-black uppercase text-xs active:scale-95 transition-all">Cancelar</button>
                            <button onClick={confirmAdd} className="flex-1 py-5 bg-indigo-600 rounded-[1.5rem] text-white text-sm font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                <span className="material-symbols-outlined text-xl">add_shopping_cart</span> Lançar Item
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: TROCAR MESA ────────────────────────────────────────────────── */}
            {isSwitchTableOpen && (
                <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/90 backdrop-blur-md animate-in fade-in" onClick={() => setIsSwitchTableOpen(false)}>
                    <div className="w-full bg-[#11161d] border-t border-white/10 rounded-t-[3rem] p-8 pb-10 shadow-2xl animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Transferir Mesa</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Selecione o novo destino para a Mesa {activeTableId}</p>

                        <div className="grid grid-cols-3 gap-4 max-h-64 overflow-y-auto custom-scrollbar mb-8">
                            {freeTables.map(table => (
                                <button key={table.id} onClick={() => handleSwitchTable(table.id)} className="p-5 bg-white/5 border-2 border-white/10 rounded-3xl flex flex-col items-center gap-2 active:bg-indigo-600 active:border-indigo-500 transition-all">
                                    <span className="text-2xl font-black text-white italic">{table.id}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsSwitchTableOpen(false)} className="w-full py-5 bg-white/5 rounded-3xl text-slate-400 text-xs font-black uppercase tracking-widest">Cancelar Transferência</button>
                    </div>
                </div>
            )}

            {/* ── MODAL: FECHAR CONTA ──────────────────────────────────────────────── */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/95 backdrop-blur-xl animate-in fade-in" onClick={() => paymentStep === 'summary' && setIsCheckoutOpen(false)}>
                    <div className="w-full bg-[#12161b] border-t border-white/10 rounded-t-[3rem] flex flex-col max-h-[90vh] shadow-[0_-20px_60px_rgba(255,255,255,0.05)] animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
                        {paymentStep === 'summary' && (
                            <div className="p-8 flex flex-col h-full overflow-hidden">
                                <div className="flex justify-between items-center mb-8 shrink-0">
                                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">MESA {activeTableId}</h2>
                                    <button onClick={() => setIsCheckoutOpen(false)} className="size-12 bg-white/10 rounded-2xl flex items-center justify-center text-slate-400">
                                        <span className="material-symbols-outlined text-2xl">close</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto bg-black/40 rounded-[2rem] p-6 border border-white/5 mb-6 space-y-4">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Extrato de Consumo</p>
                                    {currentCart.map((item, i) => (
                                        <div key={i} className="flex justify-between items-start text-base border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                            <div>
                                                <span className="text-white font-bold">{item.qty}x {item.name}</span>
                                            </div>
                                            <span className="text-slate-400 font-mono font-bold">R$ {(item.price * item.qty).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white text-black rounded-[2rem] p-6 shadow-xl mb-6 shrink-0">
                                    <div className="flex justify-between text-slate-600 text-sm font-black uppercase mb-2"><span>Subtotal</span><span>R$ {currentTotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-slate-600 text-sm font-black uppercase mb-4"><span>Serviço 10%</span><span>R$ {serviceFee.toFixed(2)}</span></div>
                                    <div className="pt-4 border-t border-black/10 flex justify-between items-center">
                                        <span className="font-black text-xl">TOTAL Pagar</span>
                                        <span className="text-4xl font-black italic tracking-tighter">R$ {grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleFinishPayment('solicitado')} className="w-full py-6 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-indigo-600/30">
                                    <span className="material-symbols-outlined text-2xl">payments</span> Solicitar no Caixa
                                </button>
                            </div>
                        )}

                        {paymentStep === 'processing' && (
                            <div className="h-96 flex flex-col items-center justify-center gap-8">
                                <div className="size-20 border-8 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Notificando Caixa...</h3>
                            </div>
                        )}

                        {paymentStep === 'success' && (
                            <div className="h-96 flex flex-col items-center justify-center gap-8 text-center px-8">
                                <div className="size-32 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)] animate-in zoom-in">
                                    <span className="material-symbols-outlined text-white text-7xl font-black">done_all</span>
                                </div>
                                <div>
                                    <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter mb-2">Conta Enviada!</h3>
                                    <p className="text-base text-slate-400 font-bold uppercase tracking-widest">Aguarde o caixa finalizar</p>
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