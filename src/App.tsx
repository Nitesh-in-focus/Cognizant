import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import { AppNavbar } from './components/layout/AppNavbar';
import { AppSidebar } from './components/layout/AppSidebar';
import { ScenarioRunner } from './components/layout/ScenarioRunner';
import { CommandSearch } from './components/common/CommandSearch';
import { ToastContainer } from './components/common/Toast';
import { SystemGuideModal } from './components/common/SystemGuideModal';
import { AiChatDrawer } from './components/common/AiChatDrawer';

// Pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Traceability from './pages/Traceability';
import PurchaseRequisitions from './pages/PurchaseRequisitions';
import PurchaseOrders from './pages/PurchaseOrders';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Shipments from './pages/Shipments';
import Trucks from './pages/Trucks';
import YardManagement from './pages/YardManagement';
import GoodsReceipts from './pages/GoodsReceipts';
import Invoices from './pages/Invoices';
import Exceptions from './pages/Exceptions';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import { QualityCheckPage } from './pages/QualityCheck';
import { SupplierPortal } from './pages/supplier/SupplierPortal';
import { DriverPortal } from './pages/driver/DriverPortal';

export const App: React.FC = () => {
  const location = useLocation();
  const { currentUser, role } = useApp();
  const [openScenarioRunner, setOpenScenarioRunner] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openGuide, setOpenGuide] = useState(() => {
    return !localStorage.getItem('supply_sync_guide_seen');
  });

  const handleCloseGuide = () => {
    localStorage.setItem('supply_sync_guide_seen', 'true');
    setOpenGuide(false);
  };

  // If on login route or unauthenticated, show Auth page
  if (location.pathname === '/login') {
    return (
      <>
        <Auth />
        <ToastContainer />
        <SystemGuideModal
          isOpen={openGuide}
          onClose={handleCloseGuide}
        />
      </>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 240px Deep Navy Grouped Sidebar */}
      <AppSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <AppNavbar
          onOpenScenarioRunner={() => setOpenScenarioRunner(true)}
          onOpenSearch={() => setOpenSearch(true)}
          onOpenGuide={() => setOpenGuide(true)}
        />

        {/* Scrollable Work Area */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard onOpenGuide={() => setOpenGuide(true)} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/supplier" element={<SupplierPortal />} />
            <Route path="/supplier/*" element={<SupplierPortal />} />
            <Route path="/driver" element={<DriverPortal />} />
            <Route path="/driver/*" element={<DriverPortal />} />
            <Route path="/quality" element={<QualityCheckPage />} />
            <Route path="/traceability" element={<Traceability />} />
            <Route path="/purchase-requisitions" element={<PurchaseRequisitions />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/trucks" element={<Trucks />} />
            <Route path="/yard" element={<YardManagement />} />
            <Route path="/grn" element={<GoodsReceipts />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/exceptions" element={<Exceptions />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global Interactive Elements */}
      <ScenarioRunner
        open={openScenarioRunner}
        onClose={() => setOpenScenarioRunner(false)}
      />

      <CommandSearch
        isOpen={openSearch}
        onClose={() => setOpenSearch(false)}
      />

      <SystemGuideModal
        isOpen={openGuide}
        onClose={handleCloseGuide}
      />

      <AiChatDrawer />

      <ToastContainer />
    </div>
  );
};

export default App;
