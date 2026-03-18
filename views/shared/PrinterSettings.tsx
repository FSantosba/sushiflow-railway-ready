
import React, { useState, useMemo } from 'react';
import { mockPrinters, initialRoutes } from '../../utils/mockData';
import { Printer, PrintRoute } from '../../types';

const PrinterSettings: React.FC = () => {
  const [printers, setPrinters] = useState<Printer[]>(mockPrinters);
  const [routes, setRoutes] = useState<PrintRoute[]>(initialRoutes);
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);
  const [quickPrintTarget, setQuickPrintTarget] = useState<string | null>(null);

  // Estado para simular carregamento de ações específicas
  const [processingAction, setProcessingAction] = useState<Record<string, 'printing' | 'resetting' | 'quick_print' | null>>({});

  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

  const filteredPrinters = useMemo(() => {
    return printers.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ip.includes(searchTerm)
    );
  }, [printers, searchTerm]);

  const handleGoToDetails = (id: string) => {
    setSelectedPrinterId(id);
    setViewMode('details');
  };

  const handlePrintTest = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProcessingAction(prev => ({ ...prev, [id]: 'printing' }));
    
    setTimeout(() => {
      setProcessingAction(prev => ({ ...prev, [id]: null }));
      alert(`Página de teste enviada com sucesso para a impressora ${id}`);
    }, 1500);
  };

  const handleResetConnection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProcessingAction(prev => ({ ...prev, [id]: 'resetting' }));
    
    setTimeout(() => {
      setProcessingAction(prev => ({ ...prev, [id]: null }));
      alert(`Conexão reestabelecida com o terminal ${id}`);
    }, 2000);
  };

  const executeQuickPrint = (printerId: string, docType: string) => {
    setQuickPrintTarget(null);
    setProcessingAction(prev => ({ ...prev, [printerId]: 'quick_print' }));

    setTimeout(() => {
      setProcessingAction(prev => ({ ...prev, [printerId]: null }));
      alert(`${docType} enviado com sucesso para a impressora ${printerId}`);
    }, 1800);
  };

  const handleAddRoute = (category: string, printerId: string) => {
    if (routes.find(r => r.category === category)) {
      alert("Já existe um roteamento para esta categoria.");
      return;
    }
    setRoutes(prev => [...prev, { category, printerId }]);
    setIsAddRouteModalOpen(false);
  };

  const handleRemoveRoute = (category: string) => {
    if (confirm(`Remover roteamento automático para ${category}?`)) {
      setRoutes(prev => prev.filter(r => r.category !== category));
    }
  };

  if (viewMode === 'details' && selectedPrinter) {
    return (
      <div className="h-full overflow-y-auto p-8 custom-scrollbar animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Detalhes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setViewMode('list')}
                className="size-10 bg-card-dark border border-border-dark rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:border-primary transition-all"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h3 className="text-2xl font-black tracking-tight uppercase italic">{selectedPrinter.name}</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">ID: {selectedPrinter.id} • {selectedPrinter.location}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border ${
                selectedPrinter.status === 'online' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-border-dark text-danger'
              }`}>
                <span className={`size-2 rounded-full ${selectedPrinter.status === 'online' ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
                {selectedPrinter.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card-dark border border-border-dark p-8 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="relative size-40">
                <svg className="size-full" viewBox="0 0 36 36">
                  <path className="stroke-border-dark fill-none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path 
                    className={`fill-none transition-all duration-1000 ${selectedPrinter.paperLevel < 20 ? 'stroke-danger' : 'stroke-primary'}`} 
                    strokeWidth="3" 
                    strokeDasharray={`${selectedPrinter.paperLevel}, 100`} 
                    strokeLinecap="round" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black">{selectedPrinter.paperLevel}%</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Papel</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">Estimativa: ~450 tickets restantes</p>
            </div>

            <div className="md:col-span-2 bg-card-dark border border-border-dark p-8 rounded-[2rem] space-y-6 shadow-xl">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Painel de Operação</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setQuickPrintTarget(selectedPrinter.id)}
                  className="flex flex-col items-center gap-3 p-6 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary hover:text-white transition-all group"
                >
                  <span className={`material-symbols-outlined text-3xl font-light ${processingAction[selectedPrinter.id] === 'quick_print' ? 'animate-spin' : ''}`}>
                    {processingAction[selectedPrinter.id] === 'quick_print' ? 'sync' : 'bolt'}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">Impressão Rápida</span>
                </button>
                <button 
                  onClick={(e) => handlePrintTest(e, selectedPrinter.id)}
                  className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-border-dark rounded-2xl hover:bg-white/10 transition-all"
                >
                   <span className={`material-symbols-outlined text-3xl font-light ${processingAction[selectedPrinter.id] === 'printing' ? 'animate-spin' : ''}`}>
                    {processingAction[selectedPrinter.id] === 'printing' ? 'sync' : 'print'}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">Página de Teste</span>
                </button>
              </div>

              <div className="pt-6 border-t border-border-dark space-y-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configurações de Rede</h4>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Endereço IP</p>
                    <p className="text-lg font-mono font-bold">{selectedPrinter.ip}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">MAC Address</p>
                    <p className="text-lg font-mono font-bold">00:1A:2B:3C:4D:5E</p>
                  </div>
                </div>
                <div className="pt-6">
                  <button 
                    onClick={(e) => handleResetConnection(e, selectedPrinter.id)}
                    className="w-full py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-rose-500/20 flex items-center justify-center gap-3"
                  >
                    <span className={`material-symbols-outlined text-lg ${processingAction[selectedPrinter.id] === 'resetting' ? 'animate-spin' : ''}`}>
                      {processingAction[selectedPrinter.id] === 'resetting' ? 'sync' : 'restart_alt'}
                    </span>
                    Resetar Hard Reset da Conexão
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <QuickPrintModal 
          isOpen={!!quickPrintTarget} 
          onClose={() => setQuickPrintTarget(null)}
          onSelect={(type) => quickPrintTarget && executeQuickPrint(quickPrintTarget, type)}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar space-y-10 animate-in fade-in duration-300 relative">
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div>
            <h3 className="text-2xl font-black tracking-tight uppercase italic">Dispositivos de Impressão</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gerenciamento de hardware e conectividade de rede</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                placeholder="Buscar impressora ou local..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-card-dark border border-border-dark rounded-xl pl-10 pr-4 py-2.5 text-xs w-64 focus:ring-1 focus:ring-primary text-white outline-none placeholder:text-slate-600"
              />
            </div>
            <button className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-sm">add</span>
              Nova Impressora
            </button>
          </div>
        </div>

        {filteredPrinters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredPrinters.map((printer) => (
              <div 
                key={printer.id} 
                onClick={() => handleGoToDetails(printer.id)}
                className="bg-card-dark/60 backdrop-blur-md border border-border-dark rounded-[2rem] p-8 shadow-xl relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-border-dark/50">
                  <div 
                    className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ${printer.paperLevel < 20 ? 'bg-danger' : 'bg-primary'}`}
                    style={{ height: `${printer.paperLevel}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div className={`size-12 rounded-2xl flex items-center justify-center border shadow-inner ${
                    printer.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-800 border-border-dark text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-2xl font-light">print</span>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-black text-slate-100 truncate pr-4 text-lg tracking-tight uppercase">{printer.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="material-symbols-outlined text-xs text-slate-600">location_on</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{printer.location}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-background-dark/50 p-3 rounded-xl border border-border-dark/30 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Endereço IP</span>
                    <span className="text-[11px] font-mono font-bold text-slate-300">{printer.ip}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                    <span className="text-slate-500 flex items-center gap-2">
                      <span className={`size-2 rounded-full ${printer.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                      Status
                    </span>
                    <span className={printer.status === 'online' ? 'text-emerald-500' : 'text-danger'}>
                      {printer.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                    <span className="text-slate-500">Bobina</span>
                    <span className={printer.paperLevel < 20 ? 'text-danger animate-pulse' : 'text-slate-300'}>
                      {printer.paperLevel}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-card-dark/20 border border-dashed border-border-dark rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-700 mb-4 font-light">print_disabled</span>
            <p className="text-lg font-black text-slate-500 uppercase tracking-widest">Nenhuma impressora encontrada</p>
          </div>
        )}
      </section>

      <section>
        <div className="bg-card-dark border border-border-dark rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-border-dark bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black tracking-tight uppercase italic">Roteamento & Filas Inteligentes</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gerencie associações automáticas entre o cardápio e terminais</p>
            </div>
            <div className="flex items-center gap-4">
               <button 
                onClick={() => setIsAddRouteModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
               >
                  <span className="material-symbols-outlined text-sm">queue</span>
                  Nova Regra de Fila
               </button>
            </div>
          </div>

          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-background-dark/30 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-border-dark">
                  <th className="px-10 py-6">Categoria do Cardápio</th>
                  <th className="px-10 py-6">Terminal Destino (Fila Principal)</th>
                  <th className="px-10 py-6 text-center">Via Cliente</th>
                  <th className="px-10 py-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/30">
                {routes.map((route, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_#e66337]"></span>
                        <span className="font-black text-sm uppercase tracking-tight">{route.category}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <select 
                          value={route.printerId}
                          onChange={(e) => {
                            const newRoutes = [...routes];
                            newRoutes[idx].printerId = e.target.value;
                            setRoutes(newRoutes);
                          }}
                          className="bg-background-dark/80 border border-border-dark rounded-xl px-5 py-2.5 text-xs font-black text-slate-300 focus:ring-1 focus:ring-primary w-64 outline-none appearance-none"
                        >
                          {printers.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.location})</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <input type="checkbox" defaultChecked className="size-5 rounded-lg bg-background-dark border-border-dark text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer" />
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button 
                        onClick={() => handleRemoveRoute(route.category)}
                        className="text-slate-600 hover:text-rose-500 transition-colors size-10 rounded-xl hover:bg-rose-500/10"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add Route Modal */}
      <AddRouteModal 
        isOpen={isAddRouteModalOpen} 
        onClose={() => setIsAddRouteModalOpen(false)} 
        onAdd={handleAddRoute}
        printers={printers}
      />

      {/* Quick Print Modal Overlay */}
      <QuickPrintModal 
        isOpen={!!quickPrintTarget} 
        onClose={() => setQuickPrintTarget(null)}
        onSelect={(type) => quickPrintTarget && executeQuickPrint(quickPrintTarget, type)}
      />
    </div>
  );
};

const AddRouteModal: React.FC<{ 
  isOpen: boolean, 
  onClose: () => void, 
  onAdd: (category: string, printerId: string) => void,
  printers: Printer[]
}> = ({ isOpen, onClose, onAdd, printers }) => {
  const [category, setCategory] = useState('');
  const [printerId, setPrinterId] = useState(printers[0]?.id || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-card-dark border border-border-dark w-full max-w-lg rounded-[3rem] p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-black italic tracking-tight uppercase mb-6">Novo Roteamento de Fila</h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoria do Cardápio</label>
            <input 
              type="text" 
              placeholder="Ex: Entradas, Sashimi, Vinhos..." 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Impressora de Destino</label>
            <select 
              value={printerId}
              onChange={(e) => setPrinterId(e.target.value)}
              className="w-full bg-background-dark border border-border-dark rounded-xl px-5 py-3 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
            >
              {printers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 py-4 bg-white/5 text-white text-[10px] font-black uppercase rounded-xl">Cancelar</button>
            <button 
              onClick={() => onAdd(category, printerId)}
              className="flex-[2] py-4 bg-emerald-500 text-background-dark text-[10px] font-black uppercase rounded-xl shadow-lg shadow-emerald-500/20"
            >
              Confirmar Roteamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickPrintModal: React.FC<{ isOpen: boolean, onClose: () => void, onSelect: (type: string) => void }> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-card-dark border border-border-dark w-full max-w-lg rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-10">
          <div>
            <h3 className="text-3xl font-black italic tracking-tight uppercase">Impressão Forçada</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Acionamento manual de documento físico</p>
          </div>
          <button onClick={onClose} className="size-12 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-2xl transition-all flex items-center justify-center border border-border-dark">
            <span className="material-symbols-outlined text-2xl font-black">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {[
            { id: 'comanda', label: 'Comanda Operacional', icon: 'receipt_long', desc: 'Roteamento imediato para sushibar/cozinha' },
            { id: 'recibo', label: 'Extrato de Conferência', icon: 'payments', desc: 'Resumo financeiro detalhado para o cliente' },
            { id: 'relatorio', label: 'Log de Comunicação', icon: 'bar_chart', desc: 'Histórico de status e diagnósticos do terminal' }
          ].map((opt) => (
            <button 
              key={opt.id}
              onClick={() => onSelect(opt.label)}
              className="flex items-center gap-6 p-6 bg-background-dark/50 border border-border-dark rounded-[1.5rem] hover:border-primary group transition-all text-left shadow-lg"
            >
              <div className="size-14 bg-white/5 group-hover:bg-primary group-hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-inner border border-border-dark/50">
                <span className="material-symbols-outlined text-3xl font-light">{opt.icon}</span>
              </div>
              <div>
                <p className="text-base font-black group-hover:text-primary transition-colors tracking-tight uppercase">{opt.label}</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mt-1">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;
