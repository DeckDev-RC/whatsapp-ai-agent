# 🚀 Guia de Deploy no Portainer com Traefik

Deploy do WhatsApp AI Agent no Portainer (savycore.com.br) usando **Traefik** para SSL automático

---

## 📋 Pré-requisitos

- ✅ VPS com Docker e Docker Compose instalados
- ✅ Portainer instalado e rodando
- ✅ **Traefik já configurado** (você já tem!)
- ✅ Domínio savycore.com.br apontando para o IP da VPS
- ✅ Acesso SSH à VPS

---

## 🔧 Passo 1: Preparar o Código

### 1.1 Criar Repositório no GitHub

1. Acesse https://github.com
2. Crie novo repositório: `whatsapp-ai-agent`
3. **Público** ou **Privado** (tanto faz)

### 1.2 Fazer Push do Código

No seu computador:

```bash
cd c:\Users\User\Desktop\agentwhatsa

# Inicializar git
git init
git add .
git commit -m "feat: web app dockerizado"

# Conectar ao GitHub
git remote add origin https://github.com/SEU_USUARIO/whatsapp-ai-agent.git
git branch -M main
git push -u origin main
```

---

## 🖥️ Passo 2: Configurar a VPS

### 2.1 Conectar na VPS

```bash
ssh root@31.97.243.107
```

### 2.2 Clonar o Repositório

```bash
# Criar diretório
mkdir -p /opt/whatsapp-app
cd /opt

# Clonar repositório
git clone https://github.com/SEU_USUARIO/whatsapp-ai-agent.git whatsapp-app
cd whatsapp-app
```

### 2.3 Criar docker-compose com Traefik

Editar o `docker-compose.yml`:

```bash
nano docker-compose.yml
```

Cole este conteúdo (adaptado para Traefik):

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: whatsapp-backend
    volumes:
      - ./auth_info_baileys:/app/auth_info_baileys
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    networks:
      - traefik_public
      - whatsapp-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whatsapp-backend.rule=Host(`savycore.com.br`) && PathPrefix(`/api`, `/socket.io`)"
      - "traefik.http.routers.whatsapp-backend.entrypoints=websecure"
      - "traefik.http.routers.whatsapp-backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.whatsapp-backend.loadbalancer.server.port=3000"

  frontend:
    build: ./frontend
    container_name: whatsapp-frontend
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - traefik_public
      - whatsapp-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whatsapp-frontend.rule=Host(`savycore.com.br`)"
      - "traefik.http.routers.whatsapp-frontend.entrypoints=websecure"
      - "traefik.http.routers.whatsapp-frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.whatsapp-frontend.loadbalancer.server.port=80"
      # Redirect HTTP to HTTPS
      - "traefik.http.routers.whatsapp-frontend-http.rule=Host(`savycore.com.br`)"
      - "traefik.http.routers.whatsapp-frontend-http.entrypoints=web"
      - "traefik.http.routers.whatsapp-frontend-http.middlewares=redirect-to-https"
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"

networks:
  traefik_public:
    external: true
  whatsapp-internal:
    driver: bridge
```

Salve (Ctrl+O, Enter, Ctrl+X)

**Importante:** Ajuste o nome da rede do Traefik se for diferente. Para verificar:
```bash
docker network ls | grep traefik
```

Se a rede tiver outro nome (ex: `traefik-public`), ajuste no docker-compose.

---

## 🐳 Passo 3: Deploy no Portainer

### 3.1 Acessar Portainer

1. **Acesse**: `http://31.97.243.107:9000` (ou sua porta do Portainer)
2. **Login** no Portainer
3. **Selecione** seu environment (primary)

### 3.2 Criar Stack

1. **Menu lateral** → **Stacks**
2. **Add stack**
3. **Name**: `whatsapp-ai-agent`
4. **Build method**: Selecione **Git Repository**

5. **Repository URL**: `https://github.com/SEU_USUARIO/whatsapp-ai-agent`
6. **Repository reference**: `refs/heads/main`
7. **Compose path**: `docker-compose.yml`

**OU** se preferir usar **Web editor**:
- Selecione **Web editor**
- Cole o conteúdo do `docker-compose.yml` (já está no projeto)

8. **Environment variables** (opcional): Deixe vazio

9. **Deploy the stack**

### 3.3 Aguardar Build

- Portainer vai clonar o repo
- Vai buildar as imagens (2-5 minutos)
- Vai subir os containers

### 3.4 Verificar Containers

1. **Menu lateral** → **Containers**
2. Você deve ver:
   - ✅ whatsapp-backend (running)
   - ✅ whatsapp-frontend (running)

3. **Clique** em cada container para ver logs se necessário

---

## ✅ Passo 4: Verificar e Testar

### 4.1 Aguardar SSL (1-2 minutos)

O Traefik vai gerar o certificado SSL automaticamente. Aguarde 1-2 minutos.

### 4.2 Testar Acesso

1. Abra: `https://savycore.com.br`
2. Você deve ver a interface do app! 🎉
3. O SSL deve estar funcionando (cadeado verde)

### 4.3 Verificar Backend

```bash
curl https://savycore.com.br/api/health
# Deve retornar: {"status":"ok",...}
```

### 4.4 Ver Logs

```bash
cd /opt/whatsapp-app
docker-compose logs -f backend
```

---

## 🔄 Passo 5: Atualizar o App

### Quando Fizer Mudanças no Código:

```bash
# 1. No seu PC - fazer push
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 2. Na VPS - atualizar
ssh root@31.97.243.107
cd /opt/whatsapp-app
git pull origin main
docker-compose build
docker-compose up -d --force-recreate

# 3. Limpar imagens antigas
docker image prune -f
```

### Script Automático

Criar arquivo `update.sh`:

```bash
nano update.sh
```

Cole:
```bash
#!/bin/bash
cd /opt/whatsapp-app
git pull origin main
docker-compose build
docker-compose up -d --force-recreate
docker image prune -f
echo "✅ Atualização concluída!"
```

Dar permissão:
```bash
chmod +x update.sh
```

Usar:
```bash
./update.sh
```

---

## 🛠️ Troubleshooting

### Containers não iniciam

```bash
# Ver logs
docker-compose logs backend
docker-compose logs frontend

# Recriar
docker-compose down
docker-compose build
docker-compose up -d
```

### SSL não funciona

```bash
# Verificar logs do Traefik
docker logs traefik_traefik.1.vkywdjtcqjotxqy2bzw1ilvzw

# Aguardar 2-3 minutos para o Traefik gerar o certificado
```

### Erro "network not found"

```bash
# Listar redes
docker network ls

# Ajustar nome da rede no docker-compose.yml
# Trocar "traefik_public" pelo nome correto
```

### WhatsApp não conecta

```bash
# Limpar sessão
rm -rf auth_info_baileys/*
docker-compose restart backend
```

### Rebuild completo

```bash
cd /opt/whatsapp-app
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Comandos Úteis

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Reiniciar tudo
docker-compose restart

# Parar tudo
docker-compose down

# Iniciar tudo
docker-compose up -d

# Ver uso de recursos
docker stats
```

---

## 🎉 Pronto!

Seu app está rodando em: **https://savycore.com.br**

### Vantagens do Traefik:

- ✅ SSL automático (Let's Encrypt)
- ✅ Renovação automática de certificados
- ✅ Sem necessidade de certbot
- ✅ Mais simples e moderno
- ✅ Dashboard do Traefik para monitorar

### Checklist Final:

- ✅ Código no GitHub
- ✅ Clonado na VPS
- ✅ Imagens buildadas
- ✅ Containers rodando
- ✅ SSL funcionando (Traefik)
- ✅ App acessível via HTTPS

---

## 📞 Precisa de Ajuda?

1. Verifique os logs: `docker-compose logs -f`
2. Verifique o status: `docker-compose ps`
3. Verifique o Traefik: `docker logs [ID_DO_TRAEFIK]`
4. Tente rebuild: `docker-compose build --no-cache`

---

**Desenvolvido com ❤️ | Traefik + Docker + React + Express**
