import { useEffect, useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { Database, Check, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { showNotification } from '../components/Notification';

// ============================================
// DATABASE SETUP PAGE
// ============================================

export function DatabaseSetup() {
  const { supabase, loadSupabaseConfig } = useAppStore();
  const [localConfig, setLocalConfig] = useState({
    url: '',
    anonKey: '',
    serviceRoleKey: '',
    isConnected: false,
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSupabaseConfig();
  }, [loadSupabaseConfig]);

  useEffect(() => {
    if (supabase) {
      setLocalConfig({
        url: supabase.url || '',
        anonKey: supabase.anonKey || '',
        serviceRoleKey: supabase.serviceRoleKey || '',
        isConnected: supabase.isConnected || false,
      });
    }
  }, [supabase]);

  const handleTestConnection = async () => {
    if (!localConfig.url || !localConfig.anonKey) {
      showNotification('warning', 'Por favor, preencha URL e Anon Key');
      return;
    }

    setTesting(true);
    try {
      const response = await window.api.supabase.testConnection(localConfig);
      if (response.success && response.data) {
        showNotification('success', 'Conexão com Supabase bem-sucedida! ✅');
        // Atualiza o store
        await loadSupabaseConfig();
      } else {
        showNotification('error', `Erro na conexão: ${response.error || 'Falha ao conectar'}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      showNotification('error', 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!localConfig.url || !localConfig.anonKey) {
      showNotification('warning', 'Por favor, preencha URL e Anon Key');
      return;
    }

    setSaving(true);
    try {
      const response = await window.api.supabase.saveConfig(localConfig);
      if (response.success) {
        // Atualiza o store
        await loadSupabaseConfig();
        showNotification('success', 'Configuração do Supabase salva com sucesso! ✅');
      } else {
        showNotification('error', `Erro ao salvar: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Save config error:', error);
      showNotification('error', 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    await loadSupabaseConfig();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          Configuração do Banco de Dados
        </h1>
        <p className="text-text-secondary">
          Configure a conexão com o Supabase
        </p>
      </div>

      {/* Status Card */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              supabase?.isConnected ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <Database className={`w-8 h-8 ${
                supabase?.isConnected ? 'text-emerald-400' : 'text-red-400'
              }`} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                {supabase?.isConnected ? 'Conectado ao Supabase' : supabase ? 'Desconectado' : 'Não configurado'}
              </h3>
              <StatusBadge
                status={supabase?.isConnected ? 'success' : 'error'}
                animate={supabase?.isConnected}
              />
              {supabase && (
                <p className="text-xs text-text-secondary mt-2">
                  {supabase.isConnected ? 'Conexão ativa' : 'Configure as credenciais abaixo'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar status"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
        </div>
      </GlassCard>

      {/* Configuration Form */}
      <GlassCard>
        <GlassCardHeader
          title="Credenciais do Supabase"
          description="Insira as credenciais do seu projeto Supabase"
        />

        <div className="space-y-4">
          {/* Status Info */}
          {supabase && (supabase.url || supabase.anonKey) && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <p className="text-sm text-emerald-400">
                ✅ Configuração salva {supabase.isConnected && '• Conectado'}
              </p>
            </div>
          )}

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project URL {supabase?.url && <span className="text-emerald-400">✓</span>}
            </label>
            <input
              type="url"
              value={localConfig.url}
              onChange={(e) => setLocalConfig({ ...localConfig, url: e.target.value })}
              placeholder={supabase?.url ? supabase.url : "https://xxxxx.supabase.co"}
              className="glass-input font-mono text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">
              Encontre em: Project Settings → API → Project URL
            </p>
          </div>

          {/* Anon Key */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Anon Key (Public) {supabase?.anonKey && <span className="text-emerald-400">✓</span>}
            </label>
            <input
              type="password"
              value={localConfig.anonKey}
              onChange={(e) => setLocalConfig({ ...localConfig, anonKey: e.target.value })}
              placeholder={supabase?.anonKey ? 'Anon Key configurada (alterar para atualizar)' : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
              className="glass-input font-mono text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">
              Encontre em: Project Settings → API → Project API keys → anon/public
            </p>
            {supabase?.anonKey && (
              <p className="text-xs text-text-secondary mt-1">
                Anon Key já configurada. Altere apenas se quiser atualizar.
              </p>
            )}
          </div>

          {/* Service Role Key */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Service Role Key (Optional - Para operações administrativas)
              {supabase?.serviceRoleKey && <span className="text-emerald-400">✓</span>}
            </label>
            <input
              type="password"
              value={localConfig.serviceRoleKey || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, serviceRoleKey: e.target.value })}
              placeholder={supabase?.serviceRoleKey ? 'Service Role Key configurada (alterar para atualizar)' : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
              className="glass-input font-mono text-sm"
            />
            <p className="text-xs text-text-secondary mt-1">
              Encontre em: Project Settings → API → Project API keys → service_role
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testing || !localConfig.url || !localConfig.anonKey}
              className="btn-secondary flex items-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Testar Conexão
                </>
              )}
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !localConfig.url || !localConfig.anonKey}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Salvar Configuração
                </>
              )}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Help Card */}
      <GlassCard>
        <GlassCardHeader title="Como obter as credenciais?" />

        <div className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-3 text-text-secondary">
            <li>
              Acesse o{' '}
              <a
                href="https://app.supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Supabase Dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Selecione seu projeto (ou crie um novo)</li>
            <li>Vá em <strong className="text-text-primary">Settings</strong> → <strong className="text-text-primary">API</strong></li>
            <li>Copie a <strong className="text-text-primary">Project URL</strong></li>
            <li>Copie a <strong className="text-text-primary">anon/public key</strong></li>
            <li>(Opcional) Copie a <strong className="text-text-primary">service_role key</strong></li>
          </ol>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mt-4">
            <p className="text-yellow-400 font-medium mb-1">⚠️ Importante</p>
            <p className="text-text-secondary">
              Não compartilhe suas chaves de API. Elas serão armazenadas de forma criptografada localmente.
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-blue-400 font-medium mb-1">📋 Migrations</p>
            <p className="text-text-secondary">
              Após conectar, execute os scripts SQL em <code className="text-accent">database/migrations/</code> no seu projeto Supabase para criar as tabelas necessárias.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

