# 🔧 Frontend Build Errors - Quick Fix Guide

## Erros Identificados

### 1. window.api (50+ ocorrências)
Todos os arquivos ainda usam `window.api` do Electron. Precisa substituir por chamadas ao API client.

### 2. Imports incorretos (9 arquivos)
- `from '../../shared/types'` → `from '../shared/types'`
- `from '../../shared/constants'` → `from '../shared/constants'`

### 3. Referências ao preload (4 arquivos)
- Remover `/// <reference types="../../preload/index.d.ts" />`

### 4. Buffer não definido
- Instalar `@types/node` ✅

## Solução Rápida

Como são muitos arquivos para editar manualmente, a melhor abordagem é:

**Opção 1: Desabilitar strict no frontend (RÁPIDO)**
```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "skipLibCheck": true
  }
}
```

**Opção 2: Comentar código problemático temporariamente**
Adicionar `// @ts-ignore` antes de cada `window.api`

**Opção 3: Criar stub global para window.api**
Criar arquivo `frontend/src/global.d.ts` com definição de window.api

## Recomendação

Para deploy rápido: **Opção 1** (desabilitar strict)
Para produção: Refatorar todos os componentes para usar o API client

## Arquivos Afetados

### window.api (precisa refatorar):
- src/App.tsx
- src/components/TitleBar.tsx  
- src/pages/*.tsx (todos)
- src/store/appStore.ts

### Imports (correção simples):
- src/pages/AIConfiguration.tsx
- src/pages/AgentConfiguration.tsx
- src/pages/APIKeyManager.tsx
- src/pages/CompaniesManager.tsx
- src/pages/LogsMonitoring.tsx
- src/pages/MetricsDashboard.tsx
- src/store/appStore.ts
