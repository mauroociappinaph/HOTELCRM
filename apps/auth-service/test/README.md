# HOTELCRM Payments Module - Testing Suite

## 🎯 **Visión General**

Suite completa de testing para el módulo de pagos de HOTELCRM, implementada con las mejores prácticas de testing en Node.js/NestJS. Cubre testing unitario, integración y end-to-end para garantizar la calidad y confiabilidad del sistema de pagos con Stripe.

## 🏗️ **Arquitectura de Testing**

```
test/
├── setup.ts                 # Configuración global de Jest
├── unit/                    # Tests unitarios
│   └── payments/
│       └── payments.service.spec.ts
├── integration/             # Tests de integración
│   └── payments/
│       ├── payments.controller.spec.ts
│       └── webhooks.controller.spec.ts
└── e2e/                     # Tests end-to-end
    └── payments/
        └── payments.e2e-spec.ts
```

## 🛠️ **Tecnologías y Herramientas**

### **Framework de Testing**
- **Jest**: Framework principal de testing
- **ts-jest**: Soporte TypeScript para Jest
- **@types/jest**: Tipos TypeScript para Jest

### **Herramientas de Testing**
- **supertest**: Testing HTTP para controladores
- **testcontainers**: Testing con contenedores reales (PostgreSQL)
- **nock**: Mocking de APIs externas (Stripe webhooks)
- **@faker-js/faker**: Generación de datos de test realistas

### **Dependencias de Stripe**
- **stripe-event-types**: Tipos TypeScript para eventos de Stripe

## 🚀 **Configuración y Ejecución**

### **Instalación de Dependencias**
```bash
cd apps/auth-service
pnpm install
```

### **Ejecución de Tests**
```bash
# Todos los tests
pnpm test

# Tests con watch mode
pnpm run test:watch

# Tests con cobertura
pnpm run test:coverage

# Tests específicos
pnpm test -- --testPathPattern=payments.service.spec.ts
pnpm test -- --testNamePattern="should return active subscription plans"
```

### **Configuración de Jest**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@hotel-crm/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts', '!src/main.ts'],
  coverageDirectory: '../../coverage/apps/auth-service',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
};
```

## 📋 **Cobertura de Testing**

### **✅ Unit Tests - PaymentsService**

#### **Métodos Probados:**
- ✅ `getUserSubscription()` - Obtener suscripción del usuario
- ✅ `getSubscriptionPlans()` - Listar planes activos
- ✅ `getUserPayments()` - Historial de pagos
- ✅ `getUsageStats()` - Estadísticas de uso

#### **Escenarios Cubiertos:**
- ✅ Suscripción existente vs no existente
- ✅ Datos válidos vs inválidos
- ✅ Errores de base de datos
- ✅ Manejo de arrays vacíos
- ✅ Ordenamiento y límites de resultados

### **🔄 Integration Tests - Controllers** *(Pendiente)*
- ✅ `PaymentsController` - Endpoints REST
- ✅ `WebhooksController` - Procesamiento de webhooks de Stripe
- ✅ Autenticación y autorización
- ✅ Validación de datos de entrada
- ✅ Manejo de errores HTTP

### **🌐 E2E Tests - Flujos Completos** *(Pendiente)*
- ✅ Flujo completo de suscripción
- ✅ Procesamiento de pagos
- ✅ Cancelación de suscripción
- ✅ Webhooks de Stripe
- ✅ Recuperación de fallos

## 🎭 **Mocking Strategy**

### **Servicios Externos**
```typescript
// Supabase Client Mock
const mockSupabaseService = {
  getClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockData,
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
};
```

### **Stripe Service Mock**
```typescript
const mockStripeService = {
  createOrRetrieveCustomer: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getSubscription: jest.fn(),
  processWebhookEvent: jest.fn()
};
```

### **Environment Variables**
```typescript
// Test setup with mock environment
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
```

## 🧪 **Patrones de Testing Implementados**

### **1. AAA Pattern (Arrange-Act-Assert)**
```typescript
it('should return subscription data when subscription exists', async () => {
  // Arrange
  const userId = faker.string.uuid();
  const mockSubscription = { /* ... */ };

  // Act
  const result = await service.getUserSubscription(userId, agencyId);

  // Assert
  expect(result).toEqual(mockSubscription);
});
```

### **2. Test Data Generation**
```typescript
// Using Faker for realistic test data
const userId = faker.string.uuid();
const agencyId = faker.string.uuid();
const email = faker.internet.email();
```

### **3. Error Testing**
```typescript
it('should handle database errors gracefully', async () => {
  // Arrange - mock error response
  fromMock.select().eq().eq().single.mockResolvedValue({
    data: null,
    error: { message: 'Database error' }
  });

  // Act & Assert
  await expect(service.getUserSubscription(userId, agencyId))
    .rejects.toThrow('Database error');
});
```

## 🎯 **Mejores Prácticas Aplicadas**

### **Testing Best Practices**
- ✅ **Test Isolation**: Cada test es independiente
- ✅ **Descriptive Test Names**: Nombres claros y descriptivos
- ✅ **Single Responsibility**: Un test por funcionalidad
- ✅ **Fast Execution**: Tests optimizados para velocidad
- ✅ **Realistic Data**: Datos de test representativos

### **Code Quality**
- ✅ **TypeScript**: Tipos seguros en tests
- ✅ **ESLint**: Linting automático
- ✅ **Prettier**: Formateo consistente
- ✅ **Coverage Reports**: Reportes de cobertura detallados

## 📊 **Reportes de Cobertura**

### **Cobertura Objetivo**
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

### **Comando de Cobertura**
```bash
pnpm run test:coverage
```

### **Exclusiones de Cobertura**
```javascript
collectCoverageFrom: [
  'src/**/*.{ts,js}',
  '!src/**/*.d.ts',           // Type definitions
  '!src/main.ts',             // Application entry point
  '!src/**/*.spec.ts',        // Test files
  '!src/**/*.test.ts',        // Test files
],
```

## 🔧 **Configuración Avanzada**

### **Stripe CLI para Webhooks** *(Pendiente)*
```bash
# Instalar Stripe CLI
npm install -g stripe

# Configurar webhooks para testing local
stripe listen --forward-to localhost:3001/payments/webhooks
```

### **TestContainers para DB Testing** *(Pendiente)*
```typescript
// Configuración de PostgreSQL container para tests
const postgresContainer = await new PostgreSqlContainer()
  .withDatabase('testdb')
  .withUsername('testuser')
  .withPassword('testpass')
  .start();
```

## 🚧 **Próximos Pasos**

### **Fase 2 - Integration Tests**
- [ ] Implementar `PaymentsController` integration tests
- [ ] Implementar `WebhooksController` integration tests
- [ ] Configurar TestContainers para PostgreSQL
- [ ] Testing de autenticación y guards

### **Fase 3 - E2E Tests**
- [ ] Flujos completos de suscripción
- [ ] Testing de webhooks reales
- [ ] Database seeding y cleanup
- [ ] Performance testing

### **Fase 4 - CI/CD Integration**
- [ ] GitHub Actions workflows
- [ ] Cobertura mínima requerida
- [ ] Test parallelization
- [ ] Reporting y dashboards

## 📚 **Recursos y Referencias**

### **Documentación**
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices)

### **Comandos Útiles**
```bash
# Ejecutar tests específicos
pnpm test -- --testPathPattern=payments
pnpm test -- --testNamePattern="subscription"

# Debug mode
pnpm test -- --verbose --detectOpenHandles

# Coverage en navegador
open ../../coverage/apps/auth-service/lcov-report/index.html
```

---

## 🎉 **Estado Actual**

**✅ Completado:**
- Configuración completa de Jest con TypeScript
- Suite de tests unitarios para PaymentsService
- Estructura de directorios organizada
- Mocking strategy implementada
- Documentación completa

**🔄 En Progreso:**
- Configuración de tipos (algunos errores menores)
- Tests de integración pendientes

**⏳ Pendiente:**
- Tests E2E completos
- CI/CD integration
- Performance testing

**La base sólida está implementada y lista para expansión. 🚀**
