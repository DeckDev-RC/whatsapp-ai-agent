# 🔧 Guia Rápido - Corrigir Rede do Traefik

## Problema: "network traefik_public not found"

O Portainer não consegue criar a stack porque a rede do Traefik tem outro nome.

## Solução:

### 1. Descobrir o nome da rede do Traefik

No terminal SSH da VPS:

```bash
# Ver todas as redes
docker network ls

# Ver qual rede o Traefik está usando
docker inspect $(docker ps -q --filter "name=traefik") | grep -A 10 "Networks"
```

### 2. Atualizar o docker-compose.yml

Edite o arquivo e troque `traefik_public` pelo nome correto da rede.

**Opções comuns:**
- `traefik-public`
- `traefik_default`
- `proxy`
- `web`

### 3. Fazer push da correção

```bash
git add docker-compose.yml
git commit -m "fix: corrigir nome da rede traefik"
git push origin main
```

### 4. Recriar stack no Portainer

1. **Stacks** → Deletar a stack com erro
2. **Add stack** novamente
3. **Git Repository** → Vai pegar a versão corrigida

---

## Alternativa Rápida (Web Editor):

Se quiser testar rápido sem Git:

1. **Stacks** → **Add stack**
2. **Web editor**
3. Cole o docker-compose.yml **com o nome correto da rede**
4. **Deploy**

---

**Depois me diga qual é o nome da rede que eu atualizo o arquivo!**
