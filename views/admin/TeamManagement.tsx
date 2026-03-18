
import React, { useState, useEffect } from 'react';
import { mockEmployees, mockGoals, mockBonuses } from '../../utils/mockData';
import { Employee, EmployeeStatus, EmployeeRole, Goal, BonusEntry } from '../../types';

const TeamManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'goals' | 'bonus'>('roster');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [goals] = useState<Goal[]>(mockGoals);
  const [bonuses] = useState<BonusEntry[]>(mockBonuses);
  const [filter, setFilter] = useState('Todos');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const savedEmployees = localStorage.getItem('sushiflow_team');
    if (savedEmployees) {
      setEmployees(JSON.parse(savedEmployees));
    } else {
      setEmployees(mockEmployees);
    }
  }, []);

  const saveEmployees = (updatedList: Employee[]) => {
    setEmployees(updatedList);
    localStorage.setItem('sushiflow_team', JSON.stringify(updatedList));
  };

  const handleAddNewEmployee = (newEmp: Employee) => {
    const updated = [newEmp, ...employees];
    saveEmployees(updated);
    setIsAddModalOpen(false);
  };

  const handleStatusChange = (id: string, newStatus: EmployeeStatus) => {
    const updated = employees.map(emp => 
      emp.id === id ? { ...emp, status: newStatus } : emp
    );
    saveEmployees(updated);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Deseja realmente remover este colaborador da equipe?")) {
      const updated = employees.filter(e => e.id !== id);
      saveEmployees(updated);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    filter === 'Todos' || emp.status === filter
  );

  const getStatusColor = (status: EmployeeStatus) => {
    switch (status) {
      case EmployeeStatus.ONLINE: return 'text-success bg-success/10 border-success/20';
      case EmployeeStatus.BREAK: return 'text-warning bg-warning/10 border-warning/20';
      case EmployeeStatus.OFFLINE: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default: return '';
    }
  };

  const getPerformanceColor = (perf: number) => {
    if (perf >= 90) return 'bg-emerald-500';
    if (perf >= 75) return 'bg-primary';
    return 'bg-amber-500';
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#0d1117]">
      {/* Sub Navigation Bar */}
      <div className="sticky top-0 z-20 bg-background-dark/80 backdrop-blur-md border-b border-border-dark px-8 py-3 flex items-center justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl border border-border-dark">
          {[
            { id: 'roster', label: 'Dashboard da Equipe', icon: 'groups' },
            { id: 'goals', label: 'Metas Operacionais', icon: 'target' },
            { id: 'bonus', label: 'Bônus & Comissões', icon: 'payments' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeSubTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        <button className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">settings_account_box</span>
          Configurações HR
        </button>
      </div>

      <div className="p-8 space-y-8 pb-20">
        {activeSubTab === 'roster' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl flex items-center gap-4">
                <div className="size-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl font-bold">badge</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Equipe</p>
                  <h4 className="text-2xl font-black">{employees.length} Membros</h4>
                </div>
              </div>
              <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl flex items-center gap-4">
                <div className="size-12 bg-success/20 rounded-xl flex items-center justify-center text-success">
                  <span className="material-symbols-outlined text-2xl font-bold">person_play</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ativos Agora</p>
                  <h4 className="text-2xl font-black">{employees.filter(e => e.status === EmployeeStatus.ONLINE).length} Online</h4>
                </div>
              </div>
              <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl flex items-center gap-4">
                <div className="size-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                  <span className="material-symbols-outlined text-2xl font-bold">query_stats</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Perf. Média</p>
                  <h4 className="text-2xl font-black">
                    {employees.length > 0 
                      ? (employees.reduce((acc, e) => acc + e.performance, 0) / employees.length).toFixed(1)
                      : '0'}%
                  </h4>
                </div>
              </div>
              <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl flex items-center gap-4">
                <div className="size-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined text-2xl font-bold">schedule</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Horas Extra</p>
                  <h4 className="text-2xl font-black">12.5h <span className="text-xs text-slate-500 font-normal">/semana</span></h4>
                </div>
              </div>
            </div>

            {/* Header com Filtros */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex bg-background-dark/50 p-1 rounded-xl border border-border-dark">
                {['Todos', EmployeeStatus.ONLINE, EmployeeStatus.BREAK, EmployeeStatus.OFFLINE].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilter(st)}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      filter === st ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-white text-black px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Adicionar Membro
              </button>
            </div>

            {/* Grid de Colaboradores */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className="bg-card-dark/50 backdrop-blur-md border border-border-dark rounded-[2rem] p-8 shadow-2xl hover:border-primary/50 transition-all group relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  <div className="absolute -top-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div 
                          className="size-20 rounded-3xl overflow-hidden border-4 border-background-dark shadow-2xl bg-slate-800 flex items-center justify-center"
                        >
                          <img src={emp.avatar || 'https://i.pravatar.cc/150?u=empty'} alt={emp.name} className="w-full h-full object-cover" />
                        </div>
                        <span className={`absolute -bottom-1 -right-1 size-5 rounded-full border-4 border-card-dark ${
                          emp.status === EmployeeStatus.ONLINE ? 'bg-success' : 
                          emp.status === EmployeeStatus.BREAK ? 'bg-warning' : 'bg-slate-500'
                        }`}></span>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors">{emp.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-border-dark">
                            {emp.role}
                          </span>
                          
                          {/* Seleção Dinâmica de Status */}
                          <div className="relative inline-block group/status">
                            <select 
                              value={emp.status}
                              onChange={(e) => handleStatusChange(emp.id, e.target.value as EmployeeStatus)}
                              className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border outline-none appearance-none cursor-pointer pr-4 hover:brightness-110 transition-all ${getStatusColor(emp.status)}`}
                            >
                              {Object.values(EmployeeStatus).map(status => (
                                <option key={status} value={status} className="bg-card-dark text-white font-bold">{status}</option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none opacity-60">expand_more</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="size-8 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-lg transition-all flex items-center justify-center border border-border-dark"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-background-dark/50 p-4 rounded-2xl border border-border-dark/30">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Início Turno</p>
                        <p className="text-sm font-black text-white">{emp.shiftStart}</p>
                      </div>
                      <div className="bg-background-dark/50 p-4 rounded-2xl border border-border-dark/30 text-right">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Tarefas/Pedidos</p>
                        <p className="text-sm font-black text-white">{emp.tasksCompleted}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Produtividade</p>
                        <span className="text-xs font-black text-white">{emp.performance}%</span>
                      </div>
                      <div className="w-full h-2 bg-background-dark rounded-full overflow-hidden border border-border-dark">
                        <div 
                          className={`h-full transition-all duration-1000 ${getPerformanceColor(emp.performance)} shadow-[0_0_10px_rgba(230,99,55,0.3)]`} 
                          style={{ width: `${emp.performance}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button 
                         onClick={() => window.open(`https://wa.me/55${emp.phone.replace(/\D/g, '')}`, '_blank')}
                         className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-emerald-500/20"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
                      </button>
                      <button className="flex-1 py-3 bg-white/5 hover:bg-primary text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-border-dark">
                        <span className="material-symbols-outlined text-sm">history</span> Histórico
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outras tabs (Goals, Bonus) mantidas com o design original */}
        {activeSubTab === 'goals' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {goals.map((goal) => {
                 const progress = Math.min(100, (goal.current / goal.target) * 100);
                 return (
                   <div key={goal.id} className="bg-card-dark border border-border-dark p-8 rounded-[2.5rem] shadow-xl space-y-6 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-5">
                        <span className="material-symbols-outlined text-8xl">track_changes</span>
                     </div>
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{goal.title}</h3>
                     <div className="w-full h-4 bg-background-dark/50 rounded-full overflow-hidden border border-border-dark/50 p-1">
                        <div 
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        ></div>
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {activeSubTab === 'bonus' && (
          <div className="bg-card-dark border border-border-dark rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in">
             <div className="p-8 border-b border-border-dark flex justify-between items-center">
                <h3 className="text-xl font-black uppercase italic">Comissões & Bônus</h3>
             </div>
             <table className="w-full text-left">
                <tbody className="divide-y divide-border-dark/30">
                  {bonuses.map((bonus, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-5 font-bold text-slate-200">{bonus.employeeName}</td>
                      <td className="px-8 py-5 text-sm text-slate-400 italic">"{bonus.reason}"</td>
                      <td className="px-8 py-5 text-right font-black text-white">R$ {bonus.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}
      </div>

      <AddEmployeeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddNewEmployee}
      />
    </div>
  );
};

// --- Modal de Adição de Colaborador ---
const AddEmployeeModal: React.FC<{
  isOpen: boolean,
  onClose: () => void,
  onAdd: (emp: Employee) => void
}> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: EmployeeRole.WAITER,
    shiftStart: '18:00',
    phone: '',
    avatar: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Por favor, preencha o nome e o telefone.");
      return;
    }

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: formData.name,
      role: formData.role,
      status: EmployeeStatus.OFFLINE,
      performance: Math.floor(Math.random() * 20) + 70, 
      shiftStart: formData.shiftStart,
      tasksCompleted: 0,
      avatar: formData.avatar || `https://i.pravatar.cc/150?u=${formData.name}`,
      phone: formData.phone
    };

    onAdd(newEmp);
    setFormData({ name: '', role: EmployeeRole.WAITER, shiftStart: '18:00', phone: '', avatar: '' });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-[#1a2027] border border-white/10 w-full max-w-xl rounded-[3rem] p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 flex flex-col gap-8" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-3xl font-black italic tracking-tight uppercase text-white">Novo Colaborador</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Cadastro oficial da unidade</p>
          </div>
          <button onClick={onClose} className="size-12 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-2xl transition-all flex items-center justify-center border border-white/10">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4 mb-4">
             <div className="size-24 rounded-3xl bg-black/20 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                {formData.avatar ? (
                  <img src={formData.avatar} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-white/10">add_a_photo</span>
                )}
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preview de Perfil</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome Completo *</label>
            <input 
              type="text" 
              autoFocus
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none"
              placeholder="Ex: João Mitsui"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargo Operacional *</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as EmployeeRole})}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
              >
                {Object.values(EmployeeRole).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Início do Turno *</label>
              <input 
                type="time" 
                value={formData.shiftStart}
                onChange={e => setFormData({...formData, shiftStart: e.target.value})}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefone (WhatsApp) *</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL da Foto</label>
              <input 
                type="text" 
                value={formData.avatar}
                onChange={e => setFormData({...formData, avatar: e.target.value})}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-slate-400 focus:ring-1 focus:ring-primary outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/10"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-[2] py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:brightness-110 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Confirmar Contratação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamManagement;
