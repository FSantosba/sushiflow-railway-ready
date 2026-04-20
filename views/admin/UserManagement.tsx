import React, { useState } from 'react';
import { useAuth, AppUser, UserRole, ROLE_LABELS } from '../../context/AuthContext';

const SCREENS = [
  { id: 'all', label: 'Admin (Acesso Total)' },
  { id: 'dashboard', label: 'Dashboard Resumo' },
  { id: 'admin_dashboard', label: 'Dashboard Admin' },
  { id: 'pdv', label: 'PDV (Balcão)' },
  { id: 'caixa', label: 'Caixa / Fechamento' },
  { id: 'mesas', label: 'Mapa de Mesas' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'garcom', label: 'App do Garçom' },
  { id: 'cozinha', label: 'KDS Cozinha' },
  { id: 'delivery_manager', label: 'Mesa de Delivery' },
  { id: 'logistica', label: 'Painel de Logística' },
  { id: 'driver_app', label: 'App do Motoboy' },
  { id: 'cardapio', label: 'Gestão de Cardápio' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'equipe', label: 'Gestão de RH (Equipe)' },
  { id: 'usuarios', label: 'Controle de Acessos' }
];

const UserManagement: React.FC = () => {
  const { users, saveUser, deleteUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [formData, setFormData] = useState<Partial<AppUser>>({
    name: '',
    role: 'waiter',
    pin: '',
    avatar: '',
    color: 'from-cyan-500 to-blue-700',
    allowedScreens: []
  });

  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        role: 'waiter',
        pin: '',
        avatar: '',
        color: 'from-cyan-500 to-blue-700',
        allowedScreens: []
      });
    }
    setIsModalOpen(true);
  };

  const handleToggleScreen = (screenId: string) => {
    setFormData(prev => {
      const allowed = prev.allowedScreens || [];
      if (screenId === 'all') {
         if (allowed.includes('all')) return { ...prev, allowedScreens: [] };
         return { ...prev, allowedScreens: ['all'] };
      }
      
      const newAllowed = allowed.includes(screenId)
        ? allowed.filter(s => s !== screenId && s !== 'all')
        : [...allowed.filter(s => s !== 'all'), screenId];
      return { ...prev, allowedScreens: newAllowed };
    });
  };

  const handleRoleChange = (role: UserRole) => {
    let defaultScreens: string[] = [];
    if (role === 'manager') defaultScreens = ['all'];
    else if (role === 'waiter') defaultScreens = ['garcom', 'mesas'];
    else if (role === 'kitchen') defaultScreens = ['cozinha'];
    else if (role === 'cashier') defaultScreens = ['caixa', 'pdv'];
    else if (role === 'driver') defaultScreens = ['driver_app'];
    else if (role === 'delivery_manager') defaultScreens = ['delivery_manager', 'logistica'];

    setFormData(prev => ({ ...prev, role, allowedScreens: defaultScreens }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.pin || formData.pin.length !== 4) {
      alert("Nome é obrigatório e o PIN deve ter exatos 4 dígitos.");
      return;
    }

    const newUser: AppUser = {
      id: editingUser?.id || `usr-${Date.now()}`,
      name: formData.name,
      role: formData.role as UserRole,
      pin: formData.pin,
      avatar: formData.avatar || '👤',
      color: formData.color || 'from-slate-500 to-slate-700',
      allowedScreens: formData.allowedScreens || []
    };

    saveUser(newUser);
    setIsModalOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#0d1117] p-8 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic uppercase text-white">Controle de Acessos</h1>
          <p className="text-sm text-slate-400">Gerencie permissionamento e PINs de login</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-white text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.id} className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className={`size-14 rounded-2xl bg-gradient-to-br ${user.color} flex items-center justify-center text-white text-2xl shadow-lg`}>
                {user.avatar}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white">{user.name}</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => handleOpenModal(user)} className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors">
                   <span className="material-symbols-outlined text-sm">edit</span>
                 </button>
                 <button onClick={() => { if(confirm('Quer mesmo remover?')) deleteUser(user.id) }} className="size-8 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 flex items-center justify-center transition-colors">
                   <span className="material-symbols-outlined text-sm">delete</span>
                 </button>
              </div>
            </div>

            <div className="bg-background-dark/50 rounded-xl p-3 border border-border-dark flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">PIN de Login</span>
              <span className="font-mono text-sm tracking-[0.5em] text-white">****</span>
            </div>

            <div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Telas Liberadas</p>
               <div className="flex flex-wrap gap-2">
                 {user.allowedScreens.includes('all') ? (
                   <span className="px-2 py-1 bg-primary/20 text-primary rounded text-[9px] font-bold border border-primary/30">
                     Acesso Total
                   </span>
                 ) : (
                   user.allowedScreens.map(scr => (
                     <span key={scr} className="px-2 py-1 bg-white/5 text-slate-300 rounded text-[9px] font-bold border border-border-dark">
                       {SCREENS.find(s => s.id === scr)?.label || scr}
                     </span>
                   ))
                 )}
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-card-dark border border-border-dark w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col gap-6" onClick={e => e.stopPropagation()}>
             <h2 className="text-2xl font-black italic text-white uppercase">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
             
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Nome Compreto</label>
                    <input autoFocus value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">PIN (Numérico 4 digitos)</label>
                    <input type="password" maxLength={4} pattern="[0-9]{4}" value={formData.pin || ''} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-white" />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase">Papel (Preenche Permissões Automáticas)</label>
                   <select 
                     value={formData.role} 
                     onChange={e => handleRoleChange(e.target.value as UserRole)}
                     className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm text-white"
                   >
                     {Object.entries(ROLE_LABELS).map(([key, val]) => (
                       <option key={key} value={key}>{val}</option>
                     ))}
                   </select>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase">Ajuste de Telas Permitidas (Opcional)</label>
                   <div className="grid grid-cols-3 gap-2">
                     {SCREENS.map(screen => (
                       <label key={screen.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${formData.allowedScreens?.includes(screen.id) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background-dark border-border-dark text-slate-400 hover:bg-white/5'}`}>
                         <input 
                           type="checkbox" 
                           className="hidden" 
                           checked={formData.allowedScreens?.includes(screen.id)}
                           onChange={() => handleToggleScreen(screen.id)} 
                         />
                         <span className="material-symbols-outlined text-base">
                           {formData.allowedScreens?.includes(screen.id) ? 'check_box' : 'check_box_outline_blank'}
                         </span>
                         <span className="text-[10px] font-bold">{screen.label}</span>
                       </label>
                     ))}
                   </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-transparent text-slate-400 border border-border-dark hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all">Cancelar</button>
                  <button type="submit" className="flex-[2] py-3 bg-primary text-white hover:brightness-110 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20">Salvar Usuário</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
