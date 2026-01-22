import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { EnvironmentValidation } from './config/env.validation';

/**
 * Bootstrap del microservicio de autenticación.
 * Puerto 3001 según la arquitectura definida.
 */
async function bootstrap() {
  // 🔐 Validate environment variables at startup
  await EnvironmentValidation.validateAll();

  const app = await NestFactory.create(AppModule);

  // 📚 Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('HOTELCRM - Auth & Operations Service')
    .setDescription(
      'API central para la gestión de autenticación, operaciones inteligentes (RAG), ' +
        'pagos y coordinación de tareas hoteleras.',
    )
    .setVersion('1.0')
    .addTag('auth', 'Gestión de identidad y acceso')
    .addTag('ai', 'Inteligencia Artificial y sistema RAG')
    .addTag('payments', 'Procesamiento de pagos con Stripe')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api/v1');

  // CORS habilitado para desarrollo
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🔐 Auth Service running on http://localhost:${port}`);
  console.log(`📚 API available at http://localhost:${port}/api/v1`);

  // Log validation summary for monitoring
  const summary = EnvironmentValidation.getValidationSummary();
  console.log('🔍 Environment validation summary:', JSON.stringify(summary, null, 2));
}

bootstrap();
