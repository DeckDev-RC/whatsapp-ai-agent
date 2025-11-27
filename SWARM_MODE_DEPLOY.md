# 🚨 IMPORTANTE: Portainer Swarm Mode

Seu Portainer está em **Swarm Mode**, que tem limitações:

## ❌ O que NÃO funciona em Swarm:
- `build:` - Não pode buildar imagens
- `container_name:` - Não suportado
- `restart:` - Deve usar `deploy.restart_policy`

## ✅ Solução: Buildar Manualmente

Você precisa buildar as imagens **manualmente na VPS** e depois usar no Portainer.

### Passo a Passo:

#### 1. Na VPS via SSH:

```bash
cd /opt/whatsapp-app

# Buildar backend
docker build -t whatsapp-backend:latest ./backend

# Buildar frontend  
docker build -t whatsapp-frontend:latest ./frontend
```

#### 2. Usar Web Editor no Portainer:

Cole este docker-compose:

```yaml
version: '3.8'

services:
  backend:
    image: whatsapp-backend:latest
    volumes:
      - backend-auth:/app/auth_info_baileys
      - backend-uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - PORT=3000
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.whatsapp-backend.rule=Host(`savycore.com.br`) && PathPrefix(`/api`, `/socket.io`)"
        - "traefik.http.routers.whatsapp-backend.entrypoints=websecure"
        - "traefik.http.routers.whatsapp-backend.tls.certresolver=letsencrypt"
        - "traefik.http.services.whatsapp-backend.loadbalancer.server.port=3000"
        - "traefik.docker.network=SavyCoreNet"
    networks:
      - SavyCoreNet
      - whatsapp-internal

  frontend:
    image: whatsapp-frontend:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.whatsapp-frontend.rule=Host(`savycore.com.br`)"
        - "traefik.http.routers.whatsapp-frontend.entrypoints=websecure"
        - "traefik.http.routers.whatsapp-frontend.tls.certresolver=letsencrypt"
        - "traefik.http.services.whatsapp-frontend.loadbalancer.server.port=80"
        - "traefik.docker.network=SavyCoreNet"
        - "traefik.http.routers.whatsapp-frontend-http.rule=Host(`savycore.com.br`)"
        - "traefik.http.routers.whatsapp-frontend-http.entrypoints=web"
        - "traefik.http.routers.whatsapp-frontend-http.middlewares=redirect-to-https"
        - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
    networks:
      - SavyCoreNet
      - whatsapp-internal

networks:
  SavyCoreNet:
    external: true
  whatsapp-internal:
    driver: overlay

volumes:
  backend-auth:
  backend-uploads:
```

#### 3. Deploy no Portainer

Agora vai funcionar porque as imagens já existem localmente!

## 🛠️ Troubleshooting

### Erro: "The network ... cannot be used with services"

Se você ver um erro como:
`The network whatsapp-ai-agent_whatsapp-internal cannot be used with services. Only networks scoped to the swarm can be used`

Isso significa que existe uma rede antiga criada incorretamente (provavelmente por um `docker-compose up` manual).

**Solução:**
Execute no terminal da VPS:
```bash
docker network rm whatsapp-ai-agent_whatsapp-internal
```
E tente o deploy novamente.
