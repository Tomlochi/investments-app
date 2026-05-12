import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PortfolioSummary } from './components/portfolio/PortfolioSummary';
import { HoldingsList } from './components/portfolio/HoldingsList';
import { AddHoldingModal } from './components/portfolio/AddHoldingModal';
import { EditHoldingModal } from './components/portfolio/EditHoldingModal';
import { AllocationChart } from './components/portfolio/AllocationChart';
import { PortfolioInsights } from './components/insights/PortfolioInsights';
import { StockDetailPage } from './pages/StockDetailPage';
import type { RootState } from './store';

function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section id="dashboard" className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <PortfolioSummary />
        <AllocationChart />
      </section>

      <section id="holdings" className="space-y-4">
        <HoldingsList />
      </section>

      <section id="insights" className="space-y-6">
        <PortfolioInsights />
      </section>
    </div>
  );
}

function App() {
  const theme = useSelector((state: RootState) => state.ui.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock/:symbol" element={<StockDetailPage />} />
      </Routes>

      <AddHoldingModal />
      <EditHoldingModal />
    </AppShell>
  );
}

export default App;
