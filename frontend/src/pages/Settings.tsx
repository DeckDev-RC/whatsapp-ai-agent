import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { Settings as SettingsIcon, Info, FileText, ExternalLink } from 'lucide-react';

// ============================================
// SETTINGS PAGE
// ============================================

export function Settings() {
  const handleOpenDatabaseMigrations = () => {
    // Abrir pasta de migrations (implementar conforme necessário)
    alert('Migrations disponíveis em: database/migrations/');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          Configurações
        </h1>
        <p className="text-text-secondary">
          Configurações gerais do sistema
        </p>
      </div>

      {/* About */}
      <GlassCard>
        <GlassCardHeader title="Sobre o Sistema" />

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <SettingsIcon className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-1">
                WhatsApp AI Agent Manager
              </h3>
              <p className="text-text-secondary mb-2">Versão 1.0.0</p>
              <p className="text-sm text-text-secondary">
                Sistema para gerenciar agentes de IA no WhatsApp com suporte a múltiplos
                modelos de IA e isolamento de dados por empresa.
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stack Tecnológica */}
      <GlassCard>
        <GlassCardHeader title="Stack Tecnológica" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="font-semibold text-text-primary mb-2">Frontend</h4>
            <ul className="space-y-1 text-text-secondary">
              <li>• Electron 28</li>
              <li>• React 18</li>
              <li>• TypeScript 5</li>
              <li>• Tailwind CSS 3</li>
              <li>• Lucide Icons</li>
            </ul>
          </div>

          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="font-semibold text-text-primary mb-2">Backend</h4>
            <ul className="space-y-1 text-text-secondary">
              <li>• Baileys (WhatsApp)</li>
              <li>• Supabase (Database)</li>
              <li>• OpenAI API</li>
              <li>• Anthropic Claude API</li>
              <li>• Google Gemini API</li>
            </ul>
          </div>
        </div>
      </GlassCard>

      {/* Database Setup */}
      <GlassCard>
        <GlassCardHeader title="Database Setup" />

        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Para usar o sistema, você precisa executar as migrations do banco de dados
            no seu projeto Supabase.
          </p>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-2">
                  Scripts SQL Necessários
                </h4>
                <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
                  <li>001_create_whatsapp_numbers.sql</li>
                  <li>002_create_conversations.sql</li>
                </ol>

                <button
                  onClick={handleOpenDatabaseMigrations}
                  className="mt-3 text-sm text-accent hover:underline flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" />
                  Ver scripts de migration
                </button>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Recursos */}
      <GlassCard>
        <GlassCardHeader title="Recursos & Links" />

        <div className="space-y-3">
          <a
            href="https://github.com/whiskeysockets/baileys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <span className="text-sm text-text-primary">Baileys Documentation</span>
            <ExternalLink className="w-4 h-4 text-text-secondary" />
          </a>

          <a
            href="https://supabase.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <span className="text-sm text-text-primary">Supabase Documentation</span>
            <ExternalLink className="w-4 h-4 text-text-secondary" />
          </a>

          <a
            href="https://platform.openai.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <span className="text-sm text-text-primary">OpenAI Documentation</span>
            <ExternalLink className="w-4 h-4 text-text-secondary" />
          </a>

          <a
            href="https://docs.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <span className="text-sm text-text-primary">Claude Documentation</span>
            <ExternalLink className="w-4 h-4 text-text-secondary" />
          </a>
        </div>
      </GlassCard>

      {/* Credits */}
      <GlassCard>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">
            Desenvolvido com ❤️ usando Electron + React + TypeScript
          </p>
          <p className="text-text-secondary text-xs mt-2">
            © 2025 WhatsApp AI Agent Manager
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

