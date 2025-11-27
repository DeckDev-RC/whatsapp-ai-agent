#!/bin/bash

# Script para corrigir imports do frontend
# Execute na VPS: bash fix_frontend_imports.sh

cd /opt/whatsapp-app/frontend/src

# Corrigir imports de ../../shared para ../shared
find pages -type f -name "*.tsx" -exec sed -i "s|from '../../shared/types'|from '../shared/types'|g" {} \;
find pages -type f -name "*.tsx" -exec sed -i "s|from '../../shared/constants'|from '../shared/constants'|g" {} \;
find store -type f -name "*.ts" -exec sed -i "s|from '../../shared/types'|from '../shared/types'|g" {} \;

# Remover referências ao preload
find pages -type f -name "*.tsx" -exec sed -i "/\/\/\/ <reference types=\"..\/..\/preload\/index.d.ts\" \/>/d" {} \;

echo "✅ Imports corrigidos!"
echo "Agora execute: cd /opt/whatsapp-app && docker build -t whatsapp-frontend:latest ./frontend"
