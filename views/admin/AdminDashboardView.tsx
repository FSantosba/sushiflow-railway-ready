import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader } from '@googlemaps/js-api-loader';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell 
} from 'recharts';

const MAPS_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || '';

const AdminDashboardView: React.FC = () => {
    const [stats, setStats] = useState({ faturamento_hoje: 0, total_pedidos_hoje: 0, pagar_motoboys: 0 });
    const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
    const [peakData, setPeakData] = useState<any[]>([]);
    const [trackingData, setTrackingData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    const fetchData = async () => {
        try {
            const apiBase = 'http://localhost:3001';
            const [s, k, p, t] = await Promise.all([
                axios.get(`${apiBase}/api/admin/stats`),
                axios.get(`${apiBase}/api/admin/kitchen`),
                axios.get(`${apiBase}/api/admin/peak-data`),
                axios.get(`${apiBase}/api/admin/map-tracking`)
            ]);
            if (s.data) setStats(s.data);
            if (Array.isArray(k.data)) setKitchenOrders(k.data);
            if (Array.isArray(p.data)) {
                setPeakData(p.data.map((d: any) => ({ 
                    ...d,
                    hora: d.hora !== undefined ? `${d.hora}:00` : '--:--'
                })));
            }
            if (Array.isArray(t.data)) setTrackingData(t.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    // Loader do Mapa
    useEffect(() => {
        if (!mapRef.current) return;
        const loader = new Loader({ apiKey: MAPS_KEY, version: "weekly" });
        loader.load().then(() => {
            if (!mapRef.current) return;
            const google = (window as any).google;
            googleMapRef.current = new google.maps.Map(mapRef.current, {
                center: { lat: -23.5505, lng: -46.6333 },
                zoom: 13,
                disableDefaultUI: true,
                styles: [
                    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
                    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
                ]
            });
        }).catch(err => console.error("Map Load Error:", err));
    }, []);

    // Markers do Mapa
    useEffect(() => {
        if (!googleMapRef.current) return;
        const google = (window as any).google;
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        trackingData.forEach(pos => {
            const marker = new google.maps.Marker({
                position: { lat: parseFloat(pos.lat), lng: parseFloat(pos.lng) },
                map: googleMapRef.current,
                title: `Pedido ${pos.pedido_id}`
            });
            markersRef.current.push(marker);
        });
    }, [trackingData]);

    const getElapsedTime = (dateStr: string) => {
        if (!dateStr) return 0;
        const start = new Date(dateStr).getTime();
        if (isNaN(start)) return 0;
        const now = new Date().getTime();
        return Math.floor((now - start) / 60000);
    };

    if (isLoading) return <div className="p-20 text-white font-black text-center animate-pulse">CARREGANDO DADOS...</div>;

    return (
        <div className="h-full overflow-y-auto bg-[#0d1117] p-8">
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Operation <span className="text-primary">Control</span> Center <span className="text-xs text-slate-600 font-bold ml-4">v1.4</span>
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                <div className="bg-card-dark p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Faturamento</p>
                    <h3 className="text-3xl font-black text-white italic">R$ {Number(stats?.faturamento_hoje || 0).toFixed(2)}</h3>
                </div>
                <div className="bg-card-dark p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Pedidos</p>
                    <h3 className="text-3xl font-black text-white italic">{stats?.total_pedidos_hoje || 0}</h3>
                </div>
                <div className="bg-card-dark p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Pagar Motoboys</p>
                    <h3 className="text-3xl font-black text-white italic">R$ {Number(stats?.pagar_motoboys || 0).toFixed(2)}</h3>
                </div>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Kitchen Monitor */}
                <div className="bg-card-dark/20 border border-white/5 rounded-[2.5rem] flex flex-col h-[500px] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <h4 className="text-sm font-black uppercase tracking-widest text-white">Monitor de Cozinha</h4>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500">
                            {kitchenOrders.length} EM ESPERA
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {kitchenOrders.map(order => {
                            if (!order || !order.id) return null;
                            const waitTime = getElapsedTime(order.created_at);
                            return (
                                <div key={order.id} className="bg-black/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                                            #{String(order.id).slice(0,4)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white uppercase tracking-widest">Pedido Online</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{order.status}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 font-black text-lg text-emerald-400">
                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                        {waitTime}'
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tracking Map */}
                <div className="bg-card-dark/20 border border-white/5 rounded-[2.5rem] flex flex-col h-[500px] overflow-hidden relative">
                    <div className="absolute top-6 left-8 z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black text-white uppercase tracking-widest">
                        Operação em Tempo Real
                    </div>
                    <div ref={mapRef} className="flex-1 bg-slate-900 flex items-center justify-center">
                        {!MAPS_KEY && <span className="text-slate-700 font-black italic">MAPS_KEY_MISSING</span>}
                    </div>
                </div>
            </div>

            {/* Peak Sales Graph */}
            <div className="bg-card-dark/20 border border-white/5 rounded-[2.5rem] p-8 mt-8">
                <h4 className="text-sm font-black uppercase tracking-widest text-white mb-6">Volume de Vendas (Hoje)</h4>
                <div className="w-full h-64 flex justify-center">
                    <BarChart width={800} height={250} data={peakData.length > 0 ? peakData : [{hora: '--', total_pedidos: 0}]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                        <XAxis dataKey="hora" tick={{fill: '#475569', fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill: '#475569', fontSize: 10}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{backgroundColor: '#12161b', border: 'none', borderRadius: '12px', fontSize: '10px'}} />
                        <Bar dataKey="total_pedidos" fill="#e66337" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboardView;
