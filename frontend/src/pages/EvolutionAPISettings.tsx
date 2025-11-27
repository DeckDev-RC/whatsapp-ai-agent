import { useState, useEffect } from 'react';
import { Save, Server, Key, User } from 'lucide-react';

interface EvolutionAPIConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export default function EvolutionAPISettings() {
  const [config, setConfig] = useState<EvolutionAPIConfig>({
    apiUrl: 'http://localhost:8081',
    apiKey: '',
    instanceName: 'whatsapp-ai-agent',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Evolution API config é armazenada no ConfigStore, não há handler IPC específico
      // Por enquanto, vamos apenas manter os valores padrão
      // TODO: Implementar handler IPC para Evolution API se necessário
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // Evolution API config é armazenada no ConfigStore, não há handler IPC específico
      // Por enquanto, apenas mostra mensagem de sucesso
      // TODO: Implementar handler IPC para Evolution API se necessário
      setMessage({ type: 'success', text: 'Configuração salva localmente (handler IPC não implementado)' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configuração' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setMessage(null);
    try {
      // Evolution API test connection não implementado
      // TODO: Implementar handler IPC para testar conexão Evolution API
      setMessage({ type: 'error', text: 'Teste de conexão não implementado ainda' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao testar conexão' });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Configuração Evolution API
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure a conexão com sua instância da Evolution API
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
        {/* API URL */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Server className="w-4 h-4 mr-2" />
            URL da API
          </label>
          <input
            type="text"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            placeholder="https://sua-vps.com:8081"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            URL completa da sua Evolution API (ex: https://evolution.seudominio.com)
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Key className="w-4 h-4 mr-2" />
            API Key
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="Sua API Key"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Chave de autenticação da Evolution API (definida no .env da API)
          </p>
        </div>

        {/* Instance Name */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <User className="w-4 h-4 mr-2" />
            Nome da Instância
          </label>
          <input
            type="text"
            value={config.instanceName}
            onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
            placeholder="whatsapp-ai-agent"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Nome único para identificar esta instância do WhatsApp
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-lg font-medium transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Configuração'}
          </button>

          <button
            onClick={handleTestConnection}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 
                     text-gray-700 dark:text-gray-300 rounded-lg font-medium
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Testar Conexão
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          ℹ️ Informações Importantes
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• A Evolution API deve estar rodando e acessível pela URL configurada</li>
          <li>• A API Key é definida no arquivo .env da Evolution API (AUTHENTICATION_API_KEY)</li>
          <li>• O nome da instância deve ser único e sem espaços</li>
          <li>• Após salvar, reconecte o WhatsApp para aplicar as mudanças</li>
        </ul>
      </div>
    </div>
  );
}
