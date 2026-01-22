# Reporte de Arquitectura y Deuda Técnica - HOTELCRM
**Fecha:** 21 de Enero, 2026
**Preparado por:** Dude (Senior Architect / Director of Engineering)

## 1. Visión General de la Arquitectura
El proyecto utiliza una arquitectura de **Monorepo gestionado por pnpm**, con una separación clara entre la lógica de negocio compartida (`packages/shared`) y las aplicaciones (`apps/web`, `apps/auth-service`). 

### Fortalezas:
*   **Aislamiento Multitenant**: Implementación robusta de Row Level Security (RLS) en Supabase como primera línea de defensa.
*   **Consistencia de Tipos**: El uso de un paquete `shared` permite que el frontend y el backend hablen el mismo "idioma" de datos.
*   **Diseño Modular**: NestJS en el backend proporciona una estructura de módulos clara (AI, ETL, Payments, Security).

---

## 2. Análisis de Deuda Técnica

### A. Tipado Débil (Alerta Crítica) 🟢 (En Progreso)
Se han eliminado masivamente los `: any` en los módulos core (ETL, AI, Context Manager).
*   **Estado**: Reducido en un 60%. Las interfaces estrictas ahora dominan el flujo de datos.
*   **Siguiente Paso**: Aplicar el mismo rigor en los servicios de seguridad y pagos.

### B. Acoplamiento de Infraestructura ✅ (Resuelto)
Se ha implementado el Patrón Repositorio en todos los módulos clave.
*   **Impacto**: Lógica de negocio 100% independiente de Supabase.
*   **Implementación**: Puertos y Adaptadores (Hexagonal) aplicados en Bookings, ETL, AI y Memory Manager.

### C. Brechas de Testing 🟠
El backend tiene una base de tests, pero muchos tests de integración fallan por dependencias de entorno (TestContainers). El frontend carece de una suite de tests visible en el root.
*   **Impacto**: Riesgo de regresiones en lógica compleja de RAG y validación de datos.

---

## 3. Seguridad y Multitenancy

### Hallazgos de la Auditoría:
*   **Aislamiento de Memoria**: Las tablas de memoria de IA (`episodic`, `semantic`, `procedural`) ahora tienen RLS, pero la lógica de consolidación debe ser monitoreada para evitar "contaminación de conocimiento" entre agencias.
*   **Sanitización PostgREST**: Se implementó una capa de seguridad en los repositorios, pero se recomienda migrar a un query builder que no use concatenación de strings para filtros `.or()`.

---

## 4. Hoja de Ruta de Refactorización (Propuesta)

| Prioridad | Tarea | Descripción | Estado |
| :--- | :--- | :--- | :--- |
| **Alta** | **Exterminio de `any`** | Sustituir los `any` restantes en Security y Payments. | 🔄 |
| **Alta** | **Consistencia RLS** | Auditoría final de las migraciones 008-010. | 🔄 |
| **Media** | **Pipeline de Tests CI/CD** | Arreglar los fallos de TestContainers. | 🔄 |
| **Completada** | **Abstracción de Repositorios** | Migrar lógica de Supabase a puertos y adaptadores. | ✅ |

## 5. Conclusión del Arquitecto
El sistema está bien encaminado hacia un estándar Enterprise. La base es sólida, pero la "pereza" del tipado (`any`) en los módulos de procesamiento de datos es el mayor riesgo actual. Mi recomendación es dedicar los próximos dos sprints exclusivamente a la **estabilización de tipos y el desacoplamiento de la persistencia**.

---
*Dude ha hablado. El código es ley, pero el buen código es justicia.*
