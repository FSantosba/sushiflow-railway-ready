import React, { useState } from 'react';
import { useAuth, AppUser, UserRole, ROLE_LABELS } from '../../context/AuthContext';
import { playErrorSound, playSuccessSound } from '../../utils/sounds';

const ROLE_ICONS: Record<UserRole, string> = {
    manager: 'admin_panel_settings',
    waiter: 'emoji_food_beverage',
    kitchen: 'skillet',
    cashier: 'point_of_sale',
};

const ROLE_COLORS: Record<UserRole, string> = {
    manager: 'from-orange-500 to-red-700',
    waiter: 'from-cyan-500 to-blue-700',
    kitchen: 'from-emerald-500 to-green-700',
    cashier: 'from-purple-500 to-violet-700',
};

const LoginView: React.FC = () => {
    const { users, login } = useAuth();
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSelectUser = (user: AppUser) => {
        setSelectedUser(user);
        setPin('');
        setError(false);
    };

    const handleDigit = (digit: string) => {
        if (pin.length >= 4) return;
        const newPin = pin + digit;
        setPin(newPin);
        setError(false);

        if (newPin.length === 4) {
            setTimeout(() => {
                const ok = login(selectedUser!.id, newPin);
                if (!ok) {
                    playErrorSound();
                    setError(true);
                    setPin('');
                } else {
                    playSuccessSound();
                    setSuccess(true);
                }
            }, 200);
        }
    };

    const handleBackspace = () => {
        setPin(p => p.slice(0, -1));
        setError(false);
    };

    return (
        <div className="h-screen w-full flex bg-[#060a0e] overflow-hidden relative">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
            </div>

            {/* Left: Logo + Brand */}
            <div className="hidden lg:flex flex-col justify-between w-80 bg-[#0a1017] border-r border-white/5 p-10 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="size-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 mb-4">
                        <span className="material-symbols-outlined text-white text-3xl">sushi_roll</span>
                    </div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-tight">Sushi<br />Flow</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Sistema de Gestão Pro</p>
                </div>

                <div className="relative z-10 space-y-3">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Perfis disponíveis</p>
                    {users.map(u => (
                        <div key={u.id} className="flex items-center gap-3 opacity-60">
                            <div className={`size-8 rounded-xl bg-gradient-to-br ${ROLE_COLORS[u.role]} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-white text-sm">{ROLE_ICONS[u.role]}</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">{u.name}</p>
                                <p className="text-[9px] text-slate-500">{ROLE_LABELS[u.role]}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Login */}
            <div className="flex-1 flex items-center justify-center p-8 relative z-10">
                <div className="w-full max-w-md">
                    {!selectedUser ? (
                        /* Seleção de Usuário */
                        <div className="space-y-8">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Bem-vindo ao</p>
                                <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-tight">Quem está<br />acessando?</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        className="group relative bg-[#111820] border border-white/5 rounded-3xl p-6 flex flex-col items-center gap-4 hover:border-white/20 hover:scale-105 transition-all duration-200 text-center overflow-hidden"
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-br ${ROLE_COLORS[user.role]} opacity-0 group-hover:opacity-10 transition-opacity rounded-3xl`} />
                                        <div className={`size-16 rounded-2xl bg-gradient-to-br ${ROLE_COLORS[user.role]} flex items-center justify-center shadow-xl`}>
                                            <span className="material-symbols-outlined text-white text-3xl">{ROLE_ICONS[user.role]}</span>
                                        </div>
                                        <div>
                                            <p className="font-black text-white text-sm">{user.name}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ROLE_LABELS[user.role]}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 transition-colors">arrow_forward</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : success ? (
                        /* Sucesso */
                        <div className="text-center space-y-6">
                            <div className="size-28 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.4)]">
                                <span className="material-symbols-outlined text-white text-6xl">check</span>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black italic uppercase text-white">Bem-vindo!</h2>
                                <p className="text-sm text-slate-400 mt-1">{selectedUser.name} — {ROLE_LABELS[selectedUser.role]}</p>
                            </div>
                        </div>
                    ) : (
                        /* PIN */
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <button onClick={() => { setSelectedUser(null); setPin(''); setError(false); }} className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logando como</p>
                                    <h2 className="text-2xl font-black text-white">{selectedUser.name}</h2>
                                </div>
                            </div>

                            <div className={`size-20 rounded-2xl bg-gradient-to-br ${ROLE_COLORS[selectedUser.role]} mx-auto flex items-center justify-center shadow-2xl`}>
                                <span className="material-symbols-outlined text-white text-4xl">{ROLE_ICONS[selectedUser.role]}</span>
                            </div>

                            {/* PIN Display */}
                            <div>
                                <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">Digite seu PIN</p>
                                <div className={`flex justify-center gap-4 transition-all ${error ? 'animate-bounce' : ''}`}>
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className={`size-5 rounded-full border-2 transition-all duration-150 ${pin.length > i
                                            ? error ? 'bg-rose-500 border-rose-500' : 'bg-white border-white scale-125'
                                            : 'bg-transparent border-white/20'
                                            }`} />
                                    ))}
                                </div>
                                {error && <p className="text-center text-xs text-rose-400 font-bold mt-3 animate-in fade-in">PIN incorreto. Tente novamente.</p>}
                            </div>

                            {/* Teclado */}
                            <div className="grid grid-cols-3 gap-3">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, idx) => (
                                    key === '' ? <div key={idx} /> :
                                        <button
                                            key={idx}
                                            onClick={() => key === '⌫' ? handleBackspace() : handleDigit(key)}
                                            className={`h-16 rounded-2xl text-xl font-black transition-all active:scale-95 ${key === '⌫'
                                                ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                                : 'bg-[#111820] border border-white/5 text-white hover:bg-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            {key}
                                        </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginView;
