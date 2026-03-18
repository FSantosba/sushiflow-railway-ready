import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader } from '@googlemaps/js-api-loader';
import { useOrders } from '../../context/OrdersContext';
import { OrderStatus, Order } from '../../types';

const MAPS_KEY = (import.meta as any).env.VITE_GOOGLE_MAP_KEY || '';

const CustomerTrackingView: React.FC = () => {
    const { orders } = useOrders();
    const [trackingCode, setTrackingCode] = useState('');
    const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

    // -- Tracking States --
    const [motoboyPos, setMotoboyPos] = useState<{ lat: number; lng: number } | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Auto-login se usou o app (apenas para o protótipo local)
    // Vamos pegar o último pedido feito via 'Direto'
    useEffect(() => {
        const lastDirectOrder = [...orders].reverse().find(o => o.platform === 'Direto');
        if (lastDirectOrder && !trackedOrder) {
            setTrackingCode(lastDirectOrder.id);
            setTrackedOrder(lastDirectOrder);
        }
    }, [orders]);

    // 1. Polling da posição do motoboy (a cada 15s)
    useEffect(() => {
        if (!trackedOrder || trackedOrder.status !== OrderStatus.EM_ROTA) return;

        const fetchPosition = async () => {
            try {
                const { data } = await axios.get(`http://localhost:3001/api/rastreamento/${trackedOrder.id}`);
                const newPos = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
                
                if (!lastPosRef.current) {
                    setMotoboyPos(newPos);
                    lastPosRef.current = newPos;
                } else {
                    animateMarker(lastPosRef.current, newPos);
                    lastPosRef.current = newPos;
                }
            } catch (err) {
                console.error('[Tracker] Erro ao buscar posição:', err);
            }
        };

        fetchPosition();
        const interval = setInterval(fetchPosition, 15000);
        return () => clearInterval(interval);
    }, [trackedOrder]);

    // 2. Inicialização do Google Maps
    useEffect(() => {
        if (!trackedOrder || trackedOrder.status !== OrderStatus.EM_ROTA || !mapRef.current) return;

        const loader = new Loader({
            apiKey: MAPS_KEY,
            version: "weekly",
        });

        (loader as any).load().then(() => {
            if (!mapRef.current) return;
            
            const google = (window as any).google;
            const map = new google.maps.Map(mapRef.current, {
                center: motoboyPos || { lat: -23.5505, lng: -46.6333 }, // SP default
                zoom: 17,
                styles: mapDarkStyle, // Estilo Premium Dark
                disableDefaultUI: true,
            });

            const marker = new google.maps.Marker({
                position: motoboyPos || { lat: -23.5505, lng: -46.6333 },
                map: map,
                icon: {
                    url: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png', // Moto Icon
                    scaledSize: new google.maps.Size(40, 40),
                },
                title: 'Seu Sushi está aqui!',
            });

            googleMapRef.current = map;
            markerRef.current = marker;
        });

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [trackedOrder?.status]);

    // 3. Smooth Marker Transition (Linear Interpolation)
    const animateMarker = (oldPos: { lat: number; lng: number }, newPos: { lat: number; lng: number }) => {
        if (!markerRef.current) return;

        const duration = 15000; // Dura o tempo do poll
        const start = performance.now();

        const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);

            const lat = oldPos.lat + (newPos.lat - oldPos.lat) * progress;
            const lng = oldPos.lng + (newPos.lng - oldPos.lng) * progress;

            const currentPos = { lat, lng };
            markerRef.current?.setPosition(currentPos);
            
            // Centraliza o mapa sutilmente se a moto estiver saindo
            if (googleMapRef.current) {
                googleMapRef.current.panTo(currentPos);
            }

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(step);
            }
        };

        animationFrameRef.current = requestAnimationFrame(step);
    };

    const mapDarkStyle = [
        { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
        { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
    ];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const found = orders.find(o => o.id === trackingCode);
        if (found) setTrackedOrder(found);
        else alert('Pedido não encontrado!');
    };

    if (!trackedOrder) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-[#0d1117]">
                <form onSubmit={handleSearch} className="bg-card-dark p-8 rounded-3xl border border-white/5 w-full max-w-sm text-center">
                    <span className="material-symbols-outlined text-4xl text-primary mb-4">local_shipping</span>
                    <h2 className="text-white font-black italic text-xl mb-6">Rastrear Pedido</h2>
                    <input
                        type="text"
                        placeholder="Código do Pedido"
                        value={trackingCode}
                        onChange={e => setTrackingCode(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono focus:border-primary outline-none mb-4"
                    />
                    <button type="submit" className="w-full bg-primary text-white font-black uppercase py-4 rounded-xl shadow-[0_10px_30px_rgba(230,99,55,0.3)]">
                        Acompanhar
                    </button>
                </form>
            </div>
        );
    }

    // Calcula o progresso / etapa ativa
    const getStep = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.PENDENTE:
            case OrderStatus.PAGO: return 1;
            case OrderStatus.EM_PREPARO: return 2;
            case OrderStatus.EM_ROTA: return 3;
            case OrderStatus.ENTREGUE: return 4;
            default: return 1;
        }
    };
    const currentStep = getStep(trackedOrder.status);

    return (
        <div className="h-full w-full flex justify-center bg-[#000000] overflow-hidden font-sans">
            <div className="w-full max-w-[480px] h-full bg-[#0d1117] flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.5)] border-x border-white/5 mx-auto">
                <header className="px-6 py-6 border-b border-white/5 bg-[#12161b] shrink-0 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black italic tracking-tighter text-white">SushiFlow<span className="text-primary text-lg">.</span>Tracker</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Pedido #{trackedOrder.id}</p>
                    </div>
                    <button onClick={() => setTrackedOrder(null)} className="text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto custom-scrollbar relative">
                    {/* Fundo imitando Mapa (Estilo Premium) */}
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-10 mix-blend-luminosity"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent"></div>

                    <div className="relative z-10 px-6 py-8 flex flex-col h-full justify-between">

                        {/* Status Principal */}
                        <div className="text-center mb-10 mt-10">
                            {currentStep === 4 ? (
                                <div className="size-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="material-symbols-outlined text-emerald-400 text-5xl">check_circle</span>
                                </div>
                            ) : currentStep === 3 ? (
                                <div className="size-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative animate-bounce">
                                    <span className="material-symbols-outlined text-orange-500 text-4xl mt-1">two_wheeler</span>
                                </div>
                            ) : (
                                <div className="size-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 group relative">
                                    <div className="absolute inset-0 border-4 border-t-primary border-primary/20 rounded-full animate-spin"></div>
                                    <span className="material-symbols-outlined text-primary text-4xl">{currentStep === 2 ? 'skillet' : 'receipt_long'}</span>
                                </div>
                            )}

                            <h2 className="text-3xl font-black text-white italic mb-2 drop-shadow-lg">
                                {trackedOrder.status}
                            </h2>
                            <p className="text-sm font-bold text-slate-400">
                                {currentStep === 1 ? 'Analisando seu pedido...' :
                                    currentStep === 2 ? 'Chef está montando seu Sushi.' :
                                        currentStep === 3 ? 'Motoboy a caminho da sua casa.' :
                                            'Pedido entregue com sucesso!'}
                            </p>
                        </div>

                        {/* Mapa em Tempo Real (Apenas se em rota) */}
                        {currentStep === 3 && (
                            <div className="flex-1 min-h-[300px] mb-8 relative rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
                                <div ref={mapRef} className="absolute inset-0 w-full h-full bg-slate-900" />
                                <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                                     <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Localização em Tempo Real</span>
                                </div>
                            </div>
                        )}

                        {/* Motoboy Card (Se estiver na rua) */}
                        {currentStep >= 3 && trackedOrder.deliveryMan && (
                            <div className="bg-card-dark/80 backdrop-blur-md border border-orange-500/30 rounded-3xl p-5 mb-8 flex items-center gap-4 animate-in slide-in-from-bottom-5">
                                <div className="size-14 bg-orange-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-orange-400 text-2xl">sports_motorsports</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">Seu Entregador</p>
                                    <h3 className="text-white font-bold text-lg leading-tight">{trackedOrder.deliveryMan}</h3>
                                </div>
                                <div className="size-10 bg-white/5 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-sm">call</span>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="bg-[#12161b]/90 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>

                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 px-2">Histórico do Pedido</h3>

                            <div className="relative pl-6 space-y-8">
                                {/* Linha conectora */}
                                <div className="absolute left-[31px] top-2 bottom-2 w-0.5 bg-white/5">
                                    <div className={`w-full bg-primary transition-all duration-1000 ${currentStep === 1 ? 'h-0' :
                                            currentStep === 2 ? 'h-1/3' :
                                                currentStep === 3 ? 'h-2/3' : 'h-full bg-emerald-500'
                                        }`}></div>
                                </div>

                                {[
                                    { step: 1, label: 'Pedido Confirmado', time: trackedOrder.time },
                                    { step: 2, label: 'Em Preparo na Cozinha', time: currentStep >= 2 ? 'Atual' : '--:--' },
                                    { step: 3, label: 'Saiu para Entrega', time: currentStep >= 3 ? 'Atual' : '--:--' },
                                    { step: 4, label: 'Entregue', time: currentStep === 4 ? 'Atual' : '--:--' }
                                ].map((s, i) => {
                                    const isDone = currentStep > s.step;
                                    const isCurrent = currentStep === s.step;
                                    const colorCls = isCurrent ? (currentStep === 4 ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(230,99,55,0.5)]')
                                        : isDone ? 'bg-white/10 border-white/20 text-white'
                                            : 'bg-[#12161b] border-white/10 text-slate-600';

                                    return (
                                        <div key={s.step} className="flex relative items-center gap-5">
                                            {/* Bolinha */}
                                            <div className={`absolute -left-6 size-4 rounded-full border-2 ${colorCls} flex items-center justify-center z-10 transition-colors duration-500`}>
                                                {isDone && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                                            </div>

                                            <div className={`flex-1 transition-opacity duration-500 ${isCurrent ? 'opacity-100' : 'opacity-50'}`}>
                                                <h4 className={`text-sm font-black ${isCurrent || isDone ? 'text-white' : 'text-slate-500'}`}>{s.label}</h4>
                                                <p className="text-[10px] font-mono text-slate-500 mt-1">{s.time}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
};

export default CustomerTrackingView;
