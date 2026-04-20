import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Inbound from './pages/Inbound';
import InternalTransfer from './pages/InternalTransfer';
import StockOpname from './pages/StockOpname';
import Outbound from './pages/Outbound';
import Categories from './pages/Categories';
import Warehouses from './pages/Warehouses';
import Locations from './pages/Locations';
import Settings from './pages/Settings';
import StockLedger from './pages/StockLedger';
import { SettingsProvider } from './context/SettingsContext';

// Temporary placeholder components for phase 2 initial verification
const Placeholder = ({ title }: { title: string }) => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold">{title}</h1>
    <div className="wms-card min-h-[400px] flex items-center justify-center text-slate-400">
      {title} Module under construction...
    </div>
  </div>
);

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="inbound" element={<Inbound />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="transfer" element={<InternalTransfer />} />
            <Route path="opname" element={<StockOpname />} />
            <Route path="outbound" element={<Outbound />} />
            <Route path="categories" element={<Categories />} />
            <Route path="warehouses" element={<Warehouses />} />
            <Route path="locations" element={<Locations />} />
            <Route path="history" element={<StockLedger />} />
            <Route path="settings" element={<Settings />} />
            <Route path="returns" element={<Placeholder title="Stock Returns" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}
