
import React, { useState, useEffect } from 'react';
import { OrdersProvider } from './context/OrdersContext';
import { ReservationProvider } from './context/ReservationContext';
import { TableProvider } from './context/TableContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CMVProvider } from './context/CMVContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LogisticsKanban from './views/driver/LogisticsKanban';
import FinanceDashboard from './views/admin/FinanceDashboard';
import KitchenKDS from './views/shared/KitchenKDS';
import TableMap from './views/waiter/TableMap';
import InventoryControl from './views/shared/InventoryControl';
import MenuView from './views/shared/MenuView';
import PDVView from './views/payment/PDVView';
import PrinterSettings from './views/shared/PrinterSettings';
import CashierView from './views/payment/CashierView';
import TeamManagement from './views/admin/TeamManagement';
import ReservationView from './views/waiter/ReservationView';
import DashboardView from './views/admin/DashboardView';
import CMVView from './views/shared/CMVView';
import WaiterView from './views/waiter/WaiterView';
import LoginView from './views/shared/LoginView';
import DeliveryAppView from './views/delivery/DeliveryAppView';
import DriverAppView from './views/driver/DriverAppView';
import AdminDashboardView from './views/admin/AdminDashboardView';

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'kitchen') {
      setActiveView('cozinha');
    } else if (currentUser?.role === 'cashier') {
      setActiveView('caixa');
    } else if (currentUser?.role === 'waiter') {
      setActiveView('garcom');
    }
  }, [currentUser?.id]);

  if (!currentUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'admin_dashboard': return <AdminDashboardView />;
      case 'dashboard': return <DashboardView />;
      case 'pdv': return <PDVView />;
      case 'caixa': return <CashierView />;
      case 'logistica': return <LogisticsKanban />;
      case 'financeiro': return <FinanceDashboard />;
      case 'cozinha': return <KitchenKDS />;
      case 'mesas': return <TableMap />;
      case 'reservas': return <ReservationView />;
      case 'estoque': return <InventoryControl />;
      case 'cardapio': return <MenuView />;
      case 'impressao': return <PrinterSettings />;
      case 'equipe': return <TeamManagement />;
      case 'cmv': return <CMVView />;
      case 'garcom': return <WaiterView />;
      case 'delivery_app': return <DeliveryAppView />;
      case 'driver_app': return <DriverAppView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-background-dark text-slate-100 overflow-hidden font-sans">
      <Sidebar 
        activeView={activeView} 
        onNavigate={(view) => { setActiveView(view); setIsMobileMenuOpen(false); }} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          currentView={activeView} 
          onMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrdersProvider>
        <ReservationProvider>
          <TableProvider>
            <CMVProvider>
              <AppContent />
            </CMVProvider>
          </TableProvider>
        </ReservationProvider>
      </OrdersProvider>
    </AuthProvider>
  );
};

export default App;
