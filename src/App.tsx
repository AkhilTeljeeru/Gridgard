/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { GridProvider, useGrid } from './context/GridContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { InvestigationPipelineBar } from './components/workflow/InvestigationPipelineBar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastContainer } from './components/ui/ToastContainer';

const OverviewView = lazy(() =>
  import('./views/OverviewView').then((m) => ({ default: m.OverviewView }))
);
const DataIntegrityView = lazy(() =>
  import('./views/DataIntegrityView').then((m) => ({ default: m.DataIntegrityView }))
);
const EventReconstructionView = lazy(() =>
  import('./views/EventReconstructionView').then((m) => ({ default: m.EventReconstructionView }))
);
const KnowledgeGraphView = lazy(() =>
  import('./views/KnowledgeGraphView').then((m) => ({ default: m.KnowledgeGraphView }))
);
const GridMapView = lazy(() =>
  import('./views/GridMapView').then((m) => ({ default: m.GridMapView }))
);
const SimulatorView = lazy(() =>
  import('./views/SimulatorView').then((m) => ({ default: m.SimulatorView }))
);
const FieldOperationsView = lazy(() =>
  import('./views/FieldOperationsView').then((m) => ({ default: m.FieldOperationsView }))
);
const AlertCenterView = lazy(() =>
  import('./views/AlertCenterView').then((m) => ({ default: m.AlertCenterView }))
);
const ReportsAndHealthView = lazy(() =>
  import('./views/ReportsAndHealthView').then((m) => ({ default: m.ReportsAndHealthView }))
);
const SystemAdminView = lazy(() =>
  import('./views/SystemAdminView').then((m) => ({ default: m.SystemAdminView }))
);

const ViewLoadingFallback: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading module">
    <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        />
      ))}
    </div>
    <div className="h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
  </div>
);

const MainLayout: React.FC = () => {
  const { activeView } = useGrid();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
      case 'executive':
        return <OverviewView />;
      case 'integrity':
        return <DataIntegrityView />;
      case 'events':
        return <EventReconstructionView />;
      case 'graph':
      case 'twin':
        return <KnowledgeGraphView />;
      case 'map':
        return <GridMapView />;
      case 'simulator':
      case 'decisions':
        return <SimulatorView />;
      case 'field':
        return <FieldOperationsView />;
      case 'alerts':
        return <AlertCenterView />;
      case 'reports':
        return <ReportsAndHealthView />;
      case 'admin':
      case 'audit':
        return <SystemAdminView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="flex flex-col h-dvh w-full max-w-full overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar onOpenMobileMenu={() => setMobileSidebarOpen(true)} />
          <InvestigationPipelineBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
            <Suspense fallback={<ViewLoadingFallback />}>{renderActiveView()}</Suspense>
          </main>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <GridProvider>
        <MainLayout />
      </GridProvider>
    </ErrorBoundary>
  );
}

