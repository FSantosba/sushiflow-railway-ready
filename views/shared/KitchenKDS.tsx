import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOrders } from '../../context/OrdersContext';
import { useTables, CartItem } from '../../context/TableContext';
import { sushiMenu, kitchenMenu, barMenu } from '../../utils/mockData';
import { playNewOrderSound, playReadySound } from '../../utils/sounds';

type Station = 'all' | 'sushi' | 'kitchen' | 'bar';

interface KDSItem {
  id: string;
  orderId?: string; // Original Order ID for Delivery
  tableId?: string; // Table ID for Table Orders
  itemId?: string; // CartItem ID for Table Orders
  qty: string;
  name: string;
  mod?: string;
  station: Station;
  timeLabel: string;
}

interface KDSOrder {
  id: string;
  type: string;
  time: string;
  startTime: number;
  seconds: number;
  status: 'recente' | 'atencao' | 'atrasado';
  items: KDSItem[];
}

const KitchenKDS: React.FC = () => {
  const { orders, updateOrder } = useOrders();
  const { tables, openTables, updateItemStatus } = useTables();
  const [activeStation, setActiveStation] = useState<Station>('all');
  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const prevOrderCount = useRef(0);
  const prevReadyCount = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ✨ Sons: novo pedido chega na cozinha
  useEffect(() => {
    const liveOrders = orders.filter(o => o.status === 'PENDENTE' || o.status === 'EM PREPARO').length;
    if (liveOrders > prevOrderCount.current && prevOrderCount.current > 0) {
      playNewOrderSound();
    }
    prevOrderCount.current = liveOrders;
  }, [orders]);

  // ✨ Sons: item pronto para servir
  useEffect(() => {
    const readyCount = (Object.values(openTables).flat() as import('../context/TableContext').CartItem[]).filter(i => i.status === 'READY').length;
    if (readyCount > prevReadyCount.current) {
      playReadySound();
    }
    prevReadyCount.current = readyCount;
  }, [openTables]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyStatus = (seconds: number) => {
    if (viewMode === 'history') return 'recente'; // History items are not urgent
    if (seconds > 1200) return 'atrasado'; // 20 min
    if (seconds > 600) return 'atencao';  // 10 min
    return 'recente';
  };

  const getItemStation = (itemName: string): Station => {
    // Simple heuristic based on known menus. A real app would have 'station' in MenuItem type.
    if (sushiMenu.some(i => i.name === itemName)) return 'sushi';
    if (kitchenMenu.some(i => i.name === itemName)) return 'kitchen';
    if (barMenu.some(i => i.name === itemName)) return 'bar';
    return 'kitchen'; // Default
  };

  const allOrders: KDSOrder[] = useMemo(() => {
    const kdsOrders: KDSOrder[] = [];

    // 1. Process Delivery Orders
    const deliveryFilter = viewMode === 'live'
      ? (o: any) => o.status === 'PENDENTE' || o.status === 'EM PREPARO'
      : (o: any) => o.status === 'SAIU PARA ENTREGA' || o.status === 'CONCLUÍDO';

    orders.filter(deliveryFilter).forEach(order => {
      const seconds = Math.floor((now - (order.createdAt || now)) / 1000);

      const items: KDSItem[] = order.items.map((itemStr, idx) => {
        // Parse "2x Salmon Nigiri"
        const parts = itemStr.match(/^(\d+)x\s+(.+)$/);
        const qty = parts ? parts[1] + 'x' : '1x';
        const name = parts ? parts[2] : itemStr;

        return {
          id: `${order.id}-${idx}`,
          orderId: order.id,
          qty,
          name,
          station: getItemStation(name),
          timeLabel: formatTime(seconds)
        };
      });

      kdsOrders.push({
        id: `Pedido #${order.id}`,
        type: `DELIVERY (${order.platform.toUpperCase()})`,
        time: order.time,
        startTime: order.createdAt || now,
        seconds: seconds,
        status: getUrgencyStatus(seconds),
        items
      });
    });

    // 2. Process Table Orders
    Object.entries(openTables).forEach(([tableId, rawItems]) => {
      const cartItems = rawItems as CartItem[];
      // Filter out items that are already ready
      const tableItems = viewMode === 'live'
        ? cartItems?.filter(i => i.status !== 'READY' && i.status !== 'SERVED' && i.status !== 'DRAFT')
        : cartItems?.filter(i => i.status === 'READY' || i.status === 'SERVED');

      if (!tableItems || tableItems.length === 0) return;

      const table = tables.find(t => t.id === tableId);
      // Usar o createdAt do item mais antigo da lista como referência do card
      const oldestCreatedAt = tableItems.reduce((oldest, item) => {
        const ts = (item as any).createdAt || now;
        return ts < oldest ? ts : oldest;
      }, now);
      const seconds = Math.floor((now - oldestCreatedAt) / 1000);

      const kdsItems: KDSItem[] = tableItems.map((item) => ({
        id: `${tableId}-${item.id}`,
        tableId: tableId,
        itemId: item.id,
        qty: `${item.qty}x`,
        name: item.name,
        station: getItemStation(item.name),
        timeLabel: formatTime(Math.floor((now - ((item as any).createdAt || now)) / 1000))
      }));

      kdsOrders.push({
        id: `Mesa ${tableId}`,
        type: table?.status === 'RESERVA' ? 'RESERVA' : 'SALÃO',
        time: table?.timeActive || 'Agora',
        startTime: oldestCreatedAt,
        seconds: seconds,
        status: getUrgencyStatus(seconds),
        items: kdsItems
      });
    });

    return kdsOrders;
  }, [orders, openTables, tables, viewMode]);

  const filteredOrders = useMemo(() => {
    if (activeStation === 'all') return allOrders;

    return allOrders.map(order => ({
      ...order,
      items: order.items.filter(item => item.station === activeStation)
    })).filter(order => order.items.length > 0);
  }, [activeStation, allOrders]);

  const toggleItem = (id: string) => {
    if (viewMode === 'history') return; // Read-only in history
    const next = new Set(checkedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedItems(next);
  };

  const getStatusBadgeColor = (status: string) => {
    if (viewMode === 'history') return 'bg-slate-700 text-slate-300';
    switch (status) {
      case 'atrasado': return 'bg-danger text-white ring-4 ring-danger/10';
      case 'atencao': return 'bg-warning text-black ring-4 ring-warning/10';
      case 'recente': return 'bg-success text-white ring-4 ring-success/10';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getTimerColor = (status: string) => {
    if (viewMode === 'history') return 'text-slate-500';
    switch (status) {
      case 'atrasado': return 'text-danger';
      case 'atencao': return 'text-warning';
      case 'recente': return 'text-success';
      default: return 'text-white';
    }
  };

  const handleFinishOrder = (order: KDSOrder) => {
    // 1. Delivery Order
    if (order.type.includes('DELIVERY')) {
      // Find original ID (removed '#' from "Pedido #4922")
      const originalId = order.id.replace('Pedido #', '');
      // Advance status to DELIVERY (or COMPLETED if you prefer)
      // Assuming OrderStatus.DELIVERY is 'SAIU PARA ENTREGA'
      // If we want to remove from KDS, status change is enough if we filter it out (filteredOrders currently filters PENDING/PREPARING)
      updateOrder(originalId, { status: "SAIU PARA ENTREGA" as any });
    }
    // 2. Table Order
    else if (order.items.length > 0 && order.items[0].tableId) {
      // Mark all shown items as READY
      order.items.forEach(item => {
        if (item.tableId && item.itemId) {
          updateItemStatus(item.tableId, item.itemId, 'READY');
        }
      });
    }
  };

  return (
    <div className={`flex flex-col bg-[#0b1216] select-none font-sans overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[200]' : 'h-full'
      }`}>
      {/* Header - Seletor de Estação */}
      <div className="p-3 flex items-center justify-between bg-[#111820] border-b border-white/5 shadow-2xl shrink-0 z-50">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
          {[
            { id: 'all', label: 'Monitor Geral', icon: 'grid_view' },
            { id: 'sushi', label: 'Sushibar', icon: 'restaurant_menu' },
            { id: 'kitchen', label: 'Cozinha Hot', icon: 'skillet' },
            { id: 'bar', label: 'Bar & Bebidas', icon: 'local_bar' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStation(tab.id as Station)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeStation === tab.id
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6 mr-4">
          {/* View Mode Toggle */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('live')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'live' ? 'bg-primary text-[#0b1216] shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              AO VIVO
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              HISTÓRICO
            </button>
          </div>

          <div className="text-right">
            <span className="text-[9px] text-slate-600 font-black uppercase block leading-none tracking-widest">Sincronização</span>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="text-[10px] font-black text-emerald-500/80">REAL-TIME</span>
              <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
            </div>
          </div>

          {/* ✨ Botão Fullscreen */}
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia (Monitor da Cozinha)'}
            className={`size-10 rounded-xl border flex items-center justify-center transition-all ${isFullscreen
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
          >
            <span className="material-symbols-outlined text-xl">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Grid de Pedidos Ampliado */}
      <div className="flex-1 overflow-x-auto p-4 md:p-6 flex gap-4 md:gap-6 custom-scrollbar bg-[#0b1216] snap-x snap-mandatory">
        {filteredOrders.map((order) => (
          <div key={order.id} className={`w-[85vw] sm:w-[320px] md:w-[380px] shrink-0 snap-center flex flex-col bg-[#1a2329] rounded-[2rem] shadow-2xl overflow-hidden border transition-all animate-in fade-in slide-in-from-bottom-4 ${viewMode === 'history' ? 'border-slate-700/30 opacity-75' :
            order.status === 'atrasado' ? 'border-danger/30 animate-pulse-danger' :
              order.status === 'atencao' ? 'border-warning/20' : 'border-white/5'
            }`}>

            {/* Header do Card */}
            <div className="p-6 pb-2 flex flex-col gap-1 relative">
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-lg ${getStatusBadgeColor(order.status)}`}>
                  {order.status.toUpperCase()}
                </span>
                <span className={`text-2xl font-black tabular-nums tracking-tighter ${getTimerColor(order.status)}`}>
                  {formatTime(order.seconds)}
                </span>
              </div>

              <div className="mt-1">
                <h3 className="text-2xl font-black text-white tracking-tighter italic uppercase leading-none">{order.id}</h3>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] mt-1">{order.type}</p>

                {/* Arrival Time Display */}
                <div className="flex items-center gap-1 mt-2 text-slate-500">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Chegada: {order.time}</span>
                </div>
              </div>
            </div>

            {/* Lista de Itens Otimizada */}
            <div className="flex-1 p-6 pt-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              {order.items.map((item) => {
                const isChecked = checkedItems.has(item.id) || viewMode === 'history';
                return (
                  <div key={item.id} className={`flex flex-col gap-2 transition-opacity duration-300 ${isChecked ? 'opacity-30' : 'opacity-100'}`}>
                    <div
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-start gap-4 p-1 -m-1 rounded-xl transition-colors ${viewMode === 'live' ? 'cursor-pointer group hover:bg-white/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <div className={`mt-1 size-8 rounded-lg border-2 transition-all flex items-center justify-center shrink-0 ${isChecked ? 'bg-slate-700 border-slate-600' : 'bg-transparent border-slate-700 group-hover:border-primary group-hover:scale-105'
                        }`}>
                        {isChecked && <span className="material-symbols-outlined text-white text-xl font-black">check</span>}
                      </div>

                      <div className="flex-1 flex justify-between items-start pt-0.5">
                        <div className="flex gap-3">
                          <span className={`text-xl font-black tabular-nums ${isChecked ? 'text-slate-600' : 'text-primary'}`}>
                            {item.qty}
                          </span>
                          <span className={`text-lg font-bold leading-tight uppercase tracking-tight ${isChecked ? 'text-slate-600 line-through' : 'text-slate-100'}`}>
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botão de Finalização - Apenas visível no modo Live */}
            {viewMode === 'live' && (
              <div className="p-6 pt-0">
                <button
                  onClick={() => handleFinishOrder(order)}
                  className="w-full h-14 bg-[#49ccf9] hover:bg-[#3bb8e0] active:bg-[#2da1c8] text-[#0b1216] rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-xl font-black">done_all</span>
                  FINALIZAR
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center opacity-5">
            <span className="material-symbols-outlined text-[120px] font-thin">checklist</span>
            <h2 className="text-3xl font-black uppercase tracking-[0.3em] mt-4">Cozinha Limpa</h2>
          </div>
        )}
      </div>

      {/* Footer Industrial */}
      <footer className="p-3 px-8 bg-[#111820] border-t border-white/5 flex justify-between items-center shrink-0">
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-success"></span>
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-warning"></span>
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Atenção</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-danger animate-pulse"></span>
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Crítico</span>
          </div>
        </div>
        <div className="text-slate-700">
          <p className="text-[9px] font-black uppercase tracking-[0.2em]">SushiFlow Monitor KDS v5.2 • Modo Otimizado</p>
        </div>
      </footer>
    </div>
  );
};

export default KitchenKDS;
