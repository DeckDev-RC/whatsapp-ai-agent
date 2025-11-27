import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Link,
  Key,
  Database,
  Building2,
  Activity,
  Settings as SettingsIcon,
  Server,
  FileText,
  BarChart3,
  Search,
} from 'lucide-react';
import { TitleBar } from './TitleBar';

// ============================================
// LAYOUT PRINCIPAL
// ============================================

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { name: 'Evolution API', href: '/evolution-api', icon: Server },
  { name: 'Agentes', href: '/agents', icon: Bot },
  { name: 'Atribuições', href: '/agent-assignments', icon: Link },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Database', href: '/database', icon: Database },
  { name: 'Empresas', href: '/companies', icon: Building2 },
  { name: 'Métricas', href: '/metrics', icon: BarChart3 },
  { name: 'Logs', href: '/logs', icon: Activity },
  { name: 'System Prompt', href: '/system-prompt', icon: FileText },
  { name: 'RAG Diagnóstico', href: '/rag-diagnostic', icon: Search },
  { name: 'Configurações', href: '/settings', icon: SettingsIcon },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Title Bar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 p-4 flex flex-col">
          {/* Logo */}
          <div className="mb-8 px-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
              WhatsApp AI
            </h1>
            <p className="text-text-secondary text-sm mt-1">Agent Manager</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200
                  ${isActive
                      ? 'bg-accent text-white shadow-lg shadow-accent/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                    }
                `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10">
            <div className="glass-card p-3 text-xs text-text-secondary">
              <p>v1.0.0</p>
              <p className="mt-1">© 2025 WhatsApp AI</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

