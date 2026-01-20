CRM para Agencias de Viajes – Especificación Técnica y Funcional

1. Objetivo del Producto

Desarrollar un CRM SaaS para agencias de viajes con fuerte diferenciación mediante IA, omnicanalidad, videollamadas asistidas, y automatización fiscal argentina, siguiendo principios de ingeniería senior (SOLID, SRP, DRY, modularidad estricta).

2. Principios de Ingeniería y Calidad

SOLID (énfasis en SRP)

DRY (helpers y servicios reutilizables)

Index Barrels (index.ts por carpeta)

Máx. 300 líneas por archivo

Arquitectura modular y escalable

Separación clara de dominio, infraestructura y aplicación

3. Stack Tecnológico

Backend

TypeScript

NestJS

Supabase (PostgreSQL + Auth + RLS)

pgvector para embeddings

Frontend

Next.js

TypeScript

shadcn/ui para componentes

i18n (Inglés / Español)

Auth & Seguridad

Login con Google (Supabase Auth)

Roles de usuario (Admin, Agent, Manager)

JWT + Refresh Tokens

4. DevOps y Estándares

Husky (pre-commit y post-commit)

ESLint

Prettier

Jest (bloquea commits si fallan tests)

GitHub Actions (CI/CD)

Build

Tests

Deploy automático (Vercel / Railway)

5. Arquitectura Base de Datos (Supabase)

Tabla

Propósito

Relaciones

agencies

Configuración general y fiscal (ARCA)

Raíz

clients

Clientes enriquecidos con IA

N:1 agencies

itineraries

Viajes + Skyscanner

N:1 clients

bookings

Reservas

N:1 itineraries

invoices

Facturación

1:1 bookings

tax_perceptions

Imp. PAIS y Ganancias

1:1 invoices

document_sections

Fragmentos vectoriales RAG

N:1 clients

RLS estricto: una agencia nunca accede a datos de otra.

6. Monetización

Stripe

Suscripción mensual SaaS

Roles y límites por plan

7. Sistema de Inteligencia Artificial

7.1 Estrategia de IA (APIs Gratuitas)

OpenRouter (LLMs gratuitos)

mistralai/devstral-2512:free → agentes / lógica

google/gemini-2.0-flash-exp:free → documentos largos

Voyage AI (Embeddings)

voyage-4-nano

Hasta 200M tokens gratuitos

Otras APIs

Skyscanner → precios y comparativas

Deepgram / AssemblyAI → transcripción en tiempo real

7.2 Sistema RAG Avanzado (Context Mesh)

Agentic RAG

Ingestión (PDFs, chats, videollamadas)

Chunking semántico

Vectorización (Voyage AI)

Recuperación híbrida:

SQL (Postgres)

Vectorial (pgvector)

Full Text Search (tsvector)

Generación final con OpenRouter

Ejemplo de consulta:

"Clientes que viajaron a Bariloche en 2024, presupuesto > USD 5000 y prefieren hoteles boutique"

8. Comunicación Omnicanal

Canales Integrados

WhatsApp

Gmail

LinkedIn

Slack

Telegram

Características

Timeline unificada

Memoria contextual compartida

Next-Best Actions sugeridas por IA

9. Videollamadas Asistidas por IA

Plataforma

Daily.co (Global Mesh Network)

Funcionalidades

Videollamada + Chat

Screen Sharing

Grabación selectiva

Captura de pantalla

Análisis de sentimiento en vivo

Frontend

daily-react o useMeeting

Backend

Procesamiento de video

Análisis emocional

Auditoría de calidad

10. Funcionalidades Diferenciadoras

Automatización fiscal argentina (Imp. PAIS + Ganancias)

Auto-enriquecimiento de leads desde LinkedIn

OCR de pasaportes

Lead Scoring por sentimiento

FAQ dinámica autoaprendida

Resumen automático de videollamadas a Notion

Clonación de tono de voz para emails

Detección de fraude

Mapa de calor de destinos

Búsqueda semántica histórica

Slash commands en Slack

Notificaciones interactivas en Telegram

Google Calendar Sync

Uber / Cabify

Airbnb Bridge

Tripadvisor Sync

Auto check-in aéreo

11. Gamificación y Ventas

Ranking mensual

Badges por destinos nuevos

Metas con premios

IA Coach para llamadas

12. Soporte y Post‑Venta

NPS automático

Bot de emergencia 24/7 (WhatsApp)

Recordatorio “Welcome Home”

Generador de itinerarios PDF

13. Internacionalización

Idiomas: Español / Inglés

Librerías i18n

14. Arquitectura de Microservicios (Decisión de Grandes Ligas)

Implementar el sistema como microservicios es una decisión estratégica de alto nivel. Para un CRM que integra videollamadas, IA, notificaciones y finanzas, esta arquitectura garantiza resiliencia: si el sistema de video falla, el CRM de ventas, chat y facturación continúa funcionando sin interrupciones.

Esta arquitectura respeta estrictamente SOLID, SRP, DRY y la regla de archivos < 300 líneas.

15. Mapa de Microservicios (Estructura de Poder)

El sistema se divide en 6 microservicios independientes, comunicados entre sí:

1. Auth & Users Service

Login con Gmail (Supabase Auth)

Gestión de roles (Admin, Agent, Traveler)

Perfiles de usuario

2. IA & RAG Service (The Brain)

Integración con OpenRouter (LLMs)

Generación de embeddings (Voyage AI)

Memoria vectorial (pgvector)

Implementación del Context Mesh

Único servicio autorizado a hablar con LLMs

3. Booking & Inventory Service

Itinerarios y viajes

Integración con Skyscanner

Gestión de reservas

4. Communication & Video Service

Videollamadas (Daily.co)

Screen Sharing

Análisis de sentimiento en vivo

Bots de Slack y Telegram

5. Finance & Tax Service

Cálculo de Impuesto PAIS y percepciones

Facturación electrónica

Monetización SaaS (Stripe)

6. Notification & Worker Service

Emails y alertas

Colas de trabajo

Procesos pesados asincrónicos

16. Plan Maestro de Ejecución con Microservicios (Paso a Paso)

Paso 1 – Monorepo y Setup Global

Uso de Monorepo (Turborepo o NestJS multi-app)

Compartir common/helpers y DTOs

Husky:

pre-commit → ESLint + Prettier

post-commit → confirmación de commit

CI/CD con GitHub Actions

Tests Jest por microservicio

Paso 2 – Base de Datos Distribuida (Supabase)

Una instancia de Supabase

Esquemas separados por microservicio

SRP aplicado a nivel de datos

Paso 3 – Comunicación Inter-servicios

Redis / RabbitMQ → tareas pesadas (PDFs, IA, video)

HTTP / gRPC → consultas rápidas

Paso 4 – Context Mesh (RAG Centralizado)

Servicio de IA expone endpoints de contexto

Otros servicios consultan preferencias y memoria

Ejemplo:

El servicio de ventas pregunta: "¿Qué prefiere este cliente?"
El servicio de IA consulta SQL + vectores y responde.

17. Plan Maestro de Ejecución (Paso a Paso)

15. Condición Final

👉 Antes de escribir una sola línea de código, este plan debe validarse paso a paso.
