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

# 1. Buildar Gateway (Nginx)
docker build -t whatsapp-gateway:latest ./nginx

# 2. Buildar Backend
docker build -t whatsapp-backend:latest ./backend

# 3. Buildar Frontend
docker build -t whatsapp-frontend:latest ./frontend
```

#### 2. Usar Web Editor no Portainer:

Cole este docker-compose atualizado (com Nginx Gateway):

```yaml
version: '3.8'

services:
  # Gateway Nginx (Entrada Principal)
  nginx:
    image: whatsapp-gateway:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.whatsapp-gateway.rule=Host(`savycore.com.br`)"
        - "traefik.http.routers.whatsapp-gateway.entrypoints=websecure"
        - "traefik.http.routers.whatsapp-gateway.tls.certresolver=letsencrypt"
        - "traefik.http.services.whatsapp-gateway.loadbalancer.server.port=80"
        - "traefik.docker.network=SavyCoreNet"
    networks:
      - SavyCoreNet
      - whatsapp-internal

  # Backend API
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
    networks:
      - whatsapp-internal

  # Frontend React
  frontend:
    image: whatsapp-frontend:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
    networks:
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
