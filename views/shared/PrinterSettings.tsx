import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useServer } from '../../context/ServerContext';

const BRANDS = ['EPSON', 'BEMATECH', 'ELGIN', 'DARUMA', 'STAR', 'GENERIC'];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PrinterInfo {
  key: string;
  name: string;
  type: string;
  mode: 'usb' | 'network';
  interface_path: string;
  enabled: number;
  heartbeat: number;
  is_default: number;
  // Status em tempo real (carregado de /api/printers/status)
  online?: boolean;
  statusDetail?: string;
}

interface StatusResult {
  key: string;
  online: boolean;
  detail: string;
}

const PrinterSettings: React.FC = () => {
  const { serverUrl, setServerUrl, isOnline, serverConfig, updateServerConfig, printTest, pingServer } = useServer();

  const [localUrl, setLocalUrl] = useState(serverUrl);
  const [pinging, setPinging] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'add'>('list');
  const [selectedPrinterKey, setSelectedPrinterKey] = useState<string | null>(null);
  const [localIface, setLocalIface] = useState('');

  // Lista dinâmica vinda da API
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Modais
  const [quickPrintTarget, setQuickPrintTarget] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<Record<string, 'printing' | 'saving' | null>>({});

  // Formulário de nova impressora
  const [newPrinter, setNewPrinter] = useState({
    key: '', name: '', type: 'EPSON', mode: 'usb' as 'usb' | 'network',
    interface_path: 'auto', heartbeat: false, is_default: false
  });

  // ─── Carrega lista de impressoras do backend ────────────────────────────────
  const loadPrinters = useCallback(async () => {
    if (!isOnline || !serverUrl) return;
    try {
      const res = await fetch(`${serverUrl}/api/printers`);
      if (res.ok) {
        const list: PrinterInfo[] = await res.json();
        setPrinters(list);
      }
    } catch {}
  }, [isOnline, serverUrl]);

  // ─── Verifica status real (TCP/Spooler) ────────────────────────────────────
  const loadStatus = useCallback(async () => {
    if (!isOnline || !serverUrl) return;
    setLoadingStatus(true);
    try {
      const res = await fetch(`${serverUrl}/api/printers/status`);
      if (res.ok) {
        const statusList: StatusResult[] = await res.json();
        setPrinters(prev => prev.map(p => {
          const s = statusList.find(x => x.key === p.key);
          return s ? { ...p, online: s.online, statusDetail: s.detail } : p;
        }));
      }
    } catch {} finally {
      setLoadingStatus(false);
    }
  }, [isOnline, serverUrl]);

  // Inicializa e sincroniza form local
  useEffect(() => {
    if (serverConfig?.RESTAURANT_NAME) setRestaurantName(serverConfig.RESTAURANT_NAME);
    if (serverUrl) setLocalUrl(serverUrl);
  }, [serverConfig, serverUrl]);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  // Verifica status logo ao carregar e a cada 30s
  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const selectedPrinter = printers.find(p => p.key === selectedPrinterKey);

  useEffect(() => {
    if (selectedPrinter) setLocalIface(selectedPrinter.interface_path || 'auto');
  }, [selectedPrinter?.key]);

  const filteredPrinters = useMemo(() =>
    printers.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.interface_path || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.key.toLowerCase().includes(searchTerm.toLowerCase())
    ), [printers, searchTerm]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handlePing = async () => {
    setPinging(true);
    setServerUrl(localUrl);
    await pingServer();
    setPinging(false);
  };

  const handleUpdateName = async () => {
    setProcessingAction(prev => ({ ...prev, name: 'saving' }));
    await updateServerConfig({ RESTAURANT_NAME: restaurantName });
    setProcessingAction(prev => ({ ...prev, name: null }));
  };

  const handleSavePrinterField = async (key: string, updates: Record<string, any>) => {
    if (!isOnline) return;
    setProcessingAction(prev => ({ ...prev, [key]: 'saving' }));
    try {
      await fetch(`${serverUrl}/api/printers/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      // Atualiza também config legado (para compatibilidade)
      if (key === 'KITCHEN' || key === 'BAR') {
        const prefix = `PRINTER_${key}`;
        const legacyUpdates: any = {};
        if (updates.type) legacyUpdates[`${prefix}_TYPE`] = updates.type;
        if (updates.mode) legacyUpdates[`${prefix}_MODE`] = updates.mode;
        if (updates.interface_path) legacyUpdates[`${prefix}_INTERFACE`] = updates.interface_path;
        if (Object.keys(legacyUpdates).length) await updateServerConfig(legacyUpdates);
      }
      await loadPrinters();
    } catch {} finally {
      setProcessingAction(prev => ({ ...prev, [key]: null }));
    }
  };

  const handlePrintTest = async (key: string) => {
    setProcessingAction(prev => ({ ...prev, [key]: 'printing' }));
    const result = await printTest(key);
    setProcessingAction(prev => ({ ...prev, [key]: null }));
    if (!result.ok) alert(`❌ Falha na impressora ${key}:\n${result.error}`);
    else alert(`✅ Teste enviado com sucesso para ${key}!`);
  };

  const handleAddPrinter = async () => {
    if (!newPrinter.key || !newPrinter.name) return alert('Chave e Nome são obrigatórios.');
    try {
      const res = await fetch(`${serverUrl}/api/printers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrinter),
      });
      if (res.ok) {
        await loadPrinters();
        setViewMode('list');
        setNewPrinter({ key: '', name: '', type: 'EPSON', mode: 'usb', interface_path: 'auto', heartbeat: false, is_default: false });
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e: any) { alert(`Erro: ${e.message}`); }
  };

  const handleDeletePrinter = async (key: string) => {
    if (!confirm(`Remover impressora "${key}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/printers/${key}`, { method: 'DELETE' });
      if (res.ok) { await loadPrinters(); setViewMode('list'); }
      else { const err = await res.json(); alert(`Erro: ${err.error}`); }
    } catch (e: any) { alert(`Erro: ${e.message}`); }
  };

  // ─── View: ADICIONAR IMPRESSORA ─────────────────────────────────────────────
  if (viewMode === 'add') {
    return (
      <div className="h-full overflow-y-auto p-8 custom-scrollbar animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('list')} className="size-10 bg-card-dark border border-border-dark rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:border-primary transition-all">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h3 className="text-2xl font-black tracking-tight uppercase italic">Nova Impressora</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Adicionar terminal térmico ao sistema</p>
            </div>
          </div>

          <div className="bg-card-dark border border-border-dark rounded-[2rem] p-8 space-y-6 shadow-xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Chave Interna *</label>
                <input type="text" placeholder="Ex: PIZZA, FRITOS, BAR2"
                  value={newPrinter.key} onChange={e => setNewPrinter(p => ({ ...p, key: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                  className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-mono font-bold text-slate-300 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Nome Amigável *</label>
                <input type="text" placeholder="Ex: Cozinha Frios"
                  value={newPrinter.name} onChange={e => setNewPrinter(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-bold text-slate-300 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Marca / Protocolo</label>
                <select value={newPrinter.type} onChange={e => setNewPrinter(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-black text-slate-300 outline-none appearance-none">
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Conexão</label>
                <div className="flex bg-background-dark border border-border-dark rounded-xl p-1">
                  {(['usb', 'network'] as const).map(m => (
                    <button key={m} onClick={() => setNewPrinter(p => ({ ...p, mode: m, interface_path: m === 'usb' ? 'auto' : '' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newPrinter.mode === m ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                      {m === 'usb' ? 'USB/Spooler' : 'Rede LAN'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[10px] text-primary">{newPrinter.mode === 'usb' ? 'usb' : 'wifi'}</span>
                  {newPrinter.mode === 'usb' ? 'Nome no Spooler Windows (ou "auto")' : 'Endereço IP:Porta'}
                </label>
                <input type="text"
                  value={newPrinter.interface_path}
                  onChange={e => setNewPrinter(p => ({ ...p, interface_path: e.target.value }))}
                  placeholder={newPrinter.mode === 'usb' ? 'auto ou \\\\localhost\\EPSON' : '192.168.1.55:9100'}
                  className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-mono font-bold text-slate-300 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {newPrinter.mode === 'network' && (
                <div className="col-span-2 flex items-center gap-3 p-4 bg-background-dark/50 rounded-xl border border-border-dark">
                  <input type="checkbox" id="heartbeat-new" checked={newPrinter.heartbeat}
                    onChange={e => setNewPrinter(p => ({ ...p, heartbeat: e.target.checked }))}
                    className="size-5 rounded accent-primary" />
                  <label htmlFor="heartbeat-new" className="text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer">
                    Heartbeat — Manter impressora acordada (ping a cada 4 min, evita modo sleep)
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={() => setViewMode('list')} className="flex-1 py-3 bg-white/5 border border-border-dark rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={handleAddPrinter} className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                Adicionar Impressora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── View: DETALHES ─────────────────────────────────────────────────────────
  if (viewMode === 'details' && selectedPrinter) {
    const isProtected = selectedPrinter.key === 'KITCHEN' || selectedPrinter.key === 'BAR';
    const printerOnline = selectedPrinter.online;

    return (
      <div className="h-full overflow-y-auto p-8 custom-scrollbar animate-in fade-in slide-in-from-right-4 duration-300 relative">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setViewMode('list')} className="size-10 bg-card-dark border border-border-dark rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:border-primary transition-all shadow-lg">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h3 className="text-2xl font-black tracking-tight uppercase italic">{selectedPrinter.name}</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Rota: {selectedPrinter.key} • {selectedPrinter.mode === 'usb' ? 'USB/Spooler' : 'Rede LAN'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {processingAction[selectedPrinter.key] === 'saving' && (
                <span className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase rounded-xl flex items-center gap-2">
                  <div className="size-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                  Salvando...
                </span>
              )}
              {/* Status real da impressora */}
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border ${
                printerOnline === undefined ? 'bg-slate-800 border-border-dark text-slate-500' :
                printerOnline ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'
              }`}>
                <span className={`size-2 rounded-full ${printerOnline === undefined ? 'bg-slate-600' : printerOnline ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                {printerOnline === undefined ? 'Verificando...' : printerOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>

          {/* Detalhe do status */}
          {selectedPrinter.statusDetail && (
            <div className={`px-5 py-3 rounded-xl text-[10px] font-mono font-bold border ${printerOnline ? 'bg-success/5 border-success/20 text-success/80' : 'bg-danger/5 border-danger/20 text-danger/80'}`}>
              {selectedPrinter.statusDetail}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gauge de papel (visual) */}
            <div className="bg-card-dark border border-border-dark p-8 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="relative size-40">
                <svg className="size-full" viewBox="0 0 36 36">
                  <path className="stroke-border-dark fill-none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className={`fill-none transition-all duration-1000 ${printerOnline ? 'stroke-primary' : 'stroke-slate-700'}`}
                    strokeWidth="3" strokeDasharray="85, 100" strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-4xl font-light text-primary">print</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{selectedPrinter.mode === 'usb' ? 'USB' : 'LAN'}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400">{selectedPrinter.type}</p>
                <p className="text-[10px] text-slate-600 font-mono mt-1">{selectedPrinter.interface_path}</p>
              </div>
              <button onClick={loadStatus} className="text-[10px] font-black uppercase text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
                <span className={`material-symbols-outlined text-xs ${loadingStatus ? 'animate-spin' : ''}`}>refresh</span>
                Atualizar Status
              </button>
            </div>

            {/* Painel de operação */}
            <div className="md:col-span-2 bg-card-dark border border-border-dark p-8 rounded-[2rem] space-y-6 shadow-xl">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Painel de Operação</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => setQuickPrintTarget(selectedPrinter.key)} disabled={!isOnline}
                  className="flex flex-col items-center gap-3 p-6 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary hover:text-white transition-all group disabled:opacity-50">
                  <span className="material-symbols-outlined text-3xl font-light group-hover:animate-pulse">bolt</span>
                  <span className="text-xs font-black uppercase tracking-widest">Impressão Rápida</span>
                </button>
                <button onClick={() => handlePrintTest(selectedPrinter.key)}
                  disabled={!isOnline || processingAction[selectedPrinter.key] === 'printing'}
                  className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-border-dark rounded-2xl hover:bg-white/10 transition-all disabled:opacity-50">
                  <span className={`material-symbols-outlined text-3xl font-light ${processingAction[selectedPrinter.key] === 'printing' ? 'animate-spin' : ''}`}>
                    {processingAction[selectedPrinter.key] === 'printing' ? 'sync' : 'print'}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">Disparar Teste Real</span>
                </button>
              </div>

              {/* Config do hardware */}
              <div className="pt-6 border-t border-border-dark space-y-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configurações do Hardware</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Marca</label>
                    <select value={selectedPrinter.type}
                      onChange={e => handleSavePrinterField(selectedPrinter.key, { type: e.target.value })}
                      className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-black text-slate-300 focus:ring-1 focus:ring-primary outline-none appearance-none">
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">Conexão</label>
                    <div className="flex bg-background-dark border border-border-dark rounded-xl p-1">
                      {(['usb', 'network'] as const).map(m => (
                        <button key={m} onClick={() => handleSavePrinterField(selectedPrinter.key, { mode: m, interface_path: m === 'usb' ? 'auto' : '192.168.1.100:9100' })}
                          className={`flex-1 flex justify-center items-center py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedPrinter.mode === m ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                          {m === 'usb' ? 'USB/Spooler' : 'Rede LAN'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[10px] text-primary">{selectedPrinter.mode === 'usb' ? 'usb' : 'wifi'}</span>
                      {selectedPrinter.mode === 'usb' ? 'NOME NO SPOOLER (ou "auto")' : 'ENDEREÇO IP:PORTA'}
                    </label>
                    <input type="text" value={localIface}
                      onChange={e => setLocalIface(e.target.value)}
                      onBlur={() => handleSavePrinterField(selectedPrinter.key, { interface_path: localIface })}
                      placeholder={selectedPrinter.mode === 'usb' ? 'auto ou \\\\localhost\\EPSON' : '192.168.1.50:9100'}
                      className="w-full bg-background-dark/80 border border-border-dark focus:border-primary/50 rounded-xl px-5 py-3 text-sm font-mono font-bold text-slate-300 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-primary/30"
                    />
                    <p className="text-[10px] text-slate-500">Alterações sincronizadas automaticamente ao clicar fora do campo.</p>
                  </div>

                  {selectedPrinter.mode === 'network' && (
                    <div className="col-span-2 flex items-center gap-3 p-4 bg-background-dark/50 rounded-xl border border-border-dark">
                      <input type="checkbox" id="heartbeat-cb" checked={!!selectedPrinter.heartbeat}
                        onChange={e => handleSavePrinterField(selectedPrinter.key, { heartbeat: e.target.checked ? 1 : 0 })}
                        className="size-5 rounded accent-primary" />
                      <label htmlFor="heartbeat-cb" className="text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer">
                        Heartbeat — Manter acordada (ping a cada 4 min, evita modo sleep EPSON)
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Remover impressora (só para não-padrão) */}
              {!isProtected && (
                <div className="pt-4 border-t border-border-dark">
                  <button onClick={() => handleDeletePrinter(selectedPrinter.key)}
                    className="w-full py-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all">
                    Remover Impressora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <QuickPrintModal isOpen={!!quickPrintTarget} onClose={() => setQuickPrintTarget(null)}
          onSelect={() => { if (quickPrintTarget) handlePrintTest(quickPrintTarget); setQuickPrintTarget(null); }} />
      </div>
    );
  }

  // ─── View: LISTA ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar space-y-10 animate-in fade-in duration-300 relative">

      {/* HOST SERVER MANAGEMENT */}
      <section className="bg-card-dark border border-border-dark rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-40 -right-40 size-80 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`size-3 rounded-full ${isOnline ? 'bg-success animate-pulse shadow-[0_0_15px_#10b981]' : 'bg-danger shadow-[0_0_15px_#f43f5e]'}`} />
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-100">Centro de Operações (Backend)</h2>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-sm">Status da ponte térmica principal da rede LAN.</p>
          </div>

          <div className="flex-1 max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">IP do Servidor Local</label>
              <div className="flex bg-background-dark/80 border border-border-dark rounded-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                <span className="material-symbols-outlined text-slate-500 py-3 pl-4 pr-2 text-sm">wifi_tethering</span>
                <input type="text" value={localUrl} onChange={e => setLocalUrl(e.target.value)} placeholder="http://192.168..."
                  className="flex-1 bg-transparent border-none px-2 py-3 text-sm font-mono font-bold text-slate-300 outline-none placeholder:text-slate-700" />
                <button onClick={handlePing} disabled={pinging}
                  className="px-6 py-2 m-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2">
                  {pinging ? <div className="size-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> : 'Ping'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nome do Restaurante</label>
              <div className="flex bg-background-dark/80 border border-border-dark rounded-xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                <span className="material-symbols-outlined text-slate-500 py-3 pl-4 pr-2 text-sm">storefront</span>
                <input type="text" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="Ex: Sushi Flow"
                  className="flex-1 bg-transparent border-none px-2 py-3 text-sm font-bold text-slate-300 outline-none placeholder:text-slate-700" />
                <button onClick={handleUpdateName}
                  className="px-4 py-2 m-1 bg-primary text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-lg hover:brightness-110 flex items-center justify-center min-w-[60px]">
                  {processingAction['name'] === 'saving' ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DISPOSITIVOS GRID */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div>
            <h3 className="text-2xl font-black tracking-tight uppercase italic">Terminais Térmicos</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              {printers.length} impressora{printers.length !== 1 ? 's' : ''} configurada{printers.length !== 1 ? 's' : ''}
              {loadingStatus && <span className="text-slate-600 ml-2">• Verificando...</span>}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-primary transition-colors">search</span>
              <input type="text" placeholder="Buscar impressora ou IP..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-card-dark border border-border-dark rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold w-64 focus:ring-1 focus:ring-primary text-white outline-none placeholder:text-slate-600" />
            </div>

            {/* Botão habilitado — backend já suporta impressoras dinâmicas */}
            <button onClick={() => setViewMode('add')}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-primary/30 transition-all shadow-lg">
              <span className="material-symbols-outlined text-sm">add</span>
              Nova Impressora
            </button>
          </div>
        </div>

        {filteredPrinters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredPrinters.map((printer) => {
              const statusColor = printer.online === undefined ? 'bg-slate-700' : printer.online ? 'bg-success animate-pulse' : 'bg-danger';
              const statusText  = printer.online === undefined ? 'Verificando' : printer.online ? 'Online' : 'Offline';
              const cardBorder  = printer.online ? 'hover:border-success/50' : printer.online === false ? 'hover:border-danger/30' : 'hover:border-primary/50';
              return (
                <div key={printer.key} onClick={() => { setSelectedPrinterKey(printer.key); setViewMode('details'); }}
                  className={`bg-card-dark/60 backdrop-blur-md border border-border-dark rounded-[2rem] p-8 shadow-xl relative overflow-hidden group cursor-pointer ${cardBorder} transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2 duration-300`}>

                  {/* Barra lateral de papel */}
                  <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-border-dark/50">
                    <div className="absolute bottom-0 left-0 right-0 transition-all duration-1000 bg-primary shadow-[0_0_10px_#e66337]" style={{ height: '85%' }} />
                  </div>

                  <div className="flex justify-between items-start mb-6">
                    <div className={`size-12 rounded-2xl flex items-center justify-center border shadow-inner ${
                      printer.online ? 'bg-success/20 border-success/30 text-success' :
                      printer.online === false ? 'bg-danger/10 border-danger/20 text-danger' :
                      'bg-slate-800 border-border-dark text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-2xl font-light">print</span>
                    </div>
                    {/* Badge USB/Rede */}
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-background-dark border border-border-dark text-slate-500">
                      {printer.mode === 'usb' ? 'USB' : 'LAN'}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-black text-slate-100 truncate pr-4 text-lg tracking-tight uppercase">{printer.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{printer.key} (Via Interna)</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-background-dark/50 p-3 rounded-xl border border-border-dark/30 flex justify-between items-center overflow-hidden">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">{printer.mode === 'network' ? 'IP' : 'SPOOL'}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-300 truncate pl-2">{printer.interface_path || 'auto'}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                      <span className="text-slate-500 flex items-center gap-2">
                        <span className={`size-2 rounded-full ${statusColor}`} />
                        Impressora Física
                      </span>
                      <span className={printer.online ? 'text-success' : printer.online === false ? 'text-danger' : 'text-slate-500'}>
                        {statusText}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                      <span className="text-slate-500">Bobina Padrão</span>
                      <span className="text-slate-300">80mm (48 col)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-card-dark/20 border border-dashed border-border-dark rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-700 mb-4 font-light">print_disabled</span>
            <p className="text-lg font-black text-slate-500 uppercase tracking-widest">Nenhum terminal encontrado</p>
            {!isOnline && <p className="text-xs text-slate-600 mt-2">Verifique conexão com o servidor backend ({serverUrl})</p>}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Modal de impressão rápida ────────────────────────────────────────────────
const QuickPrintModal: React.FC<{ isOpen: boolean; onClose: () => void; onSelect: (type: string) => void }> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-card-dark border border-border-dark w-full max-w-lg rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-10">
          <div>
            <h3 className="text-3xl font-black italic tracking-tight uppercase">Diagnóstico Físico</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Disparo direto com a impressora para calibração</p>
          </div>
          <button onClick={onClose} className="size-12 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-2xl transition-all flex items-center justify-center border border-border-dark">
            <span className="material-symbols-outlined text-2xl font-black">close</span>
          </button>
        </div>
        <button onClick={() => onSelect('CALIBRACAO')}
          className="w-full flex items-center gap-6 p-6 bg-primary/10 border border-primary/20 rounded-[1.5rem] hover:bg-primary group transition-all text-left shadow-lg cursor-pointer">
          <div className="size-14 bg-white/5 group-hover:bg-black/20 text-primary group-hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-inner border border-white/10">
            <span className="material-symbols-outlined text-3xl font-light">receipt_long</span>
          </div>
          <div>
            <p className="text-base font-black text-primary group-hover:text-white transition-colors tracking-tight uppercase">Página de Calibração / Extrato</p>
            <p className="text-[10px] text-primary/70 group-hover:text-white/80 font-black uppercase tracking-tighter mt-1">Testa corte da guilhotina e envio do Backend</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default PrinterSettings;
