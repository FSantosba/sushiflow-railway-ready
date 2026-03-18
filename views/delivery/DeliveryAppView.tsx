import React, { useState, useMemo, useEffect } from 'react';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem, OrderStatus, Order } from '../../types';
import { useOrders } from '../../context/OrdersContext';
import CustomerTrackingView from './CustomerTrackingView';
import PixPaymentView from '../payment/PixPaymentView';
import axios from 'axios';

// ── Cupons válidos ─────────────────────────────────────────
const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
    'SUSHI10': { discount: 0.10, label: '10% OFF' },
    'BEMVINDO': { discount: 0.15, label: '15% de Boas-vindas' },
    'FRETE0': { discount: 0, label: 'Frete Grátis' },
};

const DELIVERY_FEE = 6.00; // Taxa padrão de entrega

interface CartItem { item: MenuItem; qty: number; obs: string; }

// ── Item do Carrinho com +/-/obs ────────────────────────────
const CartRow: React.FC<{
    entry: CartItem;
    onInc: () => void;
    onDec: () => void;
    onObs: (obs: string) => void;
}> = ({ entry, onInc, onDec, onObs }) => {
    const [editingObs, setEditingObs] = useState(false);
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{entry.item.name}</p>
                    <p className="text-xs text-slate-500 font-mono">R$ {(entry.item.price * entry.qty).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button onClick={onDec}
                        className="size-7 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/50 transition-all">
                        <span className="material-symbols-outlined text-sm">{entry.qty === 1 ? 'delete' : 'remove'}</span>
                    </button>
                    <span className="text-white font-black text-sm w-5 text-center">{entry.qty}</span>
                    <button onClick={onInc}
                        className="size-7 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all">
                        <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                </div>
            </div>
            {/* ✨ Observação por item */}
            {editingObs ? (
                <input
                    autoFocus
                    type="text"
                    placeholder="Ex: sem molho, bem passado..."
                    value={entry.obs}
                    onChange={e => onObs(e.target.value)}
                    onBlur={() => setEditingObs(false)}
                    className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-300 outline-none placeholder:text-slate-600"
                />
            ) : (
                <button onClick={() => setEditingObs(true)}
                    className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-400 transition-colors">
                    <span className="material-symbols-outlined text-xs">sticky_note_2</span>
                    {entry.obs || 'Adicionar observação'}
                </button>
            )}
        </div>
    );
};

// ── Componente Principal ────────────────────────────────────
const DeliveryAppView: React.FC = () => {
    const { addOrder } = useOrders();
    const [activeCategory, setActiveCategory] = useState<'sushi' | 'quentes' | 'bebidas'>('sushi');
    const [currentTab, setCurrentTab] = useState<'menu' | 'tracking'>('menu');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ pedidoId: string, pixCode: string, qrCode: string, total: number } | null>(null);
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

    // Dados do cliente com persistência
    const [customerName, setCustomerName] = useState(() => localStorage.getItem('@sushiflow:deliveryName') || '');
    const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('@sushiflow:deliveryPhone') || '');
    const [customerAddress, setCustomerAddress] = useState(() => localStorage.getItem('@sushiflow:deliveryAddress') || '');
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'dinheiro'>('pix');

    // ✨ Cupom de desconto
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; label: string } | null>(null);
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        localStorage.setItem('@sushiflow:deliveryName', customerName);
        localStorage.setItem('@sushiflow:deliveryPhone', customerPhone);
        localStorage.setItem('@sushiflow:deliveryAddress', customerAddress);
    }, [customerName, customerPhone, customerAddress]);

    const menuItems = useMemo(() => {
        switch (activeCategory) {
            case 'sushi': return sushiMenu;
            case 'quentes': return kitchenMenu;
            case 'bebidas': return barMenu;
            default: return [];
        }
    }, [activeCategory]);

    // ─── Cart Actions ────────────────────────────────────────
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(p => p.item.id === item.id);
            if (existing) return prev.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
            return [...prev, { item, qty: 1, obs: '' }];
        });
    };

    // ✨ Bug fix: lógica correta de remoção
    const decrementCart = (itemId: string) => {
        setCart(prev => {
            const entry = prev.find(p => p.item.id === itemId);
            if (!entry) return prev;
            if (entry.qty === 1) return prev.filter(p => p.item.id !== itemId);
            return prev.map(p => p.item.id === itemId ? { ...p, qty: p.qty - 1 } : p);
        });
    };

    const updateObs = (itemId: string, obs: string) => {
        setCart(prev => prev.map(p => p.item.id === itemId ? { ...p, obs } : p));
    };

    // ─── Totais ──────────────────────────────────────────────
    const subtotal = cart.reduce((acc, p) => acc + p.item.price * p.qty, 0);
    const isFreteFree = appliedCoupon?.code === 'FRETE0';
    const effectiveDeliveryFee = isFreteFree ? 0 : DELIVERY_FEE;
    const discountAmount = appliedCoupon ? subtotal * appliedCoupon.discount : 0;
    const cartTotal = subtotal + effectiveDeliveryFee - discountAmount;

    // ─── Cupom ───────────────────────────────────────────────
    const applyCoupon = () => {
        const code = couponInput.toUpperCase().trim();
        const coupon = VALID_COUPONS[code];
        if (coupon) {
            setAppliedCoupon({ code, ...coupon });
            setCouponError('');
        } else {
            setCouponError('Cupom inválido ou expirado.');
            setAppliedCoupon(null);
        }
    };

    // ─── Checkout ────────────────────────────────────────────
    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName || !customerPhone || !customerAddress || isProcessingCheckout) return;

        setIsProcessingCheckout(true);

        try {
            // Se for Pix, chamamos a nossa nova API de Checkout
            if (paymentMethod === 'pix') {
                const response = await axios.post('http://localhost:3001/api/checkout', {
                    cliente_id: 'cliente-logado-123', // Mock
                    itens: cart.map(c => ({ id: c.item.id, preco: c.item.price, quantidade: c.qty })),
                    taxa_entrega: effectiveDeliveryFee
                });

                if (response.data) {
                    setPixData({
                        pedidoId: response.data.pedido_id,
                        pixCode: response.data.pix_copia_e_cola,
                        qrCode: response.data.pix_qr_code,
                        total: response.data.total
                    });
                }
                setIsProcessingCheckout(false);
                return;
            }

            // Para outros métodos (Dinheiro/Cartão), segue o fluxo tradicional (pago na entrega)
            const orderId = Math.floor(1000 + Math.random() * 9000).toString();
            const notesArr = [
                `Pagamento: ${paymentMethod.toUpperCase()}`,
                ...(appliedCoupon ? [`Cupom: ${appliedCoupon.code} (${appliedCoupon.label})`] : []),
                ...cart.filter(c => c.obs).map(c => `${c.item.name}: ${c.obs}`),
            ];

            addOrder({
                id: orderId,
                clienteId: 'cliente-logado-123',
                valorItens: subtotal,
                taxaEntrega: effectiveDeliveryFee,
                totalGeral: cartTotal,
                status: OrderStatus.EM_PREPARO,
                enderecoEntrega: { rua: customerAddress, numero: '', bairro: '', cidade: '' },
                createdAt: new Date().toISOString(),
                clienteNome: customerName,
                itens: cart.map(c => ({ productId: c.item.id, nome: c.item.name, quantidade: c.qty, precoUnitario: c.item.price }))
            } as any); // Type cast for now as Order type is more complex

            setSuccessOrderId(orderId);
            setOrderSuccess(true);
            setCart([]);
            setCurrentTab('tracking'); // ✨ Auto switch to tracking
            setIsCheckoutOpen(false);
        } catch (error) {
            console.error("Erro no checkout:", error);
            alert("Ocorreu um erro ao processar seu pedido. Tente novamente.");
        } finally {
            setIsProcessingCheckout(false);
        }
    };

    const onPixPaymentSuccess = () => {
        if (!pixData) return;

        // Adiciona ao contexto com status PAGO
        addOrder({
            id: pixData.pedidoId,
            clienteId: 'cliente-logado-123',
            valorItens: subtotal,
            taxaEntrega: effectiveDeliveryFee,
            totalGeral: cartTotal,
            status: OrderStatus.PAGO,
            enderecoEntrega: { rua: customerAddress, numero: '', bairro: '', cidade: '' },
            createdAt: new Date().toISOString(),
            clienteNome: customerName,
            itens: cart.map(c => ({ productId: c.item.id, nome: c.item.name, quantidade: c.qty, precoUnitario: c.item.price }))
        } as any);

        setSuccessOrderId(pixData.pedidoId);
        setPixData(null);
        setOrderSuccess(true);
        setCart([]);
        setCurrentTab('tracking'); // ✨ Auto switch to tracking
        setIsCheckoutOpen(false);
    };

    if (pixData) {
        return (
            <PixPaymentView 
                pedidoId={pixData.pedidoId}
                pixCode={pixData.pixCode}
                qrCodeBase64={pixData.qrCode}
                total={pixData.total}
                onPaymentConfirmed={onPixPaymentSuccess}
                onCancel={() => setPixData(null)}
            />
        );
    }

    // -- Render Logic based on Tab --
    const renderBody = () => {
        if (currentTab === 'tracking') return <CustomerTrackingView />;
        
        return (
            <>
                {/* ── Header ───────────────────────────────── */}
                <header className="px-6 pb-4 pt-10 bg-gradient-to-b from-black to-transparent shrink-0 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-black italic tracking-tighter text-white">
                            SushiFlow<span className="text-primary text-xl">.</span>delivery
                        </h1>
                        <div className="flex items-center gap-2">
                            {/* ✨ Tempo estimado */}
                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-orange-400">schedule</span>
                                35–45 min
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Aberto
                            </span>
                        </div>
                    </div>

                    {/* ✨ Banner de destaque — Produto do dia */}
                    {featuredItem && (
                        <div
                            className="relative rounded-2xl overflow-hidden mb-4 cursor-pointer group"
                            onClick={() => addToCart(featuredItem)}
                        >
                            <img src={featuredItem.image} alt={featuredItem.name}
                                className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex flex-col justify-center px-5">
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">⭐ Mais Pedido</span>
                                <h3 className="text-white font-black text-base leading-tight">{featuredItem.name}</h3>
                                <p className="text-emerald-400 font-black text-sm italic mt-1">R$ {featuredItem.price.toFixed(2)}</p>
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="size-10 bg-primary rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(230,99,55,0.5)]">
                                    <span className="material-symbols-outlined text-white text-xl">add</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Categorias */}
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {([
                            { id: 'sushi', label: '🍣 Sushi Bar' },
                            { id: 'quentes', label: '🔥 Pratos Quentes' },
                            { id: 'bebidas', label: '🍶 Bebidas' },
                        ] as const).map(cat => (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all shrink-0 ${activeCategory === cat.id
                                        ? 'bg-white text-black'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}>
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* ── Lista de Produtos ─────────────────────── */}
                <main className="flex-1 overflow-y-auto px-4 pb-32 custom-scrollbar">
                    <div className="space-y-4 pt-2">
                        {menuItems.map(item => {
                            const inCart = cart.find(c => c.item.id === item.id);
                            return (
                                <div key={item.id}
                                    className={`flex gap-4 border rounded-3xl p-3 transition-all ${!item.available
                                            ? 'opacity-40 border-white/5 bg-white/2'
                                            : 'bg-white/3 border-white/5 hover:border-primary/30'
                                        }`}>
                                    <div className="relative shrink-0">
                                        <img src={item.image} alt={item.name}
                                            className="w-28 h-28 rounded-2xl object-cover" />
                                        {item.bestSeller && (
                                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-primary rounded-md text-[8px] font-black text-white uppercase">
                                                + pedido
                                            </span>
                                        )}
                                        {!item.available && (
                                            <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Esgotado</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="text-white font-black leading-tight text-sm">{item.name}</h3>
                                                <div className="flex gap-1 shrink-0">
                                                    {item.vegan && <span className="material-symbols-outlined text-emerald-400 text-sm" title="Vegano">eco</span>}
                                                    {item.spicy && <span className="material-symbols-outlined text-rose-500 text-sm" title="Apimentado">local_fire_department</span>}
                                                    {item.glutenFree && <span className="text-[9px] font-black text-amber-400 border border-amber-400/30 rounded px-1">GF</span>}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 leading-snug">{item.description}</p>
                                        </div>
                                        <div className="flex justify-between items-end mt-2">
                                            <span className="text-primary font-black text-base italic">R$ {item.price.toFixed(2)}</span>

                                            {/* ✨ Controles +/- no menu também */}
                                            {inCart ? (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => decrementCart(item.id)}
                                                        className="size-8 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-rose-500/20 transition-all">
                                                        <span className="material-symbols-outlined text-sm">{inCart.qty === 1 ? 'delete' : 'remove'}</span>
                                                    </button>
                                                    <span className="text-white font-black text-sm">{inCart.qty}</span>
                                                    <button onClick={() => addToCart(item)}
                                                        className="size-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80 transition-all">
                                                        <span className="material-symbols-outlined text-sm">add</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => item.available && addToCart(item)}
                                                    disabled={!item.available}
                                                    className="size-9 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center transition-colors disabled:opacity-30">
                                                    <span className="material-symbols-outlined text-xl">add</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </>
        );
    };

    const cartCount = cart.reduce((a, b) => a + b.qty, 0);
    const featuredItem = sushiMenu.find(i => i.bestSeller && i.available);

    return (
        <div className="h-full w-full flex justify-center bg-[#000000] overflow-hidden font-sans">
            <div className="w-full max-w-[480px] h-full bg-[#000000] flex flex-col border-x border-white/5 mx-auto relative">

                {renderBody()}

                {/* ── Bottom Navigation ────────────────────── */}
                <nav className="absolute bottom-0 left-0 right-0 z-40 bg-[#12161b]/95 backdrop-blur-xl border-t border-white/5 px-8 pt-4 pb-8 flex justify-around">
                    <button onClick={() => setCurrentTab('menu')}
                        className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'menu' ? 'text-primary scale-110' : 'text-slate-500 hover:text-white'}`}>
                        <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Cardápio</span>
                    </button>
                    <button onClick={() => setCurrentTab('tracking')}
                        className={`flex flex-col items-center gap-1 transition-all ${currentTab === 'tracking' ? 'text-primary scale-110' : 'text-slate-500 hover:text-white'}`}>
                        <span className="material-symbols-outlined text-2xl">local_shipping</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Acompanhar</span>
                    </button>
                </nav>

                {/* ✨ Floating Cart Button */}
                {cart.length > 0 && !isCheckoutOpen && (
                    <div className="absolute bottom-8 left-6 right-6 z-20 animate-in slide-in-from-bottom-10">
                        <button onClick={() => setIsCheckoutOpen(true)}
                            className="w-full bg-primary text-white rounded-2xl p-4 flex items-center justify-between shadow-[0_10px_40px_rgba(230,99,55,0.4)] hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-3">
                                <div className="size-8 bg-black/20 rounded-full flex items-center justify-center font-black text-sm">
                                    {cartCount}
                                </div>
                                <span className="font-black uppercase tracking-widest text-sm">Ver Carrinho</span>
                            </div>
                            <span className="text-xl font-black italic">R$ {(subtotal + effectiveDeliveryFee).toFixed(2)}</span>
                        </button>
                    </div>
                )}

                {/* ── Checkout Bottom Sheet ─────────────────── */}
                {isCheckoutOpen && (
                    <div className="absolute inset-0 z-50 flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
                        <div className="bg-[#0d1117] w-full rounded-t-[2.5rem] border-t border-white/10 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300 relative z-10">

                            <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                                <h2 className="text-xl font-black text-white italic">Seu Pedido</h2>
                                <button onClick={() => setIsCheckoutOpen(false)}
                                    className="size-8 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-6">

                                {/* ✨ Itens com +/- e observações */}
                                <div className="space-y-5 divide-y divide-white/5">
                                    {cart.map(entry => (
                                        <div key={entry.item.id} className="pt-4 first:pt-0">
                                            <CartRow
                                                entry={entry}
                                                onInc={() => addToCart(entry.item)}
                                                onDec={() => decrementCart(entry.item.id)}
                                                onObs={obs => updateObs(entry.item.id, obs)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* ✨ Cupom de desconto */}
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Cupom de Desconto</h3>
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-400">{appliedCoupon.code}</p>
                                                    <p className="text-[10px] text-slate-400">{appliedCoupon.label}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}
                                                className="text-slate-500 hover:text-rose-400 transition-colors">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="CÓDIGO DO CUPOM"
                                                value={couponInput}
                                                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                                                onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary font-mono uppercase tracking-widest placeholder:text-slate-700"
                                            />
                                            <button onClick={applyCoupon}
                                                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-slate-300 transition-all">
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                    {couponError && <p className="text-[10px] text-rose-400 mt-2 font-bold">{couponError}</p>}
                                </div>

                                {/* Formulário de entrega */}
                                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Dados de Entrega</h3>
                                    <input required type="text" placeholder="Nome Completo" value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
                                    <input required type="tel" placeholder="WhatsApp" value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
                                    <textarea required placeholder="Endereço Completo (Rua, Número, Bairro)" value={customerAddress}
                                        onChange={e => setCustomerAddress(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary h-20 resize-none" />

                                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest pt-2">Pagamento na Entrega</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { id: 'pix', label: 'Pix', icon: 'qr_code' },
                                            { id: 'cartao', label: 'Cartão', icon: 'credit_card' },
                                            { id: 'dinheiro', label: 'Dinheiro', icon: 'payments' },
                                        ] as const).map(pm => (
                                            <button key={pm.id} type="button"
                                                onClick={() => setPaymentMethod(pm.id)}
                                                className={`p-3 rounded-xl flex flex-col items-center gap-1.5 border transition-all ${paymentMethod === pm.id
                                                        ? 'bg-primary/10 border-primary text-primary'
                                                        : 'bg-black/30 border-white/5 text-slate-400 hover:bg-white/5'
                                                    }`}>
                                                <span className="material-symbols-outlined text-xl">{pm.icon}</span>
                                                <span className="text-[10px] font-bold uppercase">{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </form>
                            </div>

                            {/* ✨ Resumo de valores + botão confirmar */}
                            <div className="px-6 py-5 bg-black/20 border-t border-white/5 shrink-0 space-y-2">
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Subtotal</span>
                                    <span>R$ {subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Taxa de entrega</span>
                                    <span className={isFreteFree ? 'text-emerald-400 font-bold line-through-none' : ''}>
                                        {isFreteFree ? 'Grátis 🎉' : `R$ ${DELIVERY_FEE.toFixed(2)}`}
                                    </span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-xs text-emerald-400 font-bold">
                                        <span>Desconto ({appliedCoupon?.label})</span>
                                        <span>- R$ {discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <span className="text-slate-400 font-black uppercase text-xs">Total</span>
                                    <span className="text-2xl font-black text-white italic">R$ {cartTotal.toFixed(2)}</span>
                                </div>
                                <button form="checkout-form" type="submit" disabled={isProcessingCheckout}
                                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(230,99,55,0.3)] hover:scale-[1.02] transition-transform mt-1 disabled:opacity-50">
                                    {isProcessingCheckout ? 'Processando...' : 'Confirmar Pedido'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryAppView;
