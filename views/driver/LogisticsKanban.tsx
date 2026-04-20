
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '../../types';
import { useOrders } from '../../context/OrdersContext';
import { useServer } from '../../context/ServerContext';

const LogisticsKanban: React.FC = () => {
  const { orders, addOrder, updateOrder, removeOrder } = useOrders();
  const { serverUrl } = useServer();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);

  const [activeMobileTab, setActiveMobileTab] = useState<OrderStatus>(OrderStatus.NEW);

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: string, customer: string, orderId: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIds = useRef<string[]>(orders.map(o => o.id));

  const [searchQuery, setSearchQuery] = useState('');
  const [activePlatform, setActivePlatform] = useState<'Todas' | 'iFood' | '99Food' | 'KeeTa' | 'Direto'>('Todas');

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    const currentPending = orders.filter(o => o.status === OrderStatus.PENDING);
    const newArrivals = currentPending.filter(o => !knownIds.current.includes(o.id));

    if (newArrivals.length > 0) {
      if (!isMuted && audioRef.current) {
        audioRef.current.play().catch(e => console.debug("Áudio aguardando interação.", e));
      }

      const arrivalsIds = newArrivals.map(o => o.id);
      setNewOrderIds(prev => new Set([...prev, ...arrivalsIds]));

      const newToasts = newArrivals.map(o => ({
        id: Math.random().toString(36),
        customer: o.customer || 'Cliente',
        orderId: o.id
      }));
      setToasts(prev => [...prev, ...newToasts]);

      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          arrivalsIds.forEach(id => next.delete(id));
          return next;
        });
      }, 7500);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => !newToasts.find(nt => nt.id === t.id)));
      }, 5000);
    }

    knownIds.current = orders.map(o => o.id);
  }, [orders, isMuted]);

  const simulateNewOrder = () => {
    const newId = Math.floor(5000 + Math.random() * 1000).toString();
    const newOrder: Order = {
      id: newId,
      clienteId: `Custo-${newId}`,
      valorItens: 85.50,
      taxaEntrega: 0,
      totalGeral: 85.50,
      status: OrderStatus.NEW,
      enderecoEntrega: { rua: 'Rua Exemplo', numero: '123' },
      createdAt: new Date().toISOString(),
      customer: `Cliente ${Math.floor(Math.random() * 100)}`,
      platform: ['iFood', '99Food', 'KeeTa', 'Direto'][Math.floor(Math.random() * 4)] as any,
      items: ['1x Combinado Sushi', '2x Temaki Salmão'],
      time: 'agora',
      address: 'Rua Exemplo, 123 - Centro'
    };
    addOrder(newOrder);
  };

  const handleAcceptOrder = async (order: Order) => {
    updateOrder(order.id, { status: OrderStatus.PENDING });
    
    if (autoPrint) {
      console.log(`Imprimindo pedido #${order.id}... via ${serverUrl}`);
      // Simulação visual de impressão
      const toastId = Math.random().toString();
      setToasts(prev => [...prev, { id: toastId, customer: 'Imprimindo...', orderId: order.id }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 3000);

      try {
        await fetch(`${serverUrl}/api/print/production`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, ...order })
        });
      } catch (err) {
        console.error("Falha ao imprimir automaticamente:", err);
      }
    }
  };

  const handleRejectOrder = (order: Order) => {
    if (confirm(`Rejeitar pedido #${order.id} de ${order.customer}?`)) {
      removeOrder(order.id);
    }
  };

  const handleAdvanceStatus = async (order: Order) => {
    let nextStatus = order.status;
    if (order.status === OrderStatus.NEW) nextStatus = OrderStatus.PENDING;
    else if (order.status === OrderStatus.PENDING) nextStatus = OrderStatus.PREPARING;
    else if (order.status === OrderStatus.PREPARING) nextStatus = OrderStatus.DELIVERY;
    else if (order.status === OrderStatus.DELIVERY) nextStatus = OrderStatus.COMPLETED;
    
    if (nextStatus !== order.status) {
      updateOrder(order.id, { status: nextStatus });

      if (order.status === OrderStatus.NEW && autoPrint) {
        console.log(`Imprimindo pedido #${order.id}... via ${serverUrl} (viva modal)`);
        try {
          await fetch(`${serverUrl}/api/print/production`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, ...order })
          });
        } catch (err) {
          console.error("Falha ao imprimir automaticamente no modal:", err);
        }
      }
    }
    setSelectedOrder(null);
  };

  const getNextStatusLabel = (status: OrderStatus) => {
    if (status === OrderStatus.NEW) return 'Aceitar Pedido';
    if (status === OrderStatus.PENDING) return 'Avançar Preparo';
    if (status === OrderStatus.PREPARING) return 'Saiu p/ Entrega';
    if (status === OrderStatus.DELIVERY) return 'Marcar Entregue';
    return 'Finalizado';
  };

  const columns = [
    { status: OrderStatus.NEW, label: 'A Aceitar', icon: 'notifications_active' },
    { status: OrderStatus.PENDING, label: 'Pendente', icon: 'shopping_bag' },
    { status: OrderStatus.PREPARING, label: 'Em Preparo', icon: 'skillet' },
    { status: OrderStatus.DELIVERY, label: 'Em Rota', icon: 'local_shipping' },
    { status: OrderStatus.COMPLETED, label: 'Entregue', icon: 'check_circle' },
  ];

  // Filtro aprimorado: ignorando acentos e case-insensitive
  const filteredOrders = useMemo(() => {
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const query = normalize(searchQuery);

    return orders.filter(order => {
      const matchSearch = normalize(order.customer || '').includes(query) || order.id.includes(query);
      const matchPlatform = activePlatform === 'Todas' || order.platform === activePlatform;
      return matchSearch && matchPlatform;
    });
  }, [orders, searchQuery, activePlatform]);

  const parseItem = (itemStr: string) => {
    const qtyMatch = itemStr.match(/^(\d+)x\s*/);
    const qty = qtyMatch ? qtyMatch[1] : '1';
    let name = itemStr.replace(/^(\d+)x\s*/, '');
    name = name.replace(/\s*\([^)]+\)/, '').trim();
    return { qty, name };
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#0a0e14]">
      {/* Toasts */}
      <div className="absolute top-20 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-full duration-500 pointer-events-auto border border-white/20">
            <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined font-black">notification_important</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Novo Pedido #{toast.orderId}</p>
              <p className="text-sm font-black italic">{toast.customer}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar com Busca Refinada */}
      <div className="p-3 md:p-4 border-b border-white/5 bg-[#11161d] shrink-0 z-20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 xl:gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
              {['Todas', 'iFood', '99Food', 'KeeTa', 'Direto'].map((plt) => (
                <button
                  key={plt}
                  onClick={() => setActivePlatform(plt as any)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activePlatform === plt ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {plt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`size-9 rounded-xl border transition-all flex items-center justify-center ${isMuted ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-lg">{isMuted ? 'volume_off' : 'volume_up'}</span>
            </button>

            <button
              onClick={() => setAutoPrint(!autoPrint)}
              className={`h-9 px-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${autoPrint ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-lg">print</span>
              <span className="text-[10px] font-black uppercase tracking-wider">{autoPrint ? 'Auto ON' : 'Auto OFF'}</span>
            </button>
            <button
              onClick={simulateNewOrder}
              className="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
              Simular Pedido
            </button>
          </div>

          {/* NOVO CAMPO DE BUSCA APRIMORADO */}
          <div className="relative group w-full xl:w-auto">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder="Buscar por cliente ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-[11px] font-bold w-full xl:w-80 focus:ring-2 focus:ring-primary/50 text-white outline-none placeholder:text-slate-600 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex overflow-x-auto no-scrollbar border-b border-white/5 bg-[#0a0e14] shrink-0">
        {columns.map((col) => {
          const count = filteredOrders.filter(o => o.status === col.status).length;
          const isActive = activeMobileTab === col.status;
          return (
            <button
              key={col.status}
              onClick={() => setActiveMobileTab(col.status)}
              className={`flex-1 min-w-[120px] px-3 py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">{col.icon}</span>
                <span>{col.label}</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-primary text-white' : 'bg-white/5'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-y-auto md:overflow-x-auto p-3 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 custom-scrollbar md:snap-x md:snap-mandatory">
        {columns.map((col) => {
          const colOrders = filteredOrders.filter(o => o.status === col.status);
          const isMobileActive = activeMobileTab === col.status;

          return (
            <div 
              key={col.status} 
              className={`w-full md:w-[340px] flex-col gap-4 shrink-0 md:snap-center ${isMobileActive ? 'flex' : 'hidden'} md:flex`}
            >
              <div className="hidden md:flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${col.status === OrderStatus.PENDING ? 'text-rose-500' :
                    col.status === OrderStatus.PREPARING ? 'text-primary' :
                      col.status === OrderStatus.DELIVERY ? 'text-emerald-500' : 'text-slate-500'
                    }`}>
                    {col.label}
                  </span>
                  <span className="bg-white/5 text-slate-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/5">
                    {colOrders.length.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:gap-4 flex-1 md:overflow-y-auto custom-scrollbar md:pr-2 pb-4 md:pb-10">
                {colOrders.map(order => {
                  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : now;
                  const minutesElapsed = Math.floor((now - createdAt) / 60000);
                  const isStale = (order.status === OrderStatus.NEW || order.status === OrderStatus.PENDING) && minutesElapsed >= 15;

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-[#161b22] border rounded-3xl p-5 shadow-2xl hover:border-primary/40 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-3 ${
                        isStale ? 'border-rose-500 animate-pulse-slow' : 'border-white/5'
                      } ${newOrderIds.has(order.id) ? 'animate-card-flash border-primary' : ''
                        }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`size-8 bg-black/40 rounded-xl flex items-center justify-center border border-white/5 transition-colors ${
                              isStale ? 'text-rose-500' : 'text-slate-500 group-hover:text-primary'
                            }`}>
                            <span className="material-symbols-outlined text-lg">
                              {isStale ? 'local_fire_department' : col.icon}
                            </span>
                          </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">#{order.id}</p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase mt-1">{order.platform}</p>
                        </div>
                      </div>
                        <div className="text-right flex flex-col items-end">
                          <span className={`text-[10px] font-black uppercase ${isStale ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                            {isStale ? `${minutesElapsed} min mofando` : order.time}
                          </span>
                        </div>
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-white leading-tight mb-4 group-hover:text-primary transition-colors truncate">
                      {order.customer || 'Cliente'}
                    </h4>

                    <div className="space-y-1 sm:space-y-2 mb-4 sm:mb-6">
                      {order.items && order.items.slice(0, 3).map((itemStr, i) => {
                        const { qty, name } = parseItem(itemStr);
                        return (
                          <div key={i} className="flex items-center gap-3 bg-white/[0.02] p-2 rounded-xl border border-white/5 group-hover:border-primary/10 transition-all">
                            <span className="text-[10px] font-black text-primary bg-primary/10 size-6 flex items-center justify-center rounded-lg">{qty}x</span>
                            <span className="text-[11px] font-bold text-slate-300 truncate uppercase tracking-tight">{name}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-600 text-sm">location_on</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[120px]">
                          {order.address?.split('-')[0] || 'Balcão'}
                        </span>
                      </div>
                      <span className="text-sm font-black text-white italic">R$ {(order.totalGeral || 0).toFixed(2)}</span>
                    </div>

                    {col.status === OrderStatus.NEW && (
                      <div className="mt-4 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRejectOrder(order)}
                          className="py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-[10px] font-black uppercase transition-all"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={() => handleAcceptOrder(order)}
                          className="py-2 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all"
                        >
                          Aceitar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

                {/* EMPTY STATE POR COLUNA */}
                {colOrders.length === 0 && searchQuery && (
                  <div className="py-10 text-center flex flex-col items-center opacity-40">
                    <span className="material-symbols-outlined text-4xl mb-2">person_search</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-tight">Nenhum resultado em<br />{col.label}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Detalhes */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-300" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#12161b] border border-white/10 rounded-3xl md:rounded-[2.5rem] w-full max-w-4xl p-5 md:p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 md:mb-8 sticky top-0 bg-[#12161b] pt-2 pb-4 z-10 border-b border-white/5">
              <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Pedido #{selectedOrder.id}</h2>
              <button onClick={() => setSelectedOrder(null)} className="size-8 md:size-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-lg md:text-xl font-bold text-white mb-4">{selectedOrder.customer || 'Cliente'}</p>
            <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="p-3 md:p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center">
                  {item}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 sticky bottom-0 bg-[#12161b] pt-4 pb-2 z-10 border-t border-white/5">
              {selectedOrder.status !== OrderStatus.COMPLETED && (
                <button 
                  onClick={() => handleAdvanceStatus(selectedOrder)}
                  className="w-full sm:flex-1 py-3 md:py-4 bg-primary hover:bg-primary/90 transition-colors text-white font-black text-xs md:text-sm uppercase rounded-xl md:rounded-2xl shadow-xl shadow-primary/20">
                  {getNextStatusLabel(selectedOrder.status)}
                </button>
              )}
              <button 
                onClick={async () => {
                  setToasts(prev => [...prev, { id: Math.random().toString(), customer: 'Imprimindo...', orderId: selectedOrder.id }]);
                  try {
                    await fetch(`${serverUrl}/api/print/production`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: selectedOrder.id, ...selectedOrder })
                    });
                  } catch (err) {
                    console.error("Falha ao imprimir manualmente:", err);
                  }
                  setTimeout(() => setSelectedOrder(null), 1000);
                }}
                className="w-full sm:flex-1 py-3 md:py-4 bg-white/5 hover:bg-white/10 transition-colors text-white font-black text-xs md:text-sm uppercase rounded-xl md:rounded-2xl border border-white/10">
                Imprimir Comanda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsKanban;
