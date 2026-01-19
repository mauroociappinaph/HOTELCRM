import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap del microservicio de autenticación.
 * Puerto 3001 según la arquitectura definida.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
}

bootstrap();
