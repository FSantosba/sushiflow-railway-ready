import React from 'react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const menuItems = [
    { id: 'admin_dashboard', label: 'Painel Admin', icon: 'monitoring' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'garcom', label: 'App Garçom', icon: 'restaurant' },
    { id: 'pdv', label: 'PDV', icon: 'point_of_sale' },
    { id: 'delivery_app', label: 'Delivery App', icon: 'smartphone' },
    { id: 'delivery_manager', label: 'Delivery Manager', icon: 'storefront' },
    { id: 'caixa', label: 'Caixa', icon: 'payments' },
    { id: 'mesas', label: 'Mesas', icon: 'table_restaurant' },
    { id: 'reservas', label: 'Reservas', icon: 'event_seat' },
    { id: 'cozinha', label: 'Painel KDS', icon: 'skillet' },
    { id: 'logistica', label: 'Log\u00edstica', icon: 'local_shipping' },
    { id: 'driver_app', label: 'App do Motoboy', icon: 'two_wheeler' },
    { id: 'estoque', label: 'Estoque', icon: 'inventory_2' },
    { id: 'compras', label: 'Compras', icon: 'shopping_cart' },
    { id: 'cardapio', label: 'Card\u00e1pio', icon: 'restaurant_menu' },
    { id: 'cmv', label: 'Gest\u00e3o CMV', icon: 'price_check' },
    { id: 'financeiro', label: 'Financeiro', icon: 'bar_chart' },
    { id: 'usuarios', label: 'Controle de Acessos', icon: 'manage_accounts' },
    { id: 'servidor', label: 'Servidor & Sys', icon: 'dns' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose }) => {
    const { currentUser, logout } = useAuth();
    const userRole = currentUser?.role || 'manager';
    
    const visibleItems = menuItems.filter(item => {
        if (!currentUser?.allowedScreens) return false;
        if (currentUser.allowedScreens.includes('all')) return true;
        return currentUser.allowedScreens.includes(item.id);
    });

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}
            
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card-dark border-r border-border-dark flex flex-col h-full transform transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 flex items-center justify-between md:justify-start gap-3 border-b border-border-dark">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-md">sushi_roll</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex-1">
                    SushiFlow
                </h1>
                
                <button 
                  onClick={onClose}
                  className="md:hidden p-1 text-gray-400 hover:text-white rounded-md flex items-center justify-center bg-white/5"
                >
                    <span className="material-symbols-outlined text-xl">close</span>
                </button>
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
        </>
    );
};

export default Sidebar;
