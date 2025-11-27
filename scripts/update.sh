#!/bin/bash

echo "🔄 Atualizando WhatsApp AI Agent..."

# Navegar para o diretório
cd /opt/whatsapp-app || exit 1

# Pull das novas imagens
echo "📥 Baixando novas imagens..."
docker-compose pull

# Recriar containers
echo "🔨 Recriando containers..."
docker-compose up -d --force-recreate

# Limpar imagens antigas
echo "🧹 Limpando imagens antigas..."
docker image prune -f

# Mostrar status
echo "✅ Atualização concluída!"
echo ""
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "📝 Logs recentes:"
docker-compose logs --tail=20
