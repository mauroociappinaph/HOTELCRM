# 🏛️ Global Technical Vision & Strategy: HOTELCRM

## 1. Visión Técnica Global (Senior Architect)
El proyecto HOTELCRM se posiciona como un **Ecosistema de Operaciones Inteligentes**. La arquitectura actual, basada en la estructura de archivos detectada, está diseñada para ser resiliente, modular y preparada para el escalamiento horizontal.

### Core Architectural Pillars
*   **Modular Monorepo Strategy:** Separación física en `apps/auth-service`, `apps/web` y el corazón de tipos en `packages/shared`.
*   **Data-Driven Intelligence:** Implementación real de RAG (003_ai_rag_system.sql) y vectores (`pgvector`) en Supabase para automatización.
*   **Security by Design:** Uso de RLS (007_comprehensive_rls_policies.sql) y esquemas de cuarentena (010_create_quarantine_table.sql) para proteger la integridad del hotel.

---

## 2. Diseño de Sistemas e Infraestructura
Arquitectura de **Microservicios Híbridos** validada por el `pnpm-workspace.yaml`.

### Componentes Clave
1.  **Capa de Presentación (Next.js):** Localizada en `apps/web`, utiliza Tailwind y componentes de UI para una experiencia fluida.
2.  **Capa de Servicios (NestJS):** En `apps/auth-service`, con módulos especializados para cada dominio de negocio.
3.  **Persistence Layer (Supabase):** Gestión de esquemas complejos mediante migraciones SQL, incluyendo lógica de búsqueda similar mediante RPC (008_create_search_similar_documents_rpc.sql).

---

## 3. DevOps & CI/CD: Automatización e Infraestructura (DevOps Troubleshooter)
La estabilidad operativa de HOTELCRM se garantiza mediante un pipeline de automatización que elimina el error humano y optimiza el ciclo de vida del software.

### Estrategia de Infraestructura
1.  **Contenerización Inmutable:** Uso de *multi-stage builds* en Docker para generar imágenes de producción ultra-ligeras y seguras, garantizando paridad entre entornos.
2.  **Validación de Entorno en Pipeline:** Integración del sistema `env.validation.ts` en el CI/CD. El build falla ruidosamente si faltan variables críticas de Stripe o Supabase, evitando desastres en producción.
3.  **Turbo-Charged CI:** Uso intensivo de **Turborepo** con cacheo remoto en GitHub Actions para minimizar los tiempos de despliegue y acelerar el feedback al desarrollador.
4.  **Estrategias de Despliegue Zero-Downtime:** Implementación de rutas hacia despliegues **Blue-Green** o **Canary**, asegurando que el CRM nunca deje de funcionar durante las actualizaciones.
5.  **Troubleshooting Proactivo:** Definición de **Health Checks** avanzados que verifican la salud real del ecosistema (conectividad con DB e IA) y no solo la ejecución del proceso.

---

## 4. Performance Optimization: Velocidad y Eficiencia (Performance Pilot)
Estrategia de ultra-eficiencia para maximizar la experiencia del huésped y reducir costos operativos.

### Pilares de Rendimiento
1.  **Vector Search Tuning:** Implementación de índices **HNSW** en Supabase para búsquedas semánticas en milisegundos.
2.  **Semantic Caching:** Capa de caché inteligente para el Concierge de IA que evita llamadas redundantes a modelos de embedding, ahorrando latencia y costos de API.
3.  **Frontend de Alto Rendimiento:** Uso de **Partial Prerendering (PPR)** y Streaming en Next.js para una carga instantánea del Dashboard administrativo.

---

## 5. Debugging Strategies: Resolución de Incidentes Complejos (Debugging Strategies)
Marco avanzado para identificar y resolver fallos en un sistema distribuido y asíncrono.

### Estrategias de Diagnóstico
1.  **Rastreo Distribuido (X-Correlation-ID):** Implementación de IDs de correlación únicos que unifican los logs de **Pino** desde el frontend hasta la base de datos, permitiendo seguir el flujo completo de una petición.
2.  **Post-Mortem de Procesos Asíncronos:** Sistema de "Instantáneas de Datos" para procesos de larga duración (ETL e IA), facilitando el análisis de fallos ocurridos en segundo plano.
3.  **Depuración de IA (RAG Explainability):** Capa que registra los fragmentos de documentos recuperados por `pgvector` para diagnosticar alucinaciones o errores de contexto en la IA.
4.  **Chaos Testing Controlado:** Uso de interceptores para simular latencia o fallos de infraestructura, validando la resiliencia del sistema de manejo de errores bajo presión.

---

## 6. Test Automation & API Testing (Strategist / Tester)
Confianza absoluta mediante una pirámide de pruebas automatizada y validación estricta de contratos.

*   **Pirámide NestJS:** Unit (`test/unit`), Integration (`test/integration`) y E2E (`test/e2e`).
*   **API Validation:** Uso sistemático de **Supertest** contra los contratos OpenAPI generados.
*   **AI Fidelity:** Validación de respuestas RAG contra datasets controlados.

---

## 7. Data Quality Frameworks: Aseguramiento de la Integridad (Data Quality Frameworks)
Garantía de que cada decisión automatizada se base en datos de alta fidelidad.

*   **Data Quality Gates:** Porteros en el flujo de entrada (`data-quality-gate.service.ts`).
*   **Arquitectura de Cuarentena:** Aislamiento de datos sospechosos en la tabla `quarantine`.
*   **RAG Fidelity:** Alimentación de IA exclusivamente con datos validados.

---

## 8. Code Review & Excellence: Estándares de Ingeniería (Code Reviewer / Excellence)
Cultura de excelencia técnica orientada a la modularidad y al principio de responsabilidad única (SRP).

*   **Zero-Code-Smell Policy:** Eliminación proactiva de complejidad ciclomática.
*   **Documentación del 'POR QUÉ':** Registro de decisiones técnicas descriptivas.

---

## 9. Compliance Legal Sentinel: Revisión de Estándares y Cumplimiento (Compliance Legal Sentinel)
Marco legal integrado desde la base para cumplir con GDPR, PCI DSS y ética en IA.

---

## 10. Security Auditor: Auditoría de Vulnerabilidades y Seguridad (Security Auditor)
Defensa en profundidad mediante Zero-Trust, RLS y monitoreo continuo de anomalías.

---

## 11. Legacy Modernizer: Modernización Continua y Estándares (Legacy Modernizer)
Adopción proactiva de estándares modernos para evitar la deuda técnica y obsolescencia.

---

## 12. i18n Localization Manager: Gestión Multi-idioma (i18n Localization Manager)
Infraestructura global para la expansión internacional del ecosistema hotelero.

---

## 13. Error Handling Patterns: Sistemas de Errores Resilientes (Error Handling Patterns)
Capacidad de fallo seguro y feedback localizado para una operación sin fricciones.

---

## 14. API Contract Guardian: Diseño y Validation de Contratos (API Contract Guardian)
Sincronización total mediante contratos Swagger/OpenAPI y validación global.

---

## 15. Typescript Pro: Tipado Estricto e Interfaces Limpias (Typescript Pro)
Robustez total mediante un sistema de tipos unificado en `@hotelcrm/shared`.

---

## 16. Frontend Developer: UI/UX con React, Next.js y Tailwind CSS (Frontend Developer)
Interfaz diseñada para la eficiencia operativa y una experiencia de usuario impecable.

---

## 17. Backend Architect: Lógica, NestJS y Escalabilidad (Backend Architect)
Motor NestJS de alta cohesión, stateless y escalable horizontalmente.

---

## 18. Patrones de Diseño Implementados
*   **Repository Pattern.**
*   **Contract-First.**
*   **Dependency Injection.**

---

## 19. Monorepo Orchestrator: Gestión de Complejidad (Monorepo Specialist)
Eficiencia operativa mediante **Turborepo** y **pnpm workspaces**.

---

## 20. Superpower Planning: Inteligencia Operativa (AI Concierge)
Feature estrella planificada para revolucionar el servicio al huésped.

---

## 21. Superpower Brainstorming: Innovación Predictiva
Ideas disruptivas: Anticipatory Event Engine y Zero-Knowledge Identity.

---

## 22. Technical Debt Analysis: Salud y Refactorización (Refactor Specialist)
Auditoría y plan de acción para el código actual (Limpieza de directorios " 2").

---

## 23. Project Orchestrator: Gestión y Priorización (PM)
Roadmap estratégico para maximizar el Time-to-Value.

---

## 24. Skills Disponibles de Antigravity (52 Skills)

### 🏛️ Arquitectura y Estrategia (Nivel Senior)
1.  **senior-architect:** Diseño de sistemas y visión global.
2.  **project-orchestrator-pm:** Gestión de tareas y cronogramas.
3.  **monorepo-management:** Proyectos grandes (Turborepo).
4.  **superpower-planning:** Planificación profunda de features.
5.  **superpower-brainstorming:** Sesiones creativas.
6.  **technical-debt-analysis:** Análisis de deuda técnica.

### 💻 Desarrollo Full-Stack
7.  **backend-architect:** Lógica de servidor y escalabilidad.
8.  **frontend-developer:** UI/UX con React/Next.js.
9.  **typescript-pro:** Tipado estricto e interfaces limpias.
10. **code-modularity-architect:** Separación de código en módulos.
11. **api-contract-guardian:** Validación de contratos API.
12. **error-handling-patterns:** Sistemas resilientes.
13. **i18n-localization-manager:** Multi-idioma.
14. **legacy-modernizer:** Modernización de código.

### 🛡️ Seguridad y Calidad
15. **security-auditor:** Auditoría de vulnerabilidades.
16. **secrets-vault-orchestrator:** Gestión segura de llaves.
17. **compliance-legal-sentinel:** Estándares legales.
18. **code-reviewer:** Calidad técnica.
19. **code-review-excellence:** Auditoría de estándares.
20. **data-quality-frameworks:** Integridad de datos.

### 🧪 Testing y Automatización
21. **test-automation-strategist:** Jest y QA.
22. **api-endpoint-tester:** Pruebas de endpoints.
23. **debugging-strategies:** Estrategias avanzadas de debugging.
24. **performance-optimization-pilot:** Optimización de recursos.

### ⚙️ DevOps e Infraestructura
25. **devops-troubleshooter:** Solución de problemas en Docker, CI/CD y nubes.
26. **infrastructure-as-code-expert:** Terraform/IaC.
27. **deploy-automation-pilot:** Pipelines de salida.
28. **docker-hub-autonomous:** Gestión de imágenes y contenedores.
29. **observability-engineer:** Configuración de logs (Pino) y métricas.
30. **reliability-sre-pilot:** Disponibilidad.

### 🤖 Ecosistema Telegram
31. **telegram-bot-builder:** Creación y mejora de bots.
32. **telegram-hq-commander:** Comandos avanzados para controlar tu Mac/Servidor.
33. **telegram-mini-app:** Desarrollo de aplicaciones embebidas en Telegram.

### 📊 Datos y Almacenamiento
34. **data-engineer:** Modelado a gran escala.
35. **database-performance-tuner:** Optimización DB.
36. **vector-index-tuning:** Ajuste de índices para búsquedas semánticas (IA).
37. **rag-implementation:** Memoria para IAs.

### 🚀 Integraciones y Herramientas
38. **stripe-integration:** Pagos Stripe.
39. **payment-integration:** Transacciones.
40. **twilio-communications:** SMS/WhatsApp.
41. **reddit-scraper:** Tendencias de foros.
42. **detect-duplicate-files:** Limpieza de archivos.
43. **mobile-release-manager:** Lanzamientos móviles.
44. **smart-contract-developer:** Blockchain.

### ✍️ Documentación y Marca
45. **technical-writer:** Manuales claros.
46. **docs-technical-writer:** Documentación de código.
47. **brand-identity:** Consistencia de marca.
48. **ui-ux-designer:** Experiencias fluidas.

### 🧠 Especiales de Gemini
49. **ai-engineer:** Integración de LLMs.
50. **gemini-skill-creator:** Creación de habilidades.
51. **context-manager:** Gestión de contexto.
52. **memory-systems:** Memoria persistente.

---

## 25. Conclusión
HOTELCRM es una plataforma de grado empresarial fundamentada en el código actual. La integración de estas visiones asegura un producto que no solo es técnicamente excelente, sino también transparente, fácil de depurar y listo para operar en una infraestructura de nube escalable y segura.
