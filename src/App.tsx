/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GridProvider, useGrid } from './context/GridContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { InvestigationPipelineBar } from './components/workflow/InvestigationPipelineBar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastContainer } from './components/ui/ToastContainer';
import { OverviewView } from './views/OverviewView';
import { DataIntegrityView } from './views/DataIntegrityView';
import { EventReconstructionView } from './views/EventReconstructionView';
import { KnowledgeGraphView } from './views/KnowledgeGraphView';
import { GridMapView } from './views/GridMapView';
import { SimulatorView } from './views/SimulatorView';
import { FieldOperationsView } from './views/FieldOperationsView';
import { AlertCenterView } from './views/AlertCenterView';
import { ReportsAndHealthView } from './views/ReportsAndHealthView';
import { SystemAdminView } from './views/SystemAdminView';

const MainLayout: React.FC = () => {
  const { activeView } = useGrid();

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <InvestigationPipelineBar />
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {renderActiveView()}
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
