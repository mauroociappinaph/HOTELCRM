# Hotel CRM - Sistema de Gestión para Agencias de Viajes

CRM SaaS con arquitectura de microservicios, IA integrada y cumplimiento fiscal argentino.

## 🏗️ Arquitectura

- **Monorepo**: Turborepo + pnpm workspaces
- **Backend**: NestJS (Microservicios)
- **Frontend**: Next.js 15
- **Base de Datos**: Supabase (PostgreSQL + pgvector)
- **IA**: OpenRouter + Voyage AI embeddings

## 📦 Estructura del Proyecto

```
hotel-crm-monorepo/
├── apps/
│   ├── auth-service/       # Microservicio de autenticación
│   ├── ia-rag-service/     # Motor de IA y RAG
│   └── web/                # Frontend Next.js
├── packages/
│   └── shared/             # Tipos, DTOs y constantes compartidas
└── supabase/
    └── migrations/         # Migraciones de base de datos
```

## 🚀 Comandos

```bash
# Instalar dependencias
pnpm install

# Desarrollo (todos los servicios)
pnpm dev

# Build
pnpm build

# Linting
pnpm lint

# Tests
pnpm test
```

## 🔧 Configuración

1. Copiar `.env.example` a `.env.local`
2. Configurar credenciales de Supabase
3. Ejecutar migraciones: `pnpm supabase:migrate`

## 📚 Documentación

Ver `/docs` para documentación detallada de cada microservicio.
