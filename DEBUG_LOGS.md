# 📋 Guia de Logs e Debug - WhatsApp AI Agent

## 🔍 Como Ver os Logs em Tempo Real

### 1. Logs do Backend (Onde está a lógica do agente)

```bash
# Ver logs em tempo real
docker service logs -f whatsapp-ai-agent_backend

# Ver últimas 100 linhas
docker service logs --tail 100 whatsapp-ai-agent_backend

# Filtrar por palavra-chave
docker service logs -f whatsapp-ai-agent_backend | grep "mensagem"
docker service logs -f whatsapp-ai-agent_backend | grep "ERROR"
```

### 2. Logs do Frontend

```bash
docker service logs -f whatsapp-ai-agent_frontend
```

### 3. Logs do Nginx Gateway

```bash
docker service logs -f whatsapp-ai-agent_nginx
```

### 4. Ver Todos os Logs Juntos

```bash
docker service logs -f whatsapp-ai-agent_backend whatsapp-ai-agent_frontend whatsapp-ai-agent_nginx
```

---

## 🐛 Debug: Por que o Agente Não Responde?

### Checklist de Diagnóstico

Execute estes comandos na ordem para identificar o problema:

#### 1. Verificar se o Backend está rodando

```bash
docker service ps whatsapp-ai-agent_backend
```

**O que procurar:** Status deve ser "Running"

#### 2. Ver logs do Backend em tempo real

```bash
docker service logs -f --tail 50 whatsapp-ai-agent_backend
```

**O que procurar:**
- `✅ WhatsApp connected` - WhatsApp conectado
- `[MessageProcessor]` - Processamento de mensagens
- `[AIManager]` - Chamadas para a IA
- `ERROR` ou `ERRO` - Erros críticos

#### 3. Verificar conexão com Banco de Dados

```bash
docker service logs whatsapp-ai-agent_backend | grep -i "database\|supabase"
```

**O que procurar:**
- `Database connected` ou similar
- Erros de conexão

#### 4. Verificar se a API Key está ativa

```bash
docker service logs whatsapp-ai-agent_backend | grep -i "api.*key\|openai\|claude\|gemini"
```

**O que procurar:**
- `API key loaded` ou similar
- `Invalid API key` - Chave inválida
- `Rate limit` - Limite de uso atingido

#### 5. Verificar se o agente está atribuído

```bash
docker service logs whatsapp-ai-agent_backend | grep -i "agent.*assign"
```

**O que procurar:**
- Mensagens sobre atribuição de agentes a contatos

---

## 📊 Comandos Úteis de Debug

### Ver status de todos os serviços

```bash
docker service ls
```

### Ver detalhes de um serviço específico

```bash
docker service inspect whatsapp-ai-agent_backend --pretty
```

### Reiniciar um serviço

```bash
docker service update --force whatsapp-ai-agent_backend
```

### Ver uso de recursos

```bash
docker stats
```

### Entrar no container do backend (para debug avançado)

```bash
# Descobrir o ID do container
docker ps | grep backend

# Entrar no container (substitua CONTAINER_ID)
docker exec -it CONTAINER_ID sh
```

---

## 🔴 Erros Comuns e Soluções

### Erro: "API key not found"

**Solução:** Verifique se você adicionou a API key no painel e se ela está ativa.

```bash
# Ver logs relacionados a API keys
docker service logs whatsapp-ai-agent_backend | grep -i "api.*key"
```

### Erro: "Database connection failed"

**Solução:** Verifique as credenciais do Supabase.

```bash
# Ver logs de conexão com banco
docker service logs whatsapp-ai-agent_backend | grep -i "database\|supabase"
```

### Erro: "Agent not assigned"

**Solução:** Certifique-se de que você atribuiu um agente ao contato no painel.

```bash
# Ver logs de atribuição
docker service logs whatsapp-ai-agent_backend | grep -i "assign"
```

### Mensagem recebida mas agente não responde

**Possíveis causas:**
1. Agente não está atribuído ao contato
2. API key inválida ou sem créditos
3. Erro na conexão com o provedor de IA
4. Erro no processamento da mensagem

**Como diagnosticar:**

```bash
# Ver todo o fluxo de uma mensagem
docker service logs -f whatsapp-ai-agent_backend | grep -E "mensagem|message|process|agent|ai"
```

---

## 📝 Exemplo de Log Saudável

Quando tudo está funcionando, você deve ver logs assim:

```
[WhatsAppManager] ✅ WhatsApp connected
[DatabaseManager] ✅ Database connected
[AIManager] ✅ OpenAI API key loaded
[MessageProcessor] 📨 New message from +5511999999999
[AgentManager] 🤖 Agent assigned: Atendente Virtual
[AIManager] 🧠 Calling OpenAI API...
[AIManager] ✅ Response received (150 tokens)
[WhatsAppManager] 📤 Sending response to +5511999999999
```

---

## 💡 Dica Pro

Para monitorar continuamente e ser alertado de erros:

```bash
# Monitorar apenas erros
docker service logs -f whatsapp-ai-agent_backend 2>&1 | grep -i "error\|erro\|fail"
```

---

## 🆘 Ainda com problemas?

Se após seguir este guia o problema persistir, colete estas informações:

```bash
# 1. Status dos serviços
docker service ls > debug_services.txt

# 2. Logs do backend (últimas 200 linhas)
docker service logs --tail 200 whatsapp-ai-agent_backend > debug_backend.txt

# 3. Configuração do serviço
docker service inspect whatsapp-ai-agent_backend > debug_config.txt
```

E compartilhe os arquivos `debug_*.txt` para análise.
