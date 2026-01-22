# 🕶️ The Dude Pipeline v3.3 (Enterprise CEO Mode)

Este documento detalla el flujo de trabajo operativo de **Dude**, el orquestador de software especializado. Basado en una arquitectura de "Empresa de Especialistas", este pipeline garantiza calidad industrial, seguridad y alineación con el mercado.

---

## 🚀 Fase I: Estrategia e Inteligencia (Market Insight)

### 0. Git Flow & Repository Hardening
*   **Acción:** Preparación de ramas `feature/` o `fix/`.
*   **Objetivo:** Proteger la rama `main` y asegurar un historial de commits limpio y trazable.

### 0.5. Inteligencia de Mercado & Benchmarking (Paso Crucial)
*   **Herramientas:** Google Search, Firecrawl (Reddit/Comunidades), Open-Aware.
*   **Acción:** Analizar tendencias, arquitecturas probadas y puntos de dolor de usuarios antes de proponer código. No reinventamos la rueda, la optimizamos.

### 1. Definición de Alcance (Business Vision)
*   **Acción:** Documentación en `docs/`.
*   **Objetivo:** Definir el "Por qué" técnico y de negocio. Cada línea de código debe servir a un propósito estratégico.

### 2. Auditoría de Impacto
*   **Acción:** Evaluar dependencias y centralizar lógica.
*   **Objetivo:** Mantener el principio **DRY** (Don't Repeat Yourself) y evitar deuda técnica inmediata.

### 3. Memoria Híbrida (Dude-Memory-Engine)
*   **Acción:** Sincronizar contexto histórico.
*   **Herramientas:** **Redis** como pizarra compartida para agentes y orquestación con **LangGraph**.

### 4. Context7 & Skills JIT (The Bridge)
*   **Acción:** Inyección de documentación específica y habilidades internas.
*   **Optimización:** Uso de **LLMLingua-2** para comprimir instrucciones y maximizar la eficiencia de tokens.

---

## 🛠️ Fase II: Ejecución Inteligente (Production)

### 5. Domain Strategy Router
*   **Acción:** Clasificación y activación de patrones de diseño.
*   **Patrones:** SRP (Single Responsibility), Hexagonal, Atomic Design, etc.

### 6. Ejecución de Arquitectura (Specialists)
*   **Frontend con Ojos:** Validación visual obligatoria utilizando **Chrome DevTools MCP**. Si no se ve bien, no está terminado.
*   **Backend SRP:** Desarrollo en contenedores aislados (**Docker**) siguiendo lógica de microservicios o modularidad estricta.
*   **Jules (Shadow Agent):** Delegación de tareas pesadas o repetitivas en segundo plano para mantener la agilidad del orquestador.

### 7. Auto-Corrección (The Fixer)
*   **Acción:** Reparación autónoma basada en visión (DevTools), logs de consola y errores de compilación.

---

## 🛡️ Fase III: Calidad y Automatización (Audit)

### 8. QA & Testing
*   **Acción:** Ejecución de suites de pruebas automatizadas (Unit, Integration, E2E).

### 9. Excelencia en Code Review
*   **Acción:** Revisión estética, técnica y de performance por parte del "Dueño" (Dude).

### 10. Hardening & Observability
*   **Acción:** Auditoría de seguridad y configuración de monitoreo (logs, métricas).

### 11. Documentación Final
*   **Acción:** Manuales de usuario, actualización de READMEs y registro de lecciones aprendidas.

### 12. Guardias Nocturnos (GitHub Actions)
*   **Acción:** Automatización de triage, corrección de bugs menores y reviews iniciales de forma autónoma.

### 13. Cierre y Limpieza (Entornos Limpios)
*   **Acción:** Purga de Docker, guardado de lecciones en la memoria de largo plazo y cierre de entornos efímeros.

---
*Documento generado por Dude - CEO de HOTELCRM Intelligence Engine.*
