# Configuração do Banco de Dados

Este diretório contém as migrações SQL necessárias para configurar o banco de dados Supabase.

## Como Configurar

### 1. Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Crie um novo projeto
4. Aguarde a criação do projeto (pode levar alguns minutos)

### 2. Executar as Migrações

Acesse o **SQL Editor** no painel do Supabase e execute os arquivos SQL na ordem:

#### Migração 1: Estrutura Básica
```sql
-- Copie e cole todo o conteúdo de: migrations/001_initial_schema.sql
```

#### Migração 2: Tabelas de Dados
```sql
-- Copie e cole todo o conteúdo de: migrations/002_data_tables.sql
```

#### Migração 3: Contatos do WhatsApp
```sql
-- Copie e cole todo o conteúdo de: migrations/003_create_whatsapp_contacts_table.sql
```

### 3. Configurar no Aplicativo

1. Abra o aplicativo
2. Vá para a página **Database**
3. Preencha as informações:
   - **URL**: Encontre em Project Settings > API > Project URL
   - **Anon Key**: Encontre em Project Settings > API > Project API Keys > anon/public
   - **Service Role Key**: Encontre em Project Settings > API > Project API Keys > service_role
4. Clique em **Testar Conexão**
5. Se o teste passar, clique em **Salvar Configuração**

## Estrutura do Banco

### Tabelas Principais

- **tenants**: Empresas/clientes
- **whatsapp_numbers**: Números de WhatsApp
- **whatsapp_contacts**: Contatos sincronizados do WhatsApp ✨
- **conversations**: Histórico de conversas
- **orders**: Pedidos (exemplo)

### Como Funciona

1. **Conecte o WhatsApp**: Vá para a página "WhatsApp" e escaneie o QR Code
2. **Adicione API Keys**: Vá para "API Keys" e adicione suas chaves de IA
3. **Crie Agentes**: Vá para "Agentes" e configure seus assistentes
4. **Sincronize Contatos**: Vá para "Atribuições" e clique em "Sincronizar Contatos"
5. **Atribua Agentes**: Vincule cada agente aos contatos desejados
6. **Pronto!**: Os agentes responderão automaticamente as mensagens

## Segurança

⚠️ **Importante**: 
- Nunca compartilhe seu **Service Role Key**
- Use **Anon Key** apenas para operações básicas
- Configure as políticas RLS (Row Level Security) no Supabase para produção
