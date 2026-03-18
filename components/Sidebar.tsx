import React from 'react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
}

const menuItems = [
    { id: 'admin_dashboard', label: 'Painel Admin', icon: 'monitoring', roles: ['manager'] },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['manager', 'cashier'] },
    { id: 'garcom', label: 'App Garçom', icon: 'restaurant', roles: ['manager', 'waiter'] },
    { id: 'pdv', label: 'PDV', icon: 'point_of_sale', roles: ['manager', 'cashier'] },
    { id: 'delivery_app', label: 'Delivery App', icon: 'smartphone', roles: ['manager'] },
    { id: 'caixa', label: 'Caixa', icon: 'payments', roles: ['manager', 'cashier'] },
    { id: 'mesas', label: 'Mesas', icon: 'table_restaurant', roles: ['manager', 'waiter'] },
    { id: 'reservas', label: 'Reservas', icon: 'event_seat', roles: ['manager', 'waiter'] },
    { id: 'cozinha', label: 'Painel KDS', icon: 'skillet', roles: ['manager', 'kitchen'] },
    { id: 'logistica', label: 'Log\u00edstica', icon: 'local_shipping', roles: ['manager'] },
    { id: 'driver_app', label: 'App do Motoboy', icon: 'two_wheeler', roles: ['manager', 'driver'] },
    { id: 'estoque', label: 'Estoque', icon: 'inventory_2', roles: ['manager'] },
    { id: 'cardapio', label: 'Card\u00e1pio', icon: 'restaurant_menu', roles: ['manager', 'waiter'] },
    { id: 'cmv', label: 'Gest\u00e3o CMV', icon: 'price_check', roles: ['manager'] },
    { id: 'financeiro', label: 'Financeiro (Antigo)', icon: 'bar_chart', roles: ['manager'] },
    { id: 'equipe', label: 'Equipe', icon: 'groups', roles: ['manager'] },
    { id: 'impressao', label: 'Impressoras', icon: 'print', roles: ['manager'] },
];

const ROLE_LABELS: Record<string, string> = {
    manager: 'Gerente',
    waiter: 'Gar\u00e7om',
    kitchen: 'Cozinha',
    cashier: 'Caixa',
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
    const { currentUser, logout } = useAuth();
    const userRole = currentUser?.role || 'manager';
    const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

    return (
        <aside className="w-64 bg-card-dark border-r border-border-dark flex flex-col h-full">
            <div className="p-6 flex items-center gap-3 border-b border-border-dark">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-md">sushi_roll</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    SushiFlow
                </h1>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
                <ul className="space-y-1">
                    {visibleItems.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeView === item.id
                                    ? item.id === 'cmv'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-primary/10 text-primary'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className={`material-symbols-outlined ${activeView === item.id ? 'fill-1' : ''}`}>
                                    {item.icon}
                                </span>
                                <span className="font-medium text-sm">{item.label}</span>
                                {activeView === item.id && (
                                    <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.id === 'cmv' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-primary shadow-[0_0_8px_rgba(230,99,55,0.8)]'}`} />
                                )}
                                {/* Badge CMV */}
                                {item.id === 'cmv' && activeView !== 'cmv' && (
                                    <span className="ml-auto px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] font-black rounded uppercase">novo</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User Info + Logout */}
            <div className="p-4 border-t border-border-dark space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-background-dark/50 border border-border-dark">
                    <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-xs font-black text-primary">
                            {currentUser?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-white">{currentUser?.name}</p>
                        <p className="text-xs text-primary/70 truncate font-bold">{ROLE_LABELS[userRole]}</p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all text-xs font-bold"
                >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Sair da conta
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
