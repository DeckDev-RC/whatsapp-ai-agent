# 📝 Script de Atualização Manual

Script para atualizar o app manualmente na VPS

## Uso

```bash
./update.sh
```

## O que faz:

1. Faz pull das novas imagens do Docker Hub
2. Recria os containers
3. Limpa imagens antigas
4. Mostra o status

---

**Nota**: Para atualização automática, use GitHub Actions (faça push no repositório)
