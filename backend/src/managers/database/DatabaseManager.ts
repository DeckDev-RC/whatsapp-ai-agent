import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { configStore } from '../store/ConfigStore';
import type { SupabaseConfig, Tenant, WhatsAppNumber, Conversation, Order } from '../../shared/types';

// ============================================
// DATABASE MANAGER - Supabase
// ============================================

export class DatabaseManager {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  // ===== Config Management =====
  private loadConfig(): void {
    const config = configStore.get('supabase');
    if (config) {
      this.config = {
        ...config,
        isConnected: false,
      };
      this.connect();
    }
  }

  async saveConfig(config: SupabaseConfig): Promise<void> {
    configStore.set('supabase', {
      url: config.url,
      anonKey: config.anonKey,
      serviceRoleKey: config.serviceRoleKey,
    });
    this.config = config;
    await this.connect();
  }

  getConfig(): SupabaseConfig | null {
    return this.config;
  }

  // ===== Connection =====
  private async connect(): Promise<void> {
    if (!this.config) return;

    try {
      // Usar serviceRoleKey se disponível (bypass RLS), senão usar anonKey
      const key = this.config.serviceRoleKey || this.config.anonKey;
      this.client = createClient(this.config.url, key, {
        auth: {
          persistSession: false,
        },
      });

      // Teste simples de conexão
      const { error } = await this.client.from('tenants').select('count').limit(1);

      if (!error) {
        this.config.isConnected = true;
        console.log('[DatabaseManager] ✅ Conectado ao Supabase');
      } else {
        this.config.isConnected = false;
        console.error('[DatabaseManager] ❌ Erro de conexão Supabase:', error);
      }
    } catch (error) {
      this.config.isConnected = false;
      console.error('[DatabaseManager] ❌ Erro ao conectar Supabase:', error);
    }
  }

  async testConnection(config: SupabaseConfig): Promise<boolean> {
    try {
      const testClient = createClient(config.url, config.anonKey);
      const { error } = await testClient.from('tenants').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.config?.isConnected ?? false;
  }

  // ===== Tenants =====
  async getAllTenants(): Promise<Tenant[]> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('tenants')
      .insert([tenant])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTenant(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('tenants')
      .update({ ...tenant, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTenant(id: string): Promise<void> {
    if (!this.client) throw new Error('Database not connected');

    const { error } = await this.client
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ===== WhatsApp Numbers =====
  async getAllWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('whatsapp_numbers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getWhatsAppNumberByPhone(phone: string): Promise<WhatsAppNumber | null> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('whatsapp_numbers')
      .select('*')
      .eq('phone_number', phone)
      .eq('is_active', true)
      .single();

    if (error) return null;
    return data;
  }

  async createWhatsAppNumber(number: Partial<WhatsAppNumber>): Promise<WhatsAppNumber> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('whatsapp_numbers')
      .insert([{ ...number, is_active: true }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateWhatsAppNumber(id: string, number: Partial<WhatsAppNumber>): Promise<WhatsAppNumber> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('whatsapp_numbers')
      .update({ ...number, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteWhatsAppNumber(id: string): Promise<void> {
    if (!this.client) throw new Error('Database not connected');

    const { error } = await this.client
      .from('whatsapp_numbers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ===== Orders =====
  async getOrdersByTenant(tenantId: string, limit?: number): Promise<Order[]> {
    if (!this.client) throw new Error('Database not connected');

    // Se limit especificado, buscar apenas esse número
    if (limit) {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }

    // Buscar TODOS os pedidos usando paginação
    let allOrders: Order[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allOrders.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`[DatabaseManager] ✅ Total de pedidos do tenant ${tenantId}: ${allOrders.length}`);
    return allOrders;
  }

  async getAllOrders(limit?: number): Promise<Order[]> {
    if (!this.client) throw new Error('Database not connected');

    // Se limit não especificado, buscar TODOS os pedidos usando paginação
    if (limit) {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }

    // Buscar todos usando paginação (Supabase limita a 1000 por query)
    let allOrders: Order[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allOrders.push(...data);
        hasMore = data.length === pageSize;
        page++;
        console.log(`[DatabaseManager] Buscando pedidos: página ${page}, total até agora: ${allOrders.length}`);
      } else {
        hasMore = false;
      }
    }

    console.log(`[DatabaseManager] ✅ Total de pedidos encontrados: ${allOrders.length}`);
    return allOrders;
  }

  async searchOrders(query: string): Promise<Order[]> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .or(`id.ilike.%${query}%,external_order_id.ilike.%${query}%,status.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  }

  async getOrderByExternalId(externalOrderId: string): Promise<Order | null> {
    if (!this.client) throw new Error('Database not connected');

    console.log(`[DatabaseManager] Buscando pedido por external_order_id: "${externalOrderId}"`);

    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('external_order_id', externalOrderId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum resultado encontrado
        console.log(`[DatabaseManager] Pedido não encontrado com external_order_id: "${externalOrderId}"`);
        return null;
      }
      console.error(`[DatabaseManager] Erro ao buscar pedido:`, error);
      throw error;
    }

    console.log(`[DatabaseManager] ✅ Pedido encontrado:`, {
      id: data.id,
      external_order_id: data.external_order_id,
      status: data.status,
      total: data.total_amount,
    });

    return data;
  }

  async getOrdersByStatus(status: string, tenantId?: string, limit?: number): Promise<Order[]> {
    if (!this.client) throw new Error('Database not connected');

    console.log(`[DatabaseManager] Buscando pedidos com status: "${status}" (tenantId: ${tenantId || 'todos'})`);

    try {
      // Normalizar status para lowercase para busca
      const normalizedStatus = status.toLowerCase().trim();
      console.log(`[DatabaseManager] Status normalizado: "${normalizedStatus}"`);

      // Se limit especificado, buscar apenas esse número
      if (limit) {
        let query = this.client
          .from('orders')
          .select('*')
          .eq('status', normalizedStatus)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      // Buscar TODOS usando paginação
      let allOrders: Order[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = this.client
          .from('orders')
          .select('*')
          .eq('status', normalizedStatus)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allOrders.push(...data);
          hasMore = data.length === pageSize;
          page++;
          console.log(`[DatabaseManager] Buscando pedidos com status "${normalizedStatus}": página ${page}, total até agora: ${allOrders.length}`);
        } else {
          hasMore = false;
        }
      }

      console.log(`[DatabaseManager] ✅ Total de pedidos com status "${normalizedStatus}": ${allOrders.length}`);
      return allOrders;
    } catch (error) {
      console.error(`[DatabaseManager] ❌ Erro completo ao buscar pedidos:`, error);
      throw error;
    }
  }

  // ===== Conversations =====
  async saveConversation(conversation: Partial<Conversation>): Promise<Conversation> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('conversations')
      .insert([conversation])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getAllConversations(limit = 100): Promise<Conversation[]> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getConversationsByTenant(tenantId: string, limit = 100): Promise<Conversation[]> {
    if (!this.client) throw new Error('Database not connected');

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Database not connected');
    }
    return this.client;
  }
}

export const databaseManager = new DatabaseManager();

