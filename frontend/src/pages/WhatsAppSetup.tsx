import { useEffect, useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { QrCode, Phone, Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { showNotification } from '../components/Notification';

// ============================================
// WHATSAPP SETUP PAGE
// ============================================

export function WhatsAppSetup() {
  const { whatsapp, loadWhatsAppStatus } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Carrega status uma vez ao montar
    // O auto-refresh do App já mantém atualizado
    loadWhatsAppStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vazio - carrega apenas uma vez

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await window.api.whatsapp.generateQR();
      if (response.success) {
        // Atualiza status imediatamente
        await loadWhatsAppStatus();
        showNotification('success', 'QR Code gerado! Escaneie com o WhatsApp');
      } else {
        showNotification('error', `Erro ao conectar: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      showNotification('error', 'Erro ao conectar ao WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar do WhatsApp?')) return;

    setLoading(true);
    try {
      const response = await window.api.whatsapp.disconnect();
      if (response.success) {
        // Atualiza status imediatamente
        await loadWhatsAppStatus();
        showNotification('success', 'WhatsApp desconectado com sucesso');
      } else {
        showNotification('error', `Erro ao desconectar: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      showNotification('error', 'Erro ao desconectar do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadWhatsAppStatus();
  };

  const handleClearAuth = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá remover todas as credenciais do WhatsApp.\n\nVocê precisará escanear o QR Code novamente para conectar.\n\nDeseja continuar?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await window.api.whatsapp.clearAuth();
      if (response.success) {
        // Atualiza status imediatamente
        await loadWhatsAppStatus();
        showNotification('success', 'Credenciais do WhatsApp removidas com sucesso');
      } else {
        showNotification('error', `Erro ao limpar credenciais: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error clearing auth:', error);
      showNotification('error', 'Erro ao limpar credenciais do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          Conexão WhatsApp
        </h1>
        <p className="text-text-secondary">
          Configure e gerencie sua conexão com o WhatsApp
        </p>
      </div>

      {/* Connection Status */}
      <GlassCard>
        <GlassCardHeader title="Status da Conexão" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              whatsapp?.isConnected ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <Phone className={`w-8 h-8 ${
                whatsapp?.isConnected ? 'text-emerald-400' : 'text-red-400'
              }`} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                {whatsapp?.isConnected ? 'Conectado' : 'Desconectado'}
              </h3>
              <StatusBadge
                status={whatsapp?.isConnected ? 'success' : 'error'}
                animate={whatsapp?.isConnected}
              />
              {whatsapp?.statusMessage && (
                <p className="text-xs text-text-secondary mt-2">
                  {whatsapp.statusMessage}
                </p>
              )}
            </div>
          </div>

          {whatsapp?.phoneNumber && (
            <div className="text-right">
              <p className="text-sm text-text-secondary mb-1">Número conectado:</p>
              <p className="text-lg font-mono text-accent">
                +{whatsapp.phoneNumber}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar status"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
          
          {!whatsapp?.isConnected ? (
            <button
              onClick={handleConnect}
              disabled={loading || whatsapp?.status === 'qr'}
              className="btn-primary flex items-center gap-2"
            >
              <Power className="w-5 h-5" />
              {loading ? 'Conectando...' : 'Conectar'}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="btn-danger flex items-center gap-2"
            >
              <PowerOff className="w-5 h-5" />
              Desconectar
            </button>
          )}

          <button
            onClick={handleClearAuth}
            disabled={loading}
            className="btn-secondary border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            title="Limpar credenciais do WhatsApp"
          >
            <Trash2 className="w-5 h-5" />
            Limpar Credenciais
          </button>
        </div>
      </GlassCard>

      {/* QR Code */}
      {whatsapp?.qrCode && (
        <GlassCard>
          <GlassCardHeader
            title="Escaneie o QR Code"
            description="Abra o WhatsApp no seu celular e escaneie o código abaixo"
          />

          <div className="bg-white p-8 rounded-2xl w-fit mx-auto">
            <img
              src={whatsapp.qrCode}
              alt="QR Code"
              className="w-64 h-64"
            />
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex gap-3">
              <QrCode className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">
                  Como escanear
                </h4>
                <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
                  <li>Selecione <strong>Aparelhos conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                  <li>Aponte a câmera para este código</li>
                </ol>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Info Card */}
      {whatsapp?.isConnected && (
        <GlassCard>
          <GlassCardHeader
            title="Informações"
            description="Sobre sua conexão WhatsApp"
          />

          <div className="space-y-4 text-sm">
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-text-secondary">Status:</span>
              <span className="text-text-primary font-medium">Conectado e funcionando</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-text-secondary">Número:</span>
              <span className="text-text-primary font-mono">+{whatsapp.phoneNumber}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-text-secondary">Modo:</span>
              <span className="text-text-primary font-medium">Multi-device</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Clear Auth Info Card */}
      <GlassCard>
        <GlassCardHeader
          title="Gerenciamento de Credenciais"
          description="Limpe as credenciais quando necessário"
        />

        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex gap-3">
              <Trash2 className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">
                  Quando limpar credenciais?
                </h4>
                <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
                  <li>Se receber erro 401 (não autorizado)</li>
                  <li>Se receber erro 403 (proibido)</li>
                  <li>Se receber múltiplos erros 405 (rate limiting)</li>
                  <li>Se quiser conectar com outra conta WhatsApp</li>
                  <li>Se a conexão estiver instável ou travada</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex gap-3">
              <QrCode className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">
                  O que acontece ao limpar?
                </h4>
                <p className="text-sm text-text-secondary">
                  Todas as credenciais de autenticação serão removidas. Você precisará escanear o QR Code novamente para conectar ao WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

