import Store from 'electron-store';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { app } from 'electron';

// ============================================
// CONFIG STORE - Encrypted Storage
// ============================================

interface StoreSchema {
  supabase?: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  ai?: {
    openai?: unknown;
    claude?: unknown;
    gemini?: unknown;
    openrouter?: unknown;
  };
  whatsapp?: {
    sessionData?: string;
  };
  evolution_api?: {
    apiUrl: string;
    apiKey: string;
    instanceName: string;
  };
  agents?: unknown[];
  agent_assignments?: unknown[];
  api_keys?: unknown[];
}

class ConfigStore {
  private store: Store<StoreSchema>;
  private encryptionKey: Buffer;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'whatsapp-ai-agent-config',
      encryptionKey: 'whatsapp-ai-agent-2024', // Chave básica para o store
    });

    // Gerar chave de criptografia persistente baseada no userData path
    // Isso garante que a mesma chave seja usada sempre para o mesmo usuário
    const userDataPath = app.getPath('userData');
    const keySeed = `whatsapp-ai-agent-encryption-${userDataPath}`;
    this.encryptionKey = createHash('sha256').update(keySeed).digest();
  }

  // ===== Encryption =====
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = parts.join(':');
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ===== Generic Methods =====
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined {
    return this.store.get(key);
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.store.set(key, value);
  }

  delete<K extends keyof StoreSchema>(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // ===== Secure API Key Storage =====
  setSecureKey(provider: string, apiKey: string): void {
    if (!apiKey || !apiKey.trim()) {
      console.warn(`Tentativa de salvar API key vazia para ${provider}`);
      return;
    }

    try {
      const cleanApiKey = apiKey.trim();
      const encrypted = this.encrypt(cleanApiKey);
      const aiConfig = this.store.get('ai') || {};
      this.store.set('ai', {
        ...aiConfig,
        [provider]: {
          ...(aiConfig[provider as keyof typeof aiConfig] as object || {}),
          apiKey: encrypted,
        },
      });
    } catch (error) {
      console.error(`Erro ao criptografar API key para ${provider}:`, error);
      throw new Error('Erro ao salvar API key');
    }
  }

  getSecureKey(provider: string): string | undefined {
    const aiConfig = this.store.get('ai');
    if (!aiConfig) return undefined;

    const providerConfig = aiConfig[provider as keyof typeof aiConfig] as { apiKey?: string };
    if (!providerConfig?.apiKey) return undefined;

    try {
      const decrypted = this.decrypt(providerConfig.apiKey);
      return decrypted.trim();
    } catch (error) {
      console.error(`Erro ao descriptografar API key para ${provider}:`, error);
      return undefined;
    }
  }
}

export const configStore = new ConfigStore();

