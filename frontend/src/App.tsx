import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { WhatsAppSetup } from './pages/WhatsAppSetup';
import { AgentConfiguration } from './pages/AgentConfiguration';
import { AgentAssignments } from './pages/AgentAssignments';
import { APIKeyManager } from './pages/APIKeyManager';
import { DatabaseSetup } from './pages/DatabaseSetup';
import { CompaniesManager } from './pages/CompaniesManager';
import { LogsMonitoring } from './pages/LogsMonitoring';
import { Settings } from './pages/Settings';
import EvolutionAPISettings from './pages/EvolutionAPISettings';
import { SystemPromptView } from './pages/SystemPromptView';
import { RAGDiagnosticView } from './pages/RAGDiagnosticView';
import { MetricsDashboard } from './pages/MetricsDashboard';
import { startAutoRefresh, stopAutoRefresh, useAppStore } from './store/appStore';
import { NotificationContainer } from './components/Notification';

// ============================================
// MAIN APP
// ============================================

export function App() {
  const updateWhatsApp = useAppStore((state) => state.updateWhatsApp);

  useEffect(() => {
    // Inicia auto-refresh ao montar com intervalo otimizado
    // Aumentado de 3s para 10s para reduzir carga e logs
    startAutoRefresh(10000);

    // Listener para atualizações de status do WhatsApp em tempo real
    const unsubscribe = window.api?.whatsapp?.onStatusUpdate?.((status) => {
      updateWhatsApp(status);
    });

    // Cleanup ao desmontar
    return () => {
      stopAutoRefresh();
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removida dependência de updateWhatsApp para evitar re-renders

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="whatsapp" element={<WhatsAppSetup />} />
            <Route path="evolution-api" element={<EvolutionAPISettings />} />
            <Route path="agents" element={<AgentConfiguration />} />
            <Route path="agent-assignments" element={<AgentAssignments />} />
            <Route path="api-keys" element={<APIKeyManager />} />
            <Route path="database" element={<DatabaseSetup />} />
            <Route path="companies" element={<CompaniesManager />} />
            <Route path="metrics" element={<MetricsDashboard />} />
            <Route path="logs" element={<LogsMonitoring />} />
            <Route path="settings" element={<Settings />} />
            <Route path="system-prompt" element={<SystemPromptView />} />
            <Route path="rag-diagnostic" element={<RAGDiagnosticView />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <NotificationContainer />
    </>
  );
}

