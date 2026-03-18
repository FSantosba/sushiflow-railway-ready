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

// Ícone e label por status
const STATUS_META: Record<TableStatus, { icon: string; label: string }> = {
  [TableStatus.OCCUPIED]: { icon: 'groups', label: 'OCUPADA' },
  [TableStatus.FREE]: { icon: 'check_circle', label: 'LIVRE' },
  [TableStatus.RESERVED]: { icon: 'event', label: 'RESERVADA' },
  [TableStatus.CLEANING]: { icon: 'cleaning_services', label: 'LIMPANDO' },
};

// Sufixo de área para IDs
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

  // Cronômetro vivo
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  // Quando uma nova mesa é criada, adiciona posição inicial dentro da área visível
  useEffect(() => {
    const missing = tables.filter(t => !positions.find(p => p.id === t.id));
    if (missing.length === 0) return;
    const newPositions = missing.map((t, i) => ({
      id: t.id,
      x: 80 + (i * 180) % 560,
      y: 150 + Math.floor((i * 180) / 560) * 160,
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

  // Filtra mesas pela aba ativa
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

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    const pos = getPos(tableId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(tableId);
    setDragOffset({
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(rect.width - 110, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(10, Math.min(rect.height - 120, e.clientY - rect.top - dragOffset.y));
    const updated = positions.map(p => p.id === draggingId ? { ...p, x: newX, y: newY } : p);
    setPositions(updated);
  };

  const handleMouseUp = () => {
    if (draggingId) {
      localStorage.setItem('@sushiflow:tablePositions', JSON.stringify(positions));
      setDraggingId(null);
    }
  };

  const handleTableClick = (tableId: string) => {
    if (draggingId) return;
    setSelectedTableId(tableId === selectedTableId ? null : tableId);
  };

  const getTableColors = (status: TableStatus) => {
    switch (status) {
      case TableStatus.OCCUPIED: return { border: 'border-rose-500', bg: 'bg-rose-500/10', dot: 'bg-rose-500', glow: 'shadow-rose-500/20', text: 'text-rose-400', ring: 'ring-rose-500/30' };
      case TableStatus.RESERVED: return { border: 'border-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400', glow: 'shadow-amber-400/20', text: 'text-amber-400', ring: 'ring-amber-400/30' };
      case TableStatus.CLEANING: return { border: 'border-blue-400', bg: 'bg-blue-400/10', dot: 'bg-blue-400', glow: 'shadow-blue-400/20', text: 'text-blue-400', ring: 'ring-blue-400/30' };
      default: return { border: 'border-emerald-500', bg: 'bg-emerald-500/5', dot: 'bg-emerald-500', glow: '', text: 'text-emerald-400', ring: 'ring-emerald-500/20' };
    }
  };

  const resetPositions = () => {
    setPositions(DEFAULT_POSITIONS);
    localStorage.removeItem('@sushiflow:tablePositions');
  };

  const handleAddTable = () => {
    addTable(newCapacity, activeArea);
    setShowAddModal(false);
    setNewCapacity(4);
  };

  const handleRemoveTable = (tableId: string) => {
    removeTable(tableId);
    if (selectedTableId === tableId) setSelectedTableId(null);
    setConfirmRemove(null);
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'READY': return { label: '✓ Pronto', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'PENDING': return { label: '🍳 Na cozinha', cls: 'bg-amber-400/20 text-amber-400 border-amber-400/30' };
      case 'DRAFT': return { label: '📝 Rascunho', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
      default: return { label: '✓ Servido', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30' };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#080c10] overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0d1118]">
        {/* Tabs de Area */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 gap-1">
          {([
            { id: 'main', label: 'Salão Principal' },
            { id: 'vip', label: 'VIP / Tatame' },
            { id: 'external', label: 'Externo' },
          ] as { id: AreaTab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveArea(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeArea === tab.id ? 'bg-white text-black' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Métricas, Adicionar e Reset */}
        <div className="flex items-center gap-4">
          {/* Progress bar de ocupação */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">{ocupadas} Ocupadas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">{livres} Livres</span>
            </div>
            <div className="flex flex-col gap-1 min-w-[80px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-600 uppercase">Ocupação</span>
                <span className={`text-[11px] font-black ${ocupacaoRate > 80 ? 'text-rose-500' : ocupacaoRate > 50 ? 'text-amber-400' : 'text-emerald-500'}`}>
                  {ocupacaoRate}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-20">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${ocupacaoRate > 80 ? 'bg-rose-500' : ocupacaoRate > 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${ocupacaoRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Botão Adicionar Mesa */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg text-[10px] font-black text-primary hover:bg-primary/20 uppercase tracking-widest transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Nova Mesa
          </button>

          <button onClick={resetPositions} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all">
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            Resetar
          </button>
          <span className="text-[10px] text-slate-600 font-bold italic hidden xl:block">Arraste as mesas para reorganizar</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Principal — drag & drop */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[radial-gradient(circle,_#1e3540_1px,_transparent_1px)] [background-size:28px_28px]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Balcão Sushi */}
          <div className="absolute top-0 left-0 right-0 h-14 border-b-2 border-dashed border-amber-400/20 bg-amber-400/5 flex items-center justify-center">
            <span className="text-[10px] font-black text-amber-400/50 uppercase tracking-widest">Balcão de Sushi</span>
          </div>

          {/* Entrada */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 border-t-2 border-dashed border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center">
            <span className="text-[9px] font-black text-emerald-500/40 uppercase tracking-widest">Entrada</span>
          </div>

          {/* Estado vazio para VIP / Externo */}
          {areaTables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <span className="material-symbols-outlined text-5xl text-slate-700">table_restaurant</span>
              <p className="text-slate-600 font-bold text-sm">Nenhuma mesa nesta área</p>
              <p className="text-slate-700 text-xs">Clique em "Nova Mesa" para adicionar</p>
            </div>
          )}

          {/* Mesas */}
          {areaTables.map(table => {
            const pos = getPos(table.id);
            const colors = getTableColors(table.status);
            const cart = openTables[table.id] || [];
            const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
            const isSelected = selectedTableId === table.id;
            const isDragging = draggingId === table.id;
            const hasReady = cart.some(i => i.status === 'READY');
            const meta = STATUS_META[table.status];

            return (
              <div
                key={table.id}
                style={{ left: pos.x, top: pos.y, position: 'absolute' }}
                className={`w-28 select-none transition-shadow ${isDragging ? 'z-50 cursor-grabbing' : 'cursor-grab z-10'}`}
                onMouseDown={(e) => handleMouseDown(e, table.id)}
                onClick={() => handleTableClick(table.id)}
              >
                {/* Ring pulsante quando tem item pronto */}
                {hasReady && (
                  <div className="absolute inset-0 rounded-2xl animate-ping opacity-30 ring-2 ring-emerald-400 pointer-events-none" />
                )}
                <div className={`relative border-2 rounded-2xl p-3 text-center transition-all ${colors.border} ${colors.bg} shadow-2xl ${colors.glow} ${isSelected ? `ring-2 ring-white/40 scale-110` : 'hover:scale-105'}`}>
                  {hasReady && (
                    <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-emerald-500 border-2 border-[#080c10] animate-pulse flex items-center justify-center text-[8px] font-black text-white">!</span>
                  )}
                  {/* Ícone de status */}
                  <span className={`material-symbols-outlined text-base mb-0.5 ${colors.text}`} style={{ fontSize: '16px' }}>{meta.icon}</span>
                  {/* Cadeiras decorativas */}
                  <div className="flex justify-center gap-2 mb-1">
                    {Array.from({ length: Math.min(table.capacity, 4) }).map((_, i) => (
                      <div key={i} className={`size-2 rounded-full border ${colors.border} opacity-40`} />
                    ))}
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase block leading-none">MESA</span>
                  <span className="text-xl font-black text-white leading-none">{table.id}</span>
                  <span className={`text-[9px] font-black block mt-1 ${colors.text}`}>{meta.label}</span>
                  {total > 0 && (
                    <span className="text-[9px] font-black text-primary block mt-0.5 font-mono">R$ {total.toFixed(0)}</span>
                  )}
                  {/* Cronômetro ao vivo */}
                  {(() => {
                    const timer = getTableTimer(table.id);
                    if (!timer) return null;
                    const isLong = timer.includes('h') || parseInt(timer.split(':')[0]) >= 60;
                    return (
                      <span className={`text-[10px] font-black font-mono flex items-center justify-center gap-0.5 mt-0.5 ${isLong ? 'text-amber-400' : 'text-emerald-400/70'}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>schedule</span>
                        {timer}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Painel lateral de detalhes quando mesa selecionada */}
        {selectedTable && (
          <aside className="w-72 border-l border-white/5 bg-[#0d1118] flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-white/5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black italic uppercase text-white">Mesa {selectedTable.id}</h3>
                  <div className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${getTableColors(selectedTable.status).text}`}>
                    {STATUS_META[selectedTable.status].label} • {selectedTable.capacity} lugares
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Botão remover mesa */}
                  <button
                    onClick={() => setConfirmRemove(selectedTable.id)}
                    className="size-7 flex items-center justify-center text-slate-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                    title="Remover mesa"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                  <button onClick={() => setSelectedTableId(null)} className="size-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>
              {/* Timer ao vivo no painel */}
              {selectedTimer && (
                <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-black font-mono ${selectedTimer.includes('h') ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                  {selectedTimer} na mesa
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {selectedCart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="material-symbols-outlined text-3xl text-slate-700">receipt_long</span>
                  <p className="text-center text-slate-600 font-bold text-xs">Mesa vazia</p>
                </div>
              ) : (
                selectedCart.map((item, i) => {
                  const badge = getItemStatusBadge(item.status);
                  return (
                    <div key={i} className="flex justify-between items-start p-3 bg-white/[0.03] border border-white/5 rounded-xl gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{item.qty}x {item.name}</span>
                        {item.notes && <p className="text-[9px] text-amber-400/60 italic mt-0.5">📝 {item.notes}</p>}
                        <span className={`inline-block mt-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <span className="text-xs font-black text-primary shrink-0">R$ {(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold">Total Consumo</span>
                <span className="text-xl font-black text-white">R$ {selectedTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => { selectActiveTable(selectedTable.id); }}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">point_of_sale</span>
                Abrir no PDV
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Modal — Adicionar Mesa */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#0d1118] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black italic uppercase text-white mb-1">Nova Mesa</h3>
            <p className="text-xs text-slate-500 mb-5">
              Área: <span className="font-bold text-slate-300">
                {activeArea === 'main' ? 'Salão Principal' : activeArea === 'vip' ? 'VIP / Tatame' : 'Externo'}
              </span>
            </p>

            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Capacidade (lugares)</label>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setNewCapacity(c => Math.max(1, c - 1))}
                className="size-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all font-black text-lg"
              >−</button>
              <span className="text-3xl font-black text-white flex-1 text-center">{newCapacity}</span>
              <button
                onClick={() => setNewCapacity(c => Math.min(20, c + 1))}
                className="size-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all font-black text-lg"
              >+</button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-white/10 rounded-xl text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all">
                Cancelar
              </button>
              <button onClick={handleAddTable} className="flex-1 py-2.5 bg-primary rounded-xl text-xs font-black text-white uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Confirmar Remover Mesa */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmRemove(null)}>
          <div className="bg-[#0d1118] border border-white/10 rounded-2xl p-6 w-72 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined text-rose-500 text-3xl mb-2 block">warning</span>
            <h3 className="text-base font-black text-white mb-1">Remover Mesa {confirmRemove}?</h3>
            <p className="text-xs text-slate-500 mb-5">Esta ação remove a mesa e todos os dados do carrinho associados.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 py-2.5 border border-white/10 rounded-xl text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all">
                Cancelar
              </button>
              <button onClick={() => handleRemoveTable(confirmRemove)} className="flex-1 py-2.5 bg-rose-500 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:brightness-110 transition-all">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableMap;
