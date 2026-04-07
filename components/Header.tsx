import React from 'react';

interface HeaderProps {
    currentView: string;
    onMenuToggle: () => void;
}

const getPageTitle = (view: string) => {
    switch (view) {
        case 'pdv': return 'Ponto de Venda';
        case 'caixa': return 'Fluxo de Caixa';
        case 'mesas': return 'Gestão de Mesas';
        case 'reservas': return 'Reservas & Fila';
        case 'cozinha': return 'KDS Cozinha';
        case 'logistica': return 'Logística de Entregas';
        case 'estoque': return 'Controle de Estoque';
        case 'cardapio': return 'Gestão de Cardápio';
        case 'financeiro': return 'Dashboard Financeiro';
        case 'equipe': return 'Gestão de Equipe';
        case 'servidor': return 'Servidor & Impressoras';
        default: return 'SushiFlow';
    }
};

const Header: React.FC<HeaderProps> = ({ currentView, onMenuToggle }) => {
    return (
        <header className="h-16 bg-card-dark border-b border-border-dark flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
            <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={onMenuToggle}
                  className="p-2 md:hidden text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 border border-border-dark flex items-center justify-center"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h2 className="text-lg font-bold text-white tracking-tight hidden sm:block">
                    {getPageTitle(currentView)}
                </h2>
                <div className="h-4 w-px bg-border-dark mx-2 hidden sm:block" />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span>Sistema Operacional</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <span className="absolute top-0 right-0 w-2 h-2 bg-danger rounded-full border-2 border-card-dark"></span>
                    <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                        <span className="material-symbols-outlined text-xl">notifications</span>
                    </button>
                </div>

                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-dark border border-border-dark hover:border-primary/50 transition-colors group">
                    <span className="w-2 h-2 rounded-full bg-gray-500 group-hover:bg-primary transition-colors"></span>
                    <span className="text-xs font-medium text-gray-400 group-hover:text-white">v1.0.0</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
