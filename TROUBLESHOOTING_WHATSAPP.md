# 🔧 Troubleshooting: WhatsApp Não Conecta / Não Limpa Credenciais

## Problema: Erro 500 ao Conectar ou Limpar Credenciais

### Sintomas:
- ❌ Botão "Conectar" retorna erro 500
- ❌ Botão "Limpar Credenciais" retorna erro 500
- ⚠️ QR Code não é gerado
- ⚠️ Status permanece "Desconectado"

---

## 🔍 Diagnóstico Rápido

### 1. Verificar Logs do Backend

```bash
# Ver logs em tempo real
docker service logs -f whatsapp-ai-agent_backend

# Ver últimas 100 linhas
docker service logs --tail 100 whatsapp-ai-agent_backend

# Filtrar apenas erros
docker service logs whatsapp-ai-agent_backend | grep -i "error\|erro"
```

**O que procurar:**
- `EBUSY: resource busy or locked, rmdir '/app/auth_info_baileys'` → Diretório bloqueado
- `ENOENT: no such file or directory` → Diretório não existe
- `Permission denied` → Problema de permissões

---

## 🛠️ Soluções

### Solução 1: Reiniciar o Serviço do Backend

```bash
docker service update --force whatsapp-ai-agent_backend
```

Aguarde 30 segundos e tente conectar novamente.

---

### Solução 2: Verificar e Recriar Volume

```bash
# 1. Listar volumes
docker volume ls | grep backend-auth

# 2. Verificar se o volume existe
docker volume inspect whatsapp-ai-agent_backend-auth

# 3. Se não existir, o Docker Swarm criará automaticamente
# Mas você pode forçar a recriação do serviço:
docker service update --force whatsapp-ai-agent_backend
```

---

### Solução 3: Entrar no Container e Verificar Permissões

```bash
# 1. Descobrir o ID do container
docker ps | grep backend

# 2. Entrar no container (substitua CONTAINER_ID)
docker exec -it CONTAINER_ID sh

# 3. Dentro do container, verificar diretório
ls -la /app/auth_info_baileys

# 4. Se necessário, recriar diretório
rm -rf /app/auth_info_baileys
mkdir -p /app/auth_info_baileys
chmod 755 /app/auth_info_baileys

# 5. Sair do container
exit

# 6. Reiniciar serviço
docker service update --force whatsapp-ai-agent_backend
```

---

### Solução 4: Limpar Completamente e Reconectar

Se nada funcionar, faça uma limpeza completa:

```bash
# 1. Parar o serviço
docker service scale whatsapp-ai-agent_backend=0

# 2. Aguardar 10 segundos
sleep 10

# 3. Remover volume antigo (CUIDADO: Isso apaga as credenciais!)
docker volume rm whatsapp-ai-agent_backend-auth

# 4. Recriar volume
docker volume create whatsapp-ai-agent_backend-auth

# 5. Reiniciar serviço
docker service scale whatsapp-ai-agent_backend=1

# 6. Aguardar 30 segundos
sleep 30

# 7. Verificar logs
docker service logs -f whatsapp-ai-agent_backend
```

Agora tente conectar novamente no painel.

---

## 🔄 Após Novo Deploy

Quando você faz um novo deploy (`docker service update`), o volume **NÃO** é apagado automaticamente. Mas se você:

- Deletou a stack no Portainer
- Executou `docker stack rm`
- Removeu o volume manualmente

Então as credenciais foram perdidas e você precisa reconectar.

### Como Reconectar Após Deploy:

1. Acesse o painel em `https://savycore.com.br`
2. Vá em "WhatsApp"
3. Clique em "Conectar"
4. Escaneie o QR Code com seu WhatsApp

**Importante:** O QR Code expira em 60 segundos. Se não aparecer, verifique os logs.

---

## 📊 Verificar Status do Serviço

```bash
# Status geral
docker service ls

# Detalhes do backend
docker service ps whatsapp-ai-agent_backend

# Inspecionar configuração
docker service inspect whatsapp-ai-agent_backend --pretty
```

**O que verificar:**
- `REPLICAS`: Deve ser `1/1` (não `0/1`)
- `IMAGE`: Deve ser a versão mais recente
- `PORTS`: Não deve ter portas expostas (Nginx faz o proxy)

---

## 🐛 Debug Avançado

### Ver Código de Erro Completo

```bash
# Logs com timestamps
docker service logs --timestamps whatsapp-ai-agent_backend

# Logs de um container específico
docker logs CONTAINER_ID
```

### Testar Endpoint Diretamente

```bash
# Dentro da rede interna do Docker
docker exec -it NGINX_CONTAINER_ID sh
wget -O- http://backend:3000/api/health
wget -O- http://backend:3000/api/whatsapp/status
```

---

## ✅ Checklist de Verificação

Antes de pedir ajuda, verifique:

- [ ] Backend está rodando (`docker service ps whatsapp-ai-agent_backend`)
- [ ] Logs não mostram erros críticos
- [ ] Volume `backend-auth` existe (`docker volume ls`)
- [ ] Nginx está roteando corretamente (`docker service logs whatsapp-ai-agent_nginx`)
- [ ] Você esperou pelo menos 30 segundos após o deploy
- [ ] Você tentou atualizar a página (Ctrl+F5)

---

## 🆘 Ainda com Problemas?

Se após todas as soluções o problema persistir:

1. Colete os logs:
   ```bash
   docker service logs --tail 200 whatsapp-ai-agent_backend > backend_logs.txt
   docker service ps whatsapp-ai-agent_backend > backend_status.txt
   docker volume inspect whatsapp-ai-agent_backend-auth > volume_info.txt
   ```

2. Compartilhe os arquivos `*.txt` para análise detalhada.

---

## 💡 Dica Pro

Para evitar perder credenciais em futuros deploys:

```bash
# Fazer backup do volume antes de deploy
docker run --rm -v whatsapp-ai-agent_backend-auth:/data -v $(pwd):/backup alpine tar czf /backup/whatsapp-auth-backup.tar.gz -C /data .

# Restaurar backup após deploy
docker run --rm -v whatsapp-ai-agent_backend-auth:/data -v $(pwd):/backup alpine tar xzf /backup/whatsapp-auth-backup.tar.gz -C /data
```
