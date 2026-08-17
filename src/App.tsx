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
import Warehouses from './pages/Warehouses';
import PoActionLandingPage from './pages/PoActionLandingPage';

export const App: React.FC = () => {
  const location = useLocation();
  const { currentUser, role } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openScenarioRunner, setOpenScenarioRunner] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openGuide, setOpenGuide] = useState(() => {
    return !localStorage.getItem('supply_sync_guide_seen');
  });

  const handleCloseGuide = () => {
    localStorage.setItem('supply_sync_guide_seen', 'true');
    setOpenGuide(false);
  };

  // If on PO Action landing route, allow public access for supplier email actions (Updates 12 Section 7)
  if (location.pathname === '/po-action') {
    return (
      <>
        <PoActionLandingPage />
        <ToastContainer />
      </>
    );
  }

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
      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <AppNavbar
          onOpenScenarioRunner={() => setOpenScenarioRunner(true)}
          onOpenSearch={() => setOpenSearch(true)}
          onOpenGuide={() => setOpenGuide(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />

        {/* Scrollable Work Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard onOpenGuide={() => setOpenGuide(true)} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* Direct Role Intelligence Dashboards (Spec Section 3) */}
            <Route path="/procurement/dashboard" element={<Dashboard defaultRoleView="PROCUREMENT_OFFICER" />} />
            <Route path="/finance/dashboard" element={<Dashboard defaultRoleView="FINANCE" />} />
            <Route path="/worker/dashboard" element={<Dashboard defaultRoleView="WORKER" />} />
            <Route path="/supplier/dashboard" element={<Dashboard defaultRoleView="SUPPLIER" />} />
            <Route path="/logistics/dashboard" element={<Dashboard defaultRoleView="LOGISTICS_GATE_POST" />} />
            <Route path="/receiving/dashboard" element={<Dashboard defaultRoleView="RECEIVING_QC" />} />

            {/* Worker Routes */}
            <Route path="/worker/pr" element={<PurchaseRequisitions />} />
            <Route path="/purchase-requisitions" element={<PurchaseRequisitions />} />

            {/* Procurement Routes */}
            <Route path="/procurement/pr" element={<PurchaseRequisitions />} />
            <Route path="/procurement/po" element={<PurchaseOrders />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/products" element={<Products />} />
            <Route path="/procurement/exceptions" element={<Exceptions />} />

            {/* Supplier Routes */}
            <Route path="/supplier" element={<SupplierPortal />} />
            <Route path="/supplier/pos" element={<SupplierPortal />} />
            <Route path="/supplier/shipments" element={<SupplierPortal />} />
            <Route path="/supplier/invoices" element={<SupplierPortal />} />
            <Route path="/supplier/*" element={<SupplierPortal />} />

            {/* Driver Routes */}
            <Route path="/driver" element={<DriverPortal />} />
            <Route path="/driver/dashboard" element={<DriverPortal />} />
            <Route path="/driver/history" element={<DriverPortal />} />
            <Route path="/driver/*" element={<DriverPortal />} />

            {/* Logistics & Yard Routes */}
            <Route path="/logistics/shipments" element={<Shipments />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/logistics/docks" element={<YardManagement />} />
            <Route path="/yard" element={<YardManagement />} />
            <Route path="/trucks" element={<Trucks />} />

            {/* Receiving & QC Routes */}
            <Route path="/receiving/grn" element={<GoodsReceipts />} />
            <Route path="/grn" element={<GoodsReceipts />} />
            <Route path="/receiving/qc" element={<QualityCheckPage />} />
            <Route path="/quality" element={<QualityCheckPage />} />

            {/* Finance & Settlements */}
            <Route path="/finance/invoices" element={<Invoices />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/finance/payments" element={<Payments />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/exceptions" element={<Exceptions />} />

            {/* Traceability & Common */}
            <Route path="/po-action" element={<PoActionLandingPage />} />
            <Route path="/traceability" element={<Traceability />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/chat" element={<Dashboard onOpenGuide={() => setOpenGuide(true)} />} />
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
