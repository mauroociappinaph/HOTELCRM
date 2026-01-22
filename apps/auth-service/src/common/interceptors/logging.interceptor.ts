import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 🕵️ Interceptor para observabilidad avanzada.
 * Registra tiempos de respuesta, rutas, métodos y códigos de estado.
 * Formato estructurado listo para sistemas de agregación de logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;

          this.logger.log(
            JSON.stringify({
              type: 'request_success',
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || 500;

          this.logger.error(
            JSON.stringify({
              type: 'request_error',
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
              error: err.message,
              stack: err.stack,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
