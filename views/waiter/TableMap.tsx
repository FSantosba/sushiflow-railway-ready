import React, { useState, useRef, useEffect } from 'react';
import { useTables } from '../../context/TableContext';
import { TableStatus } from '../../types';

type AreaTab = 'main' | 'vip' | 'external';

interface TablePosition {
  id: string;
  x: number;
  y: number;
}

const DEFAULT_POSITIONS: TablePosition[] = [
  { id: '01', x: 80, y: 120 },
  { id: '02', x: 240, y: 120 },
  { id: '03', x: 400, y: 120 },
  { id: '04', x: 80, y: 280 },
  { id: '05', x: 240, y: 280 },
  { id: '06', x: 400, y: 280 },
  { id: '07', x: 560, y: 120 },
  { id: '08', x: 560, y: 280 },
  { id: 'VIP 1', x: 320, y: 440 },
];

const STATUS_META: Record<TableStatus, { icon: string; label: string }> = {
  [TableStatus.OCCUPIED]: { icon: 'groups', label: 'OCUPADA' },
  [TableStatus.FREE]: { icon: 'check_circle', label: 'LIVRE' },
  [TableStatus.RESERVED]: { icon: 'event', label: 'RESERVADA' },
  [TableStatus.CLEANING]: { icon: 'cleaning_services', label: 'LIMPANDO' },
};

const AREA_PREFIX: Record<AreaTab, string> = {
  main: '',
  vip: 'VIP ',
  external: 'EXT ',
};

const TableMap: React.FC = () => {
  const { tables, openTables, selectActiveTable, addTable, removeTable } = useTables();
  const [activeArea, setActiveArea] = useState<AreaTab>('main');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCapacity, setNewCapacity] = useState(4);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Controle de Visualização (Mapa vs Grade no Mobile)
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>(window.innerWidth < 1024 ? 'grid' : 'map');

  // Cronômetro vivo - Atualiza a cada segundo
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileView(mobile);
      if (mobile && viewMode === 'map') setViewMode('grid');
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', handleResize);
    };
  }, [viewMode]);

  const handleRemoveTable = (id: string) => {
    removeTable(id);
    setConfirmRemove(null);
    setSelectedTableId(null);
  };

  const formatElapsed = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) return `${hrs}h${mins.toString().padStart(2, '0')}m`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTableTimer = (tableId: string) => {
    const items = openTables[tableId] || [];
    if (items.length === 0) return null;
    const oldest = items.reduce((min, i) => {
      const ts = (i as any).createdAt || Date.now();
      return ts < min ? ts : min;
    }, Date.now());
    return formatElapsed(now - oldest);
  };

  const [positions, setPositions] = useState<TablePosition[]>(() => {
    const saved = localStorage.getItem('@sushiflow:tablePositions');
    return saved ? JSON.parse(saved) : DEFAULT_POSITIONS;
  });

  // Posicionamento automático para novas mesas
  useEffect(() => {
    const missing = tables.filter(t => !positions.find(p => p.id === t.id));
    if (missing.length === 0) return;
    const newPositions = missing.map((t, i) => ({
      id: t.id,
      x: 80 + (i * 180) % 600,
      y: 150 + Math.floor((i * 180) / 600) * 160,
    }));
    setPositions(prev => {
      const updated = [...prev, ...newPositions];
      localStorage.setItem('@sushiflow:tablePositions', JSON.stringify(updated));
      return updated;
    });
  }, [tables.length]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const areaTables = tables.filter(t => {
    if (activeArea === 'main') return !t.id.startsWith('VIP ') && !t.id.startsWith('EXT ');
    if (activeArea === 'vip') return t.id.startsWith('VIP ');
    return t.id.startsWith('EXT ');
  });

  const ocupadas = areaTables.filter(t => t.status === TableStatus.OCCUPIED).length;
  const livres = areaTables.filter(t => t.status === TableStatus.FREE).length;
  const ocupacaoRate = areaTables.length > 0 ? Math.round((ocupadas / areaTables.length) * 100) : 0;

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const selectedCart = selectedTableId ? openTables[selectedTableId] || [] : [];
  const selectedTotal = selectedCart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const selectedTimer = selectedTableId ? getTableTimer(selectedTableId) : null;

  const getPos = (id: string) => positions.find(p => p.id === id) || { id, x: 50, y: 50 };

  const handleDragStart = (clientX: number, clientY: number, tableId: string) => {
    const pos = getPos(tableId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(tableId);
    setDragOffset({
      x: clientX - rect.left - pos.x,
      y: clientY - rect.top - pos.y
    });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(rect.width - 110, clientX - rect.left - dragOffset.x));
    const newY = Math.max(10, Math.min(rect.height - 120, clientY - rect.top - dragOffset.y));
    const updated = positions.map(p => p.id === draggingId ? { ...p, x: newX, y: newY } : p);
    setPositions(updated);
  };

  const handleDragEnd = () => {
    if (draggingId) {
      localStorage.setItem('@sushiflow:tablePositions', JSON.stringify(positions));
      setDraggingId(null);
    }
  };

  const getTableColors = (status: TableStatus) => {
    switch (status) {
      case TableStatus.OCCUPIED: return { border: 'border-rose-500', bg: 'bg-rose-500/10', dot: 'bg-rose-500', glow: 'shadow-rose-500/20', text: 'text-rose-400', ring: 'ring-rose-500/30' };
      case TableStatus.RESERVED: return { border: 'border-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400', glow: 'shadow-amber-400/20', text: 'text-amber-400', ring: 'ring-amber-400/30' };
      case TableStatus.CLEANING: return { border: 'border-blue-400', bg: 'bg-blue-400/10', dot: 'bg-blue-400', glow: 'shadow-blue-400/20', text: 'text-blue-400', ring: 'ring-blue-400/30' };
      default: return { border: 'border-emerald-500', bg: 'bg-emerald-500/5', dot: 'bg-emerald-500', glow: '', text: 'text-emerald-400', ring: 'ring-emerald-500/20' };
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'READY': return { label: '✓ Pronto', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'PENDING': return { label: '🍳 Cozinha', cls: 'bg-amber-400/20 text-amber-400 border-amber-400/30' };
      case 'DRAFT': return { label: '📝 Rascunho', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
      default: return { label: '✓ Servido', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30' };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#080c10] overflow-hidden">

      {/* TOOLBAR SUPERIOR (RESPONSIVA) */}
      <header className="px-4 md:px-6 py-3 border-b border-white/5 flex flex-col md:flex-row items-center justify-between shrink-0 bg-[#0d1118] gap-4">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          {([
            { id: 'main', label: 'Salão' },
            { id: 'vip', label: 'VIP' },
            { id: 'external', label: 'Externo' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveArea(tab.id)}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeArea === tab.id ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col gap-1 min-w-[100px]">
              <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-500">
                <span>Ocupação</span>
                <span className={ocupacaoRate > 80 ? 'text-rose-500' : 'text-emerald-500'}>{ocupacaoRate}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${ocupacaoRate > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${ocupacaoRate}%` }} /></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase">{ocupadas}</span>
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase">{livres}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex">
              <button onClick={() => setViewMode('map')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-white'}`}>Mapa</button>
              <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-white'}`}>Grade</button>
            </div>
            
            <button onClick={() => setShowAddModal(true)} className="size-10 md:w-auto md:px-4 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-xl md:text-sm">add_circle</span>
              <span className="hidden md:block text-[10px] font-black uppercase tracking-widest">Nova Mesa</span>
            </button>
            
            {viewMode === 'map' && (
              <button onClick={() => { setPositions(DEFAULT_POSITIONS); localStorage.removeItem('@sushiflow:tablePositions'); }} className="size-10 bg-white/5 text-slate-500 rounded-xl flex items-center justify-center hover:text-white transition-all">
                <span className="material-symbols-outlined text-xl">restart_alt</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* CONTEÚDO PRINCIPAL: MAPA OU GRADE */}
        {viewMode === 'map' ? (
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-hidden bg-[radial-gradient(circle,_#1e3540_1px,_transparent_1px)] [background-size:32px_32px]"
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
            onMouseUp={handleDragEnd}
            onTouchEnd={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            {/* Elementos Fixos do Mapa */}
            <div className="absolute top-0 left-0 right-0 h-16 border-b-2 border-dashed border-amber-400/10 bg-amber-400/[0.02] flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-amber-400/30 uppercase tracking-[0.5em]">Balcão de Sushi / Preparo</span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 border-t-2 border-dashed border-emerald-500/20 bg-emerald-500/[0.02] flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-emerald-500/30 uppercase tracking-[0.5em]">Entrada</span>
            </div>

            {areaTables.map(table => {
              const pos = getPos(table.id);
              const colors = getTableColors(table.status);
              const cart = openTables[table.id] || [];
              const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
              const timer = getTableTimer(table.id);
              const isSelected = selectedTableId === table.id;
              const hasReady = cart.some(i => i.status === 'READY');

              return (
                <div
                  key={table.id}
                  onMouseDown={(e) => handleDragStart(e.clientX, e.clientY, table.id)}
                  onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY, table.id)}
                  onClick={(e) => {
                    if (draggingId !== table.id) {
                      e.stopPropagation();
                      setSelectedTableId(isSelected ? null : table.id);
                    }
                  }}
                  className={`absolute group cursor-pointer transition-transform ${isSelected ? 'scale-110 z-20' : 'hover:scale-105 z-10'}`}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    touchAction: 'none'
                  }}
                >
                  <div className={`relative w-24 h-24 rounded-3xl border-2 flex flex-col items-center justify-center gap-1 transition-all shadow-2xl ${colors.border} ${colors.bg}`}>
                    {hasReady && (
                      <div className="absolute -inset-1 rounded-[2rem] animate-ping opacity-20 ring-4 ring-emerald-400 pointer-events-none" />
                    )}
                    {hasReady && (
                      <div className="absolute -top-3 -right-3 size-8 bg-emerald-500 rounded-full border-4 border-[#080c10] flex items-center justify-center animate-bounce shadow-xl">
                        <span className="material-symbols-outlined text-white text-[14px] font-black">notifications_active</span>
                      </div>
                    )}
                    
                    <span className={`material-symbols-outlined text-3xl ${colors.text}`}>{STATUS_META[table.status].icon}</span>
                    <span className="text-xl font-black text-white leading-none">{table.id}</span>
                  </div>

                  {(total > 0 || timer) && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#12161b]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 whitespace-nowrap shadow-xl flex flex-col items-center gap-0.5">
                      {total > 0 && <span className="text-xs font-black text-white">R$ {total.toFixed(0)}</span>}
                      {timer && (
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${timer.includes('h') ? 'text-rose-400' : 'text-slate-400'}`}>
                          <span className="material-symbols-outlined text-[10px]">schedule</span>
                          {timer}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080c10] custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {areaTables.map(table => {
                const colors = getTableColors(table.status);
                const cart = openTables[table.id] || [];
                const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
                const timer = getTableTimer(table.id);
                const isSelected = selectedTableId === table.id;
                const hasReady = cart.some(i => i.status === 'READY');

                return (
                  <div
                    key={table.id}
                    onClick={() => setSelectedTableId(table.id === selectedTableId ? null : table.id)}
                    className={`relative p-5 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${colors.border} ${colors.bg} shadow-lg ${isSelected ? 'ring-4 ring-indigo-500/50 scale-[1.02]' : 'hover:scale-[1.02] hover:brightness-125'}`}
                  >
                    {hasReady && (
                      <div className="absolute -inset-1 rounded-[2rem] animate-ping opacity-20 ring-4 ring-emerald-400 pointer-events-none" />
                    )}
                    {hasReady && (
                      <div className="absolute -top-3 -right-3 size-8 bg-emerald-500 rounded-full border-4 border-[#080c10] flex items-center justify-center animate-bounce shadow-xl">
                        <span className="material-symbols-outlined text-white text-[14px] font-black">notifications_active</span>
                      </div>
                    )}
                    <span className={`material-symbols-outlined text-3xl ${colors.text}`}>{STATUS_META[table.status].icon}</span>
                    <div className="text-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Mesa</span>
                      <span className="text-3xl font-black text-white leading-none tracking-tighter">{table.id}</span>
                    </div>
                    {(total > 0 || timer) && (
                      <div className="flex flex-col items-center mt-3 pt-3 border-t border-white/10 gap-1 w-full">
                        {total > 0 && <span className="text-sm font-black text-indigo-400 font-mono">R$ {total.toFixed(0)}</span>}
                        {timer && (
                          <div className={`flex items-center gap-1 text-[10px] font-bold font-mono ${timer.includes('h') ? 'text-rose-400' : 'text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {timer}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {areaTables.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
                <span className="material-symbols-outlined text-7xl mb-4 text-slate-500">deck</span>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Nenhuma mesa nesta área</p>
              </div>
            )}
          </div>
        )}

        {/* PAINEL DE DETALHES (HÍBRIDO: SIDEBAR OU GAVETA MOBILE) */}
        {selectedTable && (
        <div className="fixed inset-0 z-40 flex items-end md:items-stretch justify-end pointer-events-none">
          {/* Overlay fundo mobile */}
          <div 
            className="absolute inset-0 bg-black/60 md:bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity animate-in fade-in"
            onClick={() => setSelectedTableId(null)}
          />
          
          {/* Sidebar / Bottom Sheet */}
          <div className="w-full md:w-[450px] bg-[#12161b] md:border-l border-white/5 h-[85dvh] md:h-full flex flex-col pointer-events-auto rounded-t-3xl md:rounded-none overflow-hidden relative shadow-2xl shadow-black animate-in slide-in-from-bottom md:slide-in-from-right z-10">
            {/* Grabber para mobile */}
            <div className="w-full flex justify-center py-3 md:hidden">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            {/* Cabeçalho da Mesa */}
            <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Mesa {selectedTable.id}</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${getTableColors(selectedTable.status).text}`}>
                    {STATUS_META[selectedTable.status].label} • {selectedTable.capacity} Lugares
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmRemove(selectedTable.id)} className="size-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center active:bg-rose-500 active:text-white transition-all"><span className="material-symbols-outlined">delete</span></button>
                  <button onClick={() => setSelectedTableId(null)} className="size-10 bg-white/5 text-slate-500 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
                </div>
              </div>
              {selectedTimer && (
                <div className="mt-4 flex items-center gap-2 text-xs font-black text-slate-400 bg-black/40 p-2 rounded-lg border border-white/5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">timer</span>
                  Tempo de permanência: <span className="text-white font-mono">{selectedTimer}</span>
                </div>
              )}
            </div>

            {/* Lista de Itens no Carrinho da Mesa */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {selectedCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                  <span className="material-symbols-outlined text-6xl">receipt_long</span>
                  <p className="text-[10px] font-black uppercase mt-2">Sem pedidos ativos</p>
                </div>
              ) : selectedCart.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-white block truncate">{item.qty}x {item.name}</span>
                      {item.notes && <p className="text-[10px] text-amber-400/70 italic mt-1">" {item.notes} "</p>}
                    </div>
                    <span className="text-sm font-black text-indigo-400 ml-4 font-mono">R${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-start">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getItemStatusBadge(item.status).cls}`}>
                      {getItemStatusBadge(item.status).label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé e Ação Principal */}
            <div className="p-6 md:p-8 border-t border-white/5 flex flex-col shrink-0 pb-8 md:pb-8 bg-[#12161b]">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Consumo</p>
                  <p className="text-3xl font-black text-white italic font-mono">R$ {selectedTotal.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serviço (10%)</p>
                  <p className="text-sm font-bold text-slate-400 font-mono">R$ {(selectedTotal * 0.1).toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => selectActiveTable(selectedTable.id)}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined">point_of_sale</span>
                Lançar / Finalizar Pedido
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* MODAL ADICIONAR MESA (COMPLETO) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0d1218] border border-white/10 rounded-[3rem] p-8 w-full max-w-xs shadow-2xl text-center animate-in zoom-in-95">
            <div className="size-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">add_business</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase italic mb-2">Nova Mesa</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8">Defina a capacidade de lugares</p>

            <div className="flex items-center gap-4 mb-10">
              <button onClick={() => setNewCapacity(c => Math.max(1, c - 1))} className="size-14 rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-black active:bg-indigo-600 transition-colors">-</button>
              <span className="flex-1 text-5xl font-black text-white font-mono">{newCapacity}</span>
              <button onClick={() => setNewCapacity(c => c + 1)} className="size-14 rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-black active:bg-indigo-600 transition-colors">+</button>
            </div>

            <button onClick={() => { addTable(newCapacity, activeArea); setShowAddModal(false); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Criar Mesa Agora</button>
            <button onClick={() => setShowAddModal(false)} className="mt-4 text-slate-600 text-[10px] font-black uppercase tracking-widest">Desistir</button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR REMOÇÃO */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1218] border border-rose-500/30 rounded-[2.5rem] p-8 w-full max-w-xs text-center shadow-2xl animate-in fade-in">
            <span className="material-symbols-outlined text-rose-500 text-5xl mb-4">warning</span>
            <h3 className="text-xl font-black text-white uppercase italic mb-2">Remover Mesa?</h3>
            <p className="text-xs text-slate-500 mb-8">Todos os dados da Mesa {confirmRemove} serão apagados permanentemente.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleRemoveTable(confirmRemove)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs">Sim, Remover</button>
              <button onClick={() => setConfirmRemove(null)} className="w-full py-4 text-slate-500 font-black uppercase text-xs">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableMap;