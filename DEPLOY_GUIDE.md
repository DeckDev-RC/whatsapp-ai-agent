# 🚀 Guia de Deploy no Portainer - SIMPLIFICADO

Deploy do WhatsApp AI Agent no Portainer (savycore.com.br) **SEM Docker Hub**

---

## 📋 Pré-requisitos

- ✅ VPS com Docker e Docker Compose instalados
- ✅ Portainer instalado e rodando
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
ssh usuario@IP_DA_VPS
```

### 2.2 Clonar o Repositório

```bash
# Criar diretório
sudo mkdir -p /opt/whatsapp-app
cd /opt

# Clonar repositório
git clone https://github.com/SEU_USUARIO/whatsapp-ai-agent.git whatsapp-app
cd whatsapp-app

# Dar permissões
sudo chown -R $USER:$USER /opt/whatsapp-app
```

### 2.3 Configurar SSL (Let's Encrypt)

```bash
# Instalar certbot
sudo apt update
sudo apt install certbot -y

# Gerar certificado
sudo certbot certonly --standalone -d savycore.com.br -d www.savycore.com.br

# Criar pasta SSL
mkdir -p nginx/ssl

# Copiar certificados
sudo cp /etc/letsencrypt/live/savycore.com.br/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/savycore.com.br/privkey.pem nginx/ssl/

# Dar permissões
sudo chmod 644 nginx/ssl/*.pem
```

### 2.4 Renovação Automática SSL

```bash
# Editar crontab
sudo crontab -e

# Adicionar esta linha (escolha editor nano se perguntar):
0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/savycore.com.br/*.pem /opt/whatsapp-app/nginx/ssl/ && cd /opt/whatsapp-app && docker-compose restart nginx
```

Salve e feche (Ctrl+O, Enter, Ctrl+X)

---

## 🐳 Passo 3: Deploy no Portainer

### 3.1 Buildar as Imagens

Na VPS, ainda em `/opt/whatsapp-app`:

```bash
# Buildar backend e frontend
docker-compose build

# Isso vai demorar 2-5 minutos
```

### 3.2 Criar Stack no Portainer

1. **Acesse Portainer**: `http://IP_DA_VPS:9000` (ou sua porta)
2. **Login** no Portainer
3. **Stacks** → **Add stack**
4. **Name**: `whatsapp-ai-agent`
5. **Build method**: Selecione **Upload**
6. **Upload**: Clique e selecione o arquivo `docker-compose.yml` da pasta do projeto
7. Ou copie e cole o conteúdo abaixo:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: whatsapp-backend
    ports:
      - "3000:3000"
    volumes:
      - ./auth_info_baileys:/app/auth_info_baileys
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    networks:
      - whatsapp-network

  frontend:
    build: ./frontend
    container_name: whatsapp-frontend
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - whatsapp-network

  nginx:
    image: nginx:alpine
    container_name: whatsapp-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - whatsapp-network

networks:
  whatsapp-network:
    driver: bridge
```

8. **Environment variables** (opcional): Deixe vazio
9. **Deploy the stack**

### 3.3 Aguardar Deploy

- Portainer vai usar as imagens que você buildou
- Aguarde 1-2 minutos
- Verifique se todos os containers estão **running**

---

## ✅ Passo 4: Verificar e Testar

### 4.1 Verificar Containers

No Portainer:
- **Containers** → Você deve ver:
  - ✅ whatsapp-backend (running)
  - ✅ whatsapp-frontend (running)
  - ✅ whatsapp-nginx (running)

### 4.2 Testar Acesso

1. Abra: `https://savycore.com.br`
2. Você deve ver a interface do app! 🎉

### 4.3 Verificar Backend

```bash
curl https://savycore.com.br/api/health
# Deve retornar: {"status":"ok",...}
```

### 4.4 Ver Logs (se necessário)

No Portainer:
- **Containers** → Clique em `whatsapp-backend`
- **Logs** → Veja se está rodando sem erros

Ou via SSH:
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
ssh usuario@IP_DA_VPS
cd /opt/whatsapp-app
git pull origin main
docker-compose build
docker-compose up -d --force-recreate

# 3. Limpar imagens antigas
docker image prune -f
```

### Script Automático (Opcional)

Criar arquivo `update.sh` na VPS:

```bash
cd /opt/whatsapp-app
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
# Verificar certificados
ls -la nginx/ssl/

# Renovar
sudo certbot renew --force-renewal
sudo cp /etc/letsencrypt/live/savycore.com.br/*.pem nginx/ssl/
docker-compose restart nginx
```

### WhatsApp não conecta

```bash
# Limpar sessão
rm -rf auth_info_baileys/*
docker-compose restart backend
```

### Porta 80/443 ocupada

```bash
# Ver o que está usando
sudo lsof -i :80
sudo lsof -i :443

# Parar (ex: apache)
sudo systemctl stop apache2
sudo systemctl disable apache2
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

### Checklist Final:

- ✅ Código no GitHub
- ✅ Clonado na VPS
- ✅ SSL configurado
- ✅ Imagens buildadas
- ✅ Stack criada no Portainer
- ✅ Containers rodando
- ✅ App acessível via HTTPS

---

## 📞 Precisa de Ajuda?

1. Verifique os logs: `docker-compose logs -f`
2. Verifique o status: `docker-compose ps`
3. Tente rebuild: `docker-compose build --no-cache`
4. Reinicie: `docker-compose restart`

---

**Desenvolvido com ❤️ | Simples e Direto ao Ponto**
