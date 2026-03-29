import React, { useState, useMemo, useEffect } from 'react';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem, OrderStatus, Order } from '../../types';
import { useOrders } from '../../context/OrdersContext';
import CustomerTrackingView from './CustomerTrackingView';
import PixPaymentView from '../payment/PixPaymentView';
import axios from 'axios';

// ✨ NOVO: Importando a inteligência geográfica
import { calcularViabilidadeDeEntrega, DeliveryZone } from '../../utils/deliveryMath';

// ✨ NOVO: Substitua pela sua chave do Google Cloud
const GOOGLE_API_KEY = "SUA_CHAVE_AQUI";

// ── Cupons válidos ─────────────────────────────────────────
const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
    'SUSHI10': { discount: 0.10, label: '10% OFF' },
    'BEMVINDO': { discount: 0.15, label: '15% de Boas-vindas' },
    'FRETE0': { discount: 0, label: 'Frete Grátis' },
};

// ✨ NOVO: Removida a taxa fixa (const DELIVERY_FEE = 6.00;)

interface CartItem { item: MenuItem; qty: number; obs: string; }

// ── Toast Notification ──────────────────────────────────────
interface ToastMsg { id: number; text: string; type: 'success' | 'error' | 'info'; }

const Toast: React.FC<{ messages: ToastMsg[]; onDismiss: (id: number) => void }> = ({ messages, onDismiss }) => (
    <div className="absolute top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {messages.map(msg => (
            <div
                key={msg.id}
                onClick={() => onDismiss(msg.id)}
                className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl animate-in slide-in-from-top-4 duration-300 text-sm font-bold cursor-pointer
                    ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        msg.type === 'error' ? 'bg-rose-50    border-rose-200    text-rose-700' :
                            'bg-white      border-slate-200   text-slate-700'}`}
            >
                <span className="material-symbols-outlined text-base">
                    {msg.type === 'success' ? 'check_circle' : msg.type === 'error' ? 'error' : 'info'}
                </span>
                {msg.text}
            </div>
        ))}
    </div>
);

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
interface DeliveryAppViewProps {
    onNavigate?: (view: string) => void;
}

const DeliveryAppView: React.FC<DeliveryAppViewProps> = ({ onNavigate }) => {
    const { addOrder } = useOrders();
    const [activeCategory, setActiveCategory] = useState<'sushi' | 'quentes' | 'bebidas'>('sushi');
    const [currentTab, setCurrentTab] = useState<'menu' | 'tracking'>('menu');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ pedidoId: string, pixCode: string, qrCode: string, total: number } | null>(null);
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    const showToast = (text: string, type: ToastMsg['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };
    const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const [customerName, setCustomerName] = useState(() => localStorage.getItem('@sushiflow:deliveryName') || '');
    const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('@sushiflow:deliveryPhone') || '');
    const [customerStreet, setCustomerStreet] = useState(() => localStorage.getItem('@sushiflow:deliveryStreet') || '');
    const [customerNumber, setCustomerNumber] = useState(() => localStorage.getItem('@sushiflow:deliveryNumber') || '');
    const [customerHood, setCustomerHood] = useState(() => localStorage.getItem('@sushiflow:deliveryHood') || '');
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'dinheiro'>('pix');
    const [searchQuery, setSearchQuery] = useState('');
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; label: string } | null>(null);
    const [couponError, setCouponError] = useState('');

    // ✨ NOVO: Estados de validação de frete
    const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]); // Será preenchido pelo Firebase futuramente
    const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number | null>(null);
    const [isAddressValid, setIsAddressValid] = useState(false);
    const [isCheckingAddress, setIsCheckingAddress] = useState(false);

    useEffect(() => {
        localStorage.setItem('@sushiflow:deliveryName', customerName);
        localStorage.setItem('@sushiflow:deliveryPhone', customerPhone);
        localStorage.setItem('@sushiflow:deliveryStreet', customerStreet);
        localStorage.setItem('@sushiflow:deliveryNumber', customerNumber);
        localStorage.setItem('@sushiflow:deliveryHood', customerHood);
    }, [customerName, customerPhone, customerStreet, customerNumber, customerHood]);

    // ✨ NOVO: Efeito que escuta a digitação do endereço com debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (customerStreet.trim().length > 3 && customerNumber.trim().length > 0) {
                validarLocalizacao();
            } else {
                setIsAddressValid(false);
                setDynamicDeliveryFee(null);
            }
        }, 1500); // Aguarda 1.5s após o cliente parar de digitar
        return () => clearTimeout(timer);
    }, [customerStreet, customerNumber, customerHood]);

    const validarLocalizacao = async () => {
        // Se ainda não carregou as zonas do banco, permite mockar ou pular
        if (deliveryZones.length === 0) return;

        setIsCheckingAddress(true);
        const enderecoCompleto = `${customerStreet}, ${customerNumber} - ${customerHood}`;

        // Passamos Bragança Paulista como padrão para o Google Maps focar na cidade correta
        const resultado = await calcularViabilidadeDeEntrega(
            enderecoCompleto,
            deliveryZones,
            GOOGLE_API_KEY,
            "Bragança Paulista"
        );

        if (resultado.sucesso && resultado.zona) {
            setDynamicDeliveryFee(resultado.zona.fee);
            setIsAddressValid(true);
            showToast(`Área: ${resultado.zona.name} | Frete: R$ ${resultado.zona.fee.toFixed(2)}`, 'success');
        } else {
            setDynamicDeliveryFee(null);
            setIsAddressValid(false);
            showToast(resultado.mensagem, 'error');
        }
        setIsCheckingAddress(false);
    };

    const allMenuItems = useMemo(() => {
        switch (activeCategory) {
            case 'sushi': return sushiMenu;
            case 'quentes': return kitchenMenu;
            case 'bebidas': return barMenu;
            default: return [];
        }
    }, [activeCategory]);

    const menuItems = useMemo(() => {
        if (!searchQuery.trim()) return allMenuItems;
        const q = searchQuery.toLowerCase();
        return allMenuItems.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.description || '').toLowerCase().includes(q)
        );
    }, [allMenuItems, searchQuery]);

    const featuredItem = useMemo(() =>
        allMenuItems.find(i => i.bestSeller && i.available),
        [allMenuItems]);

    // ─── Cart Actions ────────────────────────────────────────
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(p => p.item.id === item.id);
            if (existing) return prev.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
            return [...prev, { item, qty: 1, obs: '' }];
        });
    };

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

    // ─── Totais (Atualizados com Frete Dinâmico) ─────────────
    const subtotal = cart.reduce((acc, p) => acc + p.item.price * p.qty, 0);
    const isFreteFree = appliedCoupon?.code === 'FRETE0';

    // ✨ NOVO: effectiveDeliveryFee usa a taxa dinâmica calculada pelo mapa
    const effectiveDeliveryFee = isFreteFree ? 0 : (dynamicDeliveryFee ?? 0);
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

    const fullAddress = [customerStreet, customerNumber, customerHood].filter(Boolean).join(', ');

    // ─── Checkout ────────────────────────────────────────────
    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();

        // ✨ NOVO: Bloqueia o pedido se o endereço estiver fora da área ou não verificado (desde que existam zonas cadastradas)
        if (deliveryZones.length > 0 && !isAddressValid) {
            showToast('Ops! Seu endereço está fora da nossa área de cobertura.', 'error');
            return;
        }

        if (!customerName || !customerPhone || !customerStreet || isProcessingCheckout) return;

        setIsProcessingCheckout(true);

        try {
            if (paymentMethod === 'pix') {
                const response = await axios.post('http://localhost:3001/api/checkout', {
                    cliente_id: 'cliente-logado-123',
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
                enderecoEntrega: { rua: customerStreet, numero: customerNumber, bairro: customerHood, cidade: 'Bragança Paulista' },
                createdAt: new Date().toISOString(),
                clienteNome: customerName,
                itens: cart.map(c => ({ productId: c.item.id, nome: c.item.name, quantidade: c.qty, precoUnitario: c.item.price }))
            } as any);

            setSuccessOrderId(orderId);
            setOrderSuccess(true);
            setCart([]);
            setCurrentTab('tracking');
            setIsCheckoutOpen(false);
            showToast('Pedido confirmado! Acompanhe o status.', 'success');
        } catch (error) {
            console.error('Erro no checkout:', error);
            showToast('Erro ao processar pedido. Tente novamente.', 'error');
        } finally {
            setIsProcessingCheckout(false);
        }
    };

    const onPixPaymentSuccess = () => {
        if (!pixData) return;

        addOrder({
            id: pixData.pedidoId,
            clienteId: 'cliente-logado-123',
            valorItens: subtotal,
            taxaEntrega: effectiveDeliveryFee,
            totalGeral: cartTotal,
            status: OrderStatus.PAGO,
            enderecoEntrega: { rua: customerStreet, numero: customerNumber, bairro: customerHood, cidade: 'Bragança Paulista' },
            createdAt: new Date().toISOString(),
            clienteNome: customerName,
            itens: cart.map(c => ({ productId: c.item.id, nome: c.item.name, quantidade: c.qty, precoUnitario: c.item.price }))
        } as any);

        setSuccessOrderId(pixData.pedidoId);
        setPixData(null);
        setOrderSuccess(true);
        setCart([]);
        setCurrentTab('tracking');
        setIsCheckoutOpen(false);
        showToast('Pagamento confirmado! Acompanhe o status.', 'success');
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

    const cartCount = cart.reduce((a, b) => a + b.qty, 0);

    // ── Paleta de cores do tema claro ───────────────────────
    const C = {
        bg: 'bg-[#f7f3ee]',
        card: 'bg-white',
        cardBorder: 'border-[#e8e0d6]',
        headerBg: 'bg-[#f7f3ee]',
        navBg: 'bg-white border-t border-[#e8e0d6]',
        text: 'text-[#1a1208]',
        subtext: 'text-[#7a6a5a]',
        inputBg: 'bg-white border border-[#ddd5c8]',
        catActive: 'bg-[#1a1208] text-white',
        catIdle: 'bg-white border border-[#e0d8cf] text-[#7a6a5a] hover:border-[#c9bfb2]',
        sheetBg: 'bg-white',
    };

    const renderBody = () => {
        if (currentTab === 'tracking') return <CustomerTrackingView />;

        return (
            <>
                {/* ── Header estilo GloriaFood ── */}
                <header className={`${C.headerBg} shrink-0 relative z-10`}>
                    {/* Banner do restaurante */}
                    <div className="relative h-28 bg-gradient-to-br from-[#1a1208] to-[#3a2a18] overflow-hidden">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #e66337 0%, transparent 60%)' }} />
                        <div className="absolute inset-0 px-5 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black italic tracking-tighter text-white">
                                    SushiFlow<span className="text-primary">.</span>
                                </h1>
                                <p className="text-[11px] text-white/60 font-bold uppercase tracking-widest">Delivery Premium</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="flex items-center gap-1 text-[10px] text-white/80 font-bold">
                                        <span className="material-symbols-outlined text-xs text-orange-400">schedule</span>
                                        35–45 min
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-white/80 font-bold">
                                        <span className="material-symbols-outlined text-xs text-orange-400">delivery_dining</span>
                                        Grátis acima R$80
                                    </span>
                                </div>
                            </div>
                            <span className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Aberto
                            </span>
                        </div>
                    </div>

                    {/* Busca + Categorias coladas abaixo do banner */}
                    <div className={`px-4 pt-3 pb-2 ${C.headerBg} shadow-sm`}>
                        <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#a89888] text-base pointer-events-none">search</span>
                            <input
                                type="text"
                                placeholder="Buscar no cardápio..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className={`w-full ${C.inputBg} rounded-full pl-9 pr-4 py-2 text-sm ${C.text} outline-none focus:border-primary/60 placeholder:text-[#b0a090] transition-colors`}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${C.subtext} hover:text-primary transition-colors`}>
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                            {([
                                { id: 'sushi', label: '🍣 Sushi Bar' },
                                { id: 'quentes', label: '🔥 Pratos Quentes' },
                                { id: 'bebidas', label: '🍶 Bebidas' },
                            ] as const).map(cat => (
                                <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); }}
                                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all shrink-0 ${activeCategory === cat.id ? C.catActive : C.catIdle}`}>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ── Lista de Produtos (scrollável) ───────── */}
                <main className={`flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar ${C.bg}`}>

                    {/* Banner "Mais Pedido" scrollável junto com os itens */}
                    {featuredItem && !searchQuery && (
                        <div
                            className="relative rounded-2xl overflow-hidden mt-4 mb-5 cursor-pointer group shadow-sm"
                            onClick={() => addToCart(featuredItem)}
                        >
                            <img src={featuredItem.image} alt={featuredItem.name}
                                className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent flex flex-col justify-center px-5">
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">⭐ Mais Pedido</span>
                                <h3 className="text-white font-black text-base leading-tight">{featuredItem.name}</h3>
                                <p className="text-emerald-300 font-black text-sm italic mt-1">R$ {featuredItem.price.toFixed(2)}</p>
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="size-10 bg-primary rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(230,99,55,0.45)]">
                                    <span className="material-symbols-outlined text-white text-xl">add</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {menuItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className={`material-symbols-outlined text-4xl ${C.subtext} mb-3`}>search_off</span>
                            <p className={`${C.subtext} font-bold text-sm`}>Nenhum item encontrado</p>
                            <button onClick={() => setSearchQuery('')} className="text-primary text-xs font-black mt-2 hover:underline">
                                Limpar busca
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-2">
                            {menuItems.map(item => {
                                const inCart = cart.find(c => c.item.id === item.id);
                                return (
                                    <div key={item.id}
                                        className={`flex gap-3 border rounded-2xl p-3 transition-all ${!item.available
                                            ? `opacity-40 ${C.cardBorder} ${C.card}`
                                            : `${C.card} ${C.cardBorder} hover:border-primary/40 shadow-sm hover:shadow-md`
                                            }`}>
                                        <div className="relative shrink-0">
                                            <img src={item.image} alt={item.name}
                                                className="w-24 h-24 rounded-xl object-cover" />
                                            {item.bestSeller && (
                                                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-primary rounded-md text-[8px] font-black text-white uppercase">
                                                    + pedido
                                                </span>
                                            )}
                                            {!item.available && (
                                                <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center">
                                                    <span className={`text-[10px] font-black ${C.subtext} uppercase`}>Esgotado</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className={`${C.text} font-black leading-tight text-sm`}>{item.name}</h3>
                                                    <div className="flex gap-1 shrink-0">
                                                        {item.vegan && <span className="material-symbols-outlined text-emerald-500 text-sm" title="Vegano">eco</span>}
                                                        {item.spicy && <span className="material-symbols-outlined text-rose-500 text-sm" title="Apimentado">local_fire_department</span>}
                                                        {item.glutenFree && <span className="text-[9px] font-black text-amber-600 border border-amber-300 rounded px-1">GF</span>}
                                                    </div>
                                                </div>
                                                <p className={`text-[10px] ${C.subtext} mt-1 line-clamp-2 leading-snug`}>{item.description}</p>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <span className="text-primary font-black text-base italic">R$ {item.price.toFixed(2)}</span>
                                                {inCart ? (
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => decrementCart(item.id)}
                                                            className={`size-8 rounded-full ${C.card} border ${C.cardBorder} ${C.text} flex items-center justify-center hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm`}>
                                                            <span className="material-symbols-outlined text-sm">{inCart.qty === 1 ? 'delete' : 'remove'}</span>
                                                        </button>
                                                        <span className={`${C.text} font-black text-sm`}>{inCart.qty}</span>
                                                        <button onClick={() => addToCart(item)}
                                                            className="size-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80 transition-all shadow-sm">
                                                            <span className="material-symbols-outlined text-sm">add</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => item.available && addToCart(item)}
                                                        disabled={!item.available}
                                                        className={`size-9 rounded-full ${C.card} border ${C.cardBorder} ${C.text} flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors disabled:opacity-30 shadow-sm`}>
                                                        <span className="material-symbols-outlined text-xl">add</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </>
        );
    };

    return (
        <div className={`h-full w-full flex justify-center ${C.bg} overflow-hidden font-sans`}>
            <div className={`w-full max-w-[480px] h-full ${C.bg} flex flex-col border-x ${C.cardBorder} mx-auto relative`}>

                <Toast messages={toasts} onDismiss={dismissToast} />

                {renderBody()}

                {/* ── Bottom Navigation (GloriaFood style) ── */}
                <nav className={`absolute bottom-0 left-0 right-0 z-40 ${C.navBg} flex`}>
                    <button onClick={() => setCurrentTab('menu')}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-3 pb-5 transition-all relative border-t-2 ${
                            currentTab === 'menu' ? 'border-primary text-primary' : `border-transparent ${C.subtext}`
                        }`}>
                        <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Cardápio</span>
                        {cartCount > 0 && (
                            <span className="absolute top-2 right-[calc(50%-22px)] min-w-[18px] h-[18px] bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                                {cartCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setCurrentTab('tracking')}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-3 pb-5 transition-all border-t-2 ${
                            currentTab === 'tracking' ? 'border-primary text-primary' : `border-transparent ${C.subtext}`
                        }`}>
                        <span className="material-symbols-outlined text-2xl">local_shipping</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Meu Pedido</span>
                    </button>
                </nav>

                {/* Botão carrinho flutuante */}
                {cart.length > 0 && !isCheckoutOpen && currentTab === 'menu' && (

                    <div className="absolute bottom-[72px] left-4 right-4 z-50 animate-in slide-in-from-bottom-10">
                        <button onClick={() => setIsCheckoutOpen(true)}
                            className="w-full bg-primary text-white rounded-2xl p-4 flex items-center justify-between shadow-[0_8px_32px_rgba(230,99,55,0.35)] hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-3">
                                <div className="size-8 bg-white/20 rounded-full flex items-center justify-center font-black text-sm">
                                    {cartCount}
                                </div>
                                <span className="font-black uppercase tracking-widest text-sm">Ver Carrinho</span>
                            </div>
                            <span className="text-xl font-black italic">R$ {cartTotal.toFixed(2)}</span>
                        </button>
                    </div>
                )}

                {/* ── Checkout Bottom Sheet ─────────────────── */}
                {isCheckoutOpen && (
                    <div className="absolute inset-0 z-50 flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
                        <div className={`${C.sheetBg} w-full rounded-t-[2.5rem] border-t ${C.cardBorder} flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300 relative z-10`}>

                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 bg-black/10 rounded-full" />
                            </div>

                            <div className={`p-6 border-b ${C.cardBorder} flex justify-between items-center shrink-0`}>
                                <h2 className={`text-xl font-black ${C.text} italic`}>Seu Pedido</h2>
                                <button onClick={() => setIsCheckoutOpen(false)}
                                    className={`size-8 ${C.card} border ${C.cardBorder} rounded-full flex items-center justify-center ${C.subtext} hover:text-primary transition-colors`}>
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-6">
                                <div className="space-y-5 divide-y divide-black/5">
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

                                <div>
                                    <h3 className={`text-[10px] font-black ${C.subtext} uppercase tracking-widest mb-3`}>Cupom de Desconto</h3>
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-700">{appliedCoupon.code}</p>
                                                    <p className={`text-[10px] ${C.subtext}`}>{appliedCoupon.label}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}
                                                className={`${C.subtext} hover:text-rose-500 transition-colors`}>
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
                                                className={`flex-1 ${C.inputBg} rounded-xl px-4 py-2.5 text-xs ${C.text} outline-none focus:border-primary font-mono uppercase tracking-widest placeholder:text-[#c0b0a0]`}
                                            />
                                            <button onClick={applyCoupon}
                                                className={`px-4 py-2.5 ${C.card} border ${C.cardBorder} rounded-xl text-xs font-black ${C.subtext} hover:border-primary hover:text-primary transition-all`}>
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                    {couponError && <p className="text-[10px] text-rose-500 mt-2 font-bold">{couponError}</p>}
                                </div>

                                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Dados de Entrega</h3>
                                    <input required type="text" placeholder="Nome Completo" value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className={`w-full ${C.inputBg} rounded-xl px-4 py-3 text-sm ${C.text} outline-none focus:border-primary`} />
                                    <input required type="tel" placeholder="WhatsApp" value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        className={`w-full ${C.inputBg} rounded-xl px-4 py-3 text-sm ${C.text} outline-none focus:border-primary`} />

                                    <input required type="text" placeholder="Rua / Avenida" value={customerStreet}
                                        onChange={e => setCustomerStreet(e.target.value)}
                                        className={`w-full ${C.inputBg} rounded-xl px-4 py-3 text-sm ${C.text} outline-none focus:border-primary`} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input required type="text" placeholder="Número" value={customerNumber}
                                            onChange={e => setCustomerNumber(e.target.value)}
                                            className={`w-full ${C.inputBg} rounded-xl px-4 py-3 text-sm ${C.text} outline-none focus:border-primary`} />
                                        <input type="text" placeholder="Bairro" value={customerHood}
                                            onChange={e => setCustomerHood(e.target.value)}
                                            className={`w-full ${C.inputBg} rounded-xl px-4 py-3 text-sm ${C.text} outline-none focus:border-primary`} />
                                    </div>

                                    {/* ✨ NOVO: Feedback visual enquanto calcula o frete */}
                                    {isCheckingAddress && (
                                        <p className="text-[10px] text-blue-500 font-bold animate-pulse mt-1">
                                            <span className="material-symbols-outlined text-[10px] align-middle mr-1">location_searching</span>
                                            Verificando área de entrega...
                                        </p>
                                    )}

                                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest pt-2">Pagamento na Entrega</h3>
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
                                                    : `${C.card} ${C.cardBorder} ${C.subtext} hover:border-primary/40`
                                                    }`}>
                                                <span className="material-symbols-outlined text-xl">{pm.icon}</span>
                                                <span className="text-[10px] font-bold uppercase">{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </form>
                            </div>

                            {/* ✨ NOVO: Resumo de valores com frete dinâmico */}
                            <div className={`px-6 py-5 ${C.card} border-t ${C.cardBorder} shrink-0 space-y-2`}>
                                <div className={`flex justify-between text-xs ${C.subtext}`}>
                                    <span>Subtotal</span>
                                    <span>R$ {subtotal.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between text-xs ${C.subtext}`}>
                                    <span>Taxa de entrega</span>
                                    <span className={isFreteFree || dynamicDeliveryFee === 0 ? 'text-emerald-600 font-bold' : ''}>
                                        {isFreteFree
                                            ? 'Grátis 🎉'
                                            : deliveryZones.length === 0
                                                ? 'A definir'
                                                : dynamicDeliveryFee !== null
                                                    ? `R$ ${dynamicDeliveryFee.toFixed(2)}`
                                                    : (customerStreet.length > 5 ? 'Calculando...' : '—')}
                                    </span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-xs text-emerald-600 font-bold">
                                        <span>Desconto ({appliedCoupon?.label})</span>
                                        <span>- R$ {discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className={`flex justify-between items-center pt-2 border-t ${C.cardBorder}`}>
                                    <span className={`${C.subtext} font-black uppercase text-xs`}>Total</span>
                                    <span className={`text-2xl font-black ${C.text} italic`}>R$ {cartTotal.toFixed(2)}</span>
                                </div>

                                {/* ✨ NOVO: O botão agora verifica o `isAddressValid` para habilitar */}
                                <button form="checkout-form" type="submit"
                                    disabled={isProcessingCheckout || (deliveryZones.length > 0 && !isAddressValid) || isCheckingAddress}
                                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_6px_24px_rgba(230,99,55,0.3)] hover:scale-[1.02] transition-transform mt-1 disabled:opacity-50">
                                    {isCheckingAddress
                                        ? 'Verificando Endereço...'
                                        : (deliveryZones.length > 0 && !isAddressValid && customerStreet.length > 5)
                                            ? 'Endereço Inválido'
                                            : isProcessingCheckout
                                                ? 'Processando...'
                                                : 'Confirmar Pedido'}
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