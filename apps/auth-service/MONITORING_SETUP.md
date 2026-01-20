# 🏥 Health Checks & DataDog APM Monitoring Setup

Este documento describe la configuración completa de health checks comprehensivos y monitoreo APM con DataDog para el servicio de autenticación de HOTELCRM.

## 📋 Índice

- [Health Checks](#health-checks)
- [DataDog APM Setup](#datadog-apm-setup)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Monitoring Metrics](#monitoring-metrics)
- [Troubleshooting](#troubleshooting)

## 🏥 Health Checks

### Arquitectura de Health Checks

El sistema implementa health checks multinivel:

1. **Quick Health** (`GET /health`) - Para load balancers y monitoring básico
2. **Comprehensive Health** (`GET /health/detailed`) - Diagnóstico completo del sistema
3. **Legacy Support** (`GET /health/status`) - Compatibilidad hacia atrás

### Componentes Monitoreados

#### 🗄️ Database Health
- **Connectivity**: Verificación de conexión a Supabase
- **Latency**: Tiempo de respuesta de queries
- **Performance**: Umbrales de latencia (< 500ms)
- **Migration Status**: Estado de migraciones (opcional)

#### 🧠 Memory Health
- **Heap Usage**: Memoria utilizada vs total
- **Growth Monitoring**: Detección de leaks de memoria
- **Critical Thresholds**: >90% = crítico, >75% = warning
- **Garbage Collection**: Monitoreo de fragmentación externa

#### 🌐 External Services Health
- **Supabase**: Conectividad principal
- **Stripe**: Pagos y suscripciones
- **OpenRouter**: IA y embeddings
- **Voyage AI**: Búsqueda vectorial
- **Daily.co**: Videoconferencias

#### 🤖 AI Services Health
- **Model Availability**: Verificación de modelos configurados
- **Embedding Latency**: Performance de operaciones vectoriales
- **Fallback Handling**: Gestión de servicios no disponibles

### Estados de Health

```typescript
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
```

- **healthy**: Todos los componentes funcionando correctamente
- **degraded**: Algunos servicios con problemas menores
- **unhealthy**: Componentes críticos fallando

## 📊 DataDog APM Setup

### Instalación

```bash
# Instalar DataDog APM library
npm install dd-trace

# Opcional: Para desarrollo local
npm install --save-dev dd-trace
```

### Configuración Básica

```typescript
// Se configura automáticamente en MonitoringService
// Requiere variable de entorno: DD_API_KEY
```

### Variables de Entorno Requeridas

```bash
# DataDog Configuration
DD_API_KEY=your_datadog_api_key_here
DD_SERVICE_NAME=hotelcrm-auth-service
DD_ENV=production  # development, staging, production
DD_TRACE_SAMPLE_RATE=1.0  # 0.0 to 1.0
```

### Variables de Entorno Opcionales

```bash
# Performance Tuning
DD_TRACE_RATE_LIMIT=1000  # traces per second
DD_RUNTIME_METRICS_ENABLED=true

# Logging
DD_LOGS_INJECTION=true
DD_TRACE_DEBUG=false

# Custom Tagging
DD_TAGS=team:hotelcrm,component:auth-service,version:1.0.0
```

## 🔧 Environment Variables

### Health Check Configuration

```bash
# Skip database checks in CI/CD
SKIP_DB_CHECK=true

# Health check intervals (development only)
HEALTH_CHECK_INTERVAL=30000  # 30 seconds

# Custom thresholds
MEMORY_CRITICAL_THRESHOLD=90  # percentage
MEMORY_WARNING_THRESHOLD=75   # percentage
DB_LATENCY_THRESHOLD=500      # milliseconds
```

### DataDog Environment Variables

```bash
# Required
DD_API_KEY=your_api_key
DD_SERVICE_NAME=hotelcrm-auth-service
DD_ENV=production

# Optional
DD_TRACE_SAMPLE_RATE=1.0
DD_RUNTIME_METRICS_ENABLED=true
DD_LOGS_INJECTION=true
DD_TRACE_DEBUG=false
```

## 📡 API Endpoints

### Health Check Endpoints

#### `GET /health`
**Purpose**: Quick health check for load balancers and monitoring systems
**Response Time**: < 100ms expected
**Content-Type**: application/json

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T03:32:15.000Z",
  "service": "HOTELCRM Auth Service",
  "uptime": 3600000
}
```

#### `GET /health/detailed`
**Purpose**: Comprehensive system diagnostics
**Response Time**: 1-5 seconds (depends on external services)
**Content-Type**: application/json

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T03:32:15.000Z",
  "service": "HOTELCRM Auth Service",
  "version": "1.0.0",
  "uptime": 3600000,
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 45,
      "connectionCount": 1
    },
    "memory": {
      "status": "healthy",
      "used": 85,
      "total": 128,
      "percentage": 66.4
    },
    "external": {
      "stripe": {
        "status": "healthy",
        "latency": 120,
        "lastChecked": "2026-01-20T03:32:15.000Z"
      },
      "supabase": {
        "status": "healthy",
        "latency": 45,
        "lastChecked": "2026-01-20T03:32:15.000Z"
      }
    },
    "ai": {
      "status": "healthy",
      "models": {
        "openrouter": true,
        "voyage": true
      },
      "lastEmbeddingCheck": "2026-01-20T03:32:15.000Z"
    }
  }
}
```

#### `GET /monitoring/status`
**Purpose**: DataDog monitoring status
**Content-Type**: application/json

**Response**:
```json
{
  "enabled": true,
  "service": "hotelcrm-auth-service",
  "environment": "production",
  "version": "1.0.0",
  "apiKeyConfigured": true,
  "initializedAt": "2026-01-20T03:30:00.000Z"
}
```

## 📈 Monitoring Metrics

### DataDog Metrics Recolectadas

#### Application Metrics
- `app.health_check` - Health check executions
- `nodejs.heap.used` - Heap memory used (MB)
- `nodejs.heap.total` - Total heap memory (MB)
- `nodejs.heap.percentage` - Heap usage percentage
- `nodejs.event_loop.lag` - Event loop lag (ms)

#### Error Metrics
- `nodejs.errors.uncaught_exception` - Uncaught exceptions
- `nodejs.errors.unhandled_rejection` - Unhandled promise rejections

#### Business Metrics (Framework)
```typescript
// En tus servicios, puedes agregar:
import { MonitoringService } from '../monitoring/monitoring.service';

@Injectable()
export class AuthService {
  constructor(private monitoring: MonitoringService) {}

  async login(credentials: LoginDto) {
    try {
      const result = await this.authenticate(credentials);
      // Success metric
      this.monitoring.increment('auth.login.success');
      return result;
    } catch (error) {
      // Failure metric
      this.monitoring.increment('auth.login.failure');
      throw error;
    }
  }
}
```

### APM Traces

#### Automatic Instrumentation
- **HTTP Requests**: Todas las llamadas HTTP entrantes/salientes
- **Database Queries**: Queries a PostgreSQL/Supabase
- **External API Calls**: Stripe, OpenRouter, Voyage AI, etc.

#### Custom Spans
```typescript
// Para operaciones críticas
import { tracer } from 'dd-trace';

const span = tracer.scope().active();
const childSpan = tracer.startSpan('custom.operation', {
  childOf: span,
  tags: {
    'operation.type': 'business_logic',
    'user.id': userId,
  }
});

// Tu lógica aquí
await performBusinessLogic();

childSpan.finish();
```

## 🔧 Troubleshooting

### Health Checks Failing

#### Database Connection Issues
```bash
# Verificar variables de entorno
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Verificar conectividad manual
curl -H "apikey: $SUPABASE_ANON_KEY" $SUPABASE_URL/rest/v1/
```

#### Memory Issues
```bash
# Verificar uso de memoria
node -e "console.log(process.memoryUsage())"

# Verificar heap dumps (si configurado)
# Los dumps se generan automáticamente cuando >90% memoria
```

#### External Services Down
```bash
# Verificar conectividad básica
curl -I https://api.stripe.com/healthcheck
curl -I https://openrouter.ai/api/v1/models
```

### DataDog Issues

#### APM Not Sending Data
```bash
# Verificar API key
echo $DD_API_KEY

# Verificar configuración
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DD_API_KEY"
```

#### Missing Traces
```bash
# Verificar sample rate
echo $DD_TRACE_SAMPLE_RATE

# Forzar envío inmediato (desarrollo)
export DD_TRACE_DEBUG=true
```

### Logs y Debugging

#### Health Check Logs
```bash
# Los health checks se ejecutan automáticamente
# Revisa logs de aplicación para detalles:
tail -f logs/application.log | grep "health\|Health"
```

#### DataDog Debug Mode
```bash
# Habilitar debug logging
export DD_TRACE_DEBUG=true

# Reiniciar aplicación
npm run start:dev
```

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Configurar `DD_API_KEY` en entorno
- [ ] Verificar `DD_SERVICE_NAME` correcto
- [ ] Configurar `DD_ENV` apropiado
- [ ] Probar health checks localmente
- [ ] Validar variables de entorno críticas

### Post-Deployment
- [ ] Verificar métricas en DataDog dashboard
- [ ] Configurar alertas para servicios críticos
- [ ] Configurar dashboards de monitoreo
- [ ] Documentar procedimientos de troubleshooting

### Monitoring Dashboards

#### DataDog Dashboard Recomendado
1. **Service Overview**: Latencia, throughput, error rate
2. **Infrastructure**: CPU, memoria, disco
3. **Business Metrics**: Logins, bookings, payments
4. **External Dependencies**: Stripe, AI services, database

## 📞 Support

Para issues relacionados con monitoreo:

1. Revisar logs de aplicación
2. Verificar configuración de DataDog
3. Consultar documentación oficial de DataDog
4. Contactar equipo de DevOps

---

**Estado**: ✅ Implementado y listo para producción
**Última actualización**: 2026-01-20
**Versión**: 1.0.0
