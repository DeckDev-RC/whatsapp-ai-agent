import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIG STORE - File-based Encrypted Storage (Web Version)
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
  private data: StoreSchema = {};
  private encryptionKey: Buffer;
  private configPath: string;

  constructor() {
    // Use environment variable or default path
    const configDir = process.env.CONFIG_DIR || '/app/config';
    this.configPath = path.join(configDir, 'config.json');

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Generate encryption key
    const keySeed = process.env.ENCRYPTION_SEED || 'whatsapp-ai-agent-encryption-default';
    this.encryptionKey = createHash('sha256').update(keySeed).digest();

    // Load existing config
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        this.data = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.data = {};
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving config:', error);
    }
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
    return this.data[key];
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.data[key] = value;
    this.save();
  }

  delete<K extends keyof StoreSchema>(key: K): void {
    delete this.data[key];
    this.save();
  }

  clear(): void {
    this.data = {};
    this.save();
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
      const aiConfig = this.data.ai || {};
      this.data.ai = {
        ...aiConfig,
        [provider]: {
          ...(aiConfig[provider as keyof typeof aiConfig] as object || {}),
          apiKey: encrypted,
        },
      };
      this.save();
    } catch (error) {
      console.error(`Erro ao criptografar API key para ${provider}:`, error);
      throw new Error('Erro ao salvar API key');
    }
  }

  getSecureKey(provider: string): string | undefined {
    const aiConfig = this.data.ai;
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
