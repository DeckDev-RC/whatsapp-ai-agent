# WhatsApp AI Agent

Aplicação web self-hosted para administrar agentes de IA integrados ao WhatsApp, com backend Node.js/Express, frontend React e execução orientada a Docker/Portainer.

## O que demonstra

- separação entre frontend e backend;
- API TypeScript com validação de tipos e build reproduzível;
- comunicação em tempo real com Socket.IO;
- integrações com provedores de IA, Supabase e Baileys;
- empacotamento operacional para ambiente self-hosted.

## Arquitetura

```text
frontend React/Vite  ->  backend Express/TypeScript  ->  integrações de IA, WhatsApp e dados
                                      |
                               execução em Docker/Portainer
```

## Estrutura

- `backend/`: API, integrações e serviços do agente;
- `frontend/`: interface de gerenciamento;
- `docker-compose.yml`: composição local;
- `nginx/`: proxy reverso;
- `DEPLOY_GUIDE.md`: implantação operacional.

## Desenvolvimento local

### Backend

```bash
cd backend
npm ci
npm run typecheck
npm run build
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Consulte os arquivos de exemplo e o `DEPLOY_GUIDE.md` para as variáveis de ambiente. Nunca committe tokens, sessões do WhatsApp, chaves de IA ou dados de usuários.

## Status e segurança

- **Status:** MVP/self-hosted; não há demonstração pública validada neste perfil.
- CI de type-check/build, Secret Scanning, Push Protection, Dependabot e CodeQL estão habilitados.
- O workflow de validação está verde. O workflow de deploy depende da infraestrutura Portainer e pode falhar por configuração externa.
- Use somente dados de teste e obtenha autorização antes de conectar uma conta real do WhatsApp.

## Licença

Consulte `LICENSE` antes de redistribuir ou operar este projeto.