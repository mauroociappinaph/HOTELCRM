import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting configuration
const RATE_LIMITS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // requests per window
  blockDuration: 60 * 60 * 1000, // 1 hour block
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 10,
  successThreshold: 3,
  timeoutMs: 60000, // 1 minute
};

// Attack patterns to detect
const ATTACK_PATTERNS = {
  RSC_DESERIALIZATION: /__nextjs_action__|__nextjs_server_action__/,
  FLIGHT_PROTOCOL_ABUSE: /_next\/flight\/[^/]+\/[^/]+/,
  MALICIOUS_PAYLOADS: /(\\\\|\\u00|\\x[0-9a-f]{2}|%[0-9a-f]{2}){10,}/i,
  SUSPICIOUS_HEADERS: /(x-forwarded-for.*){2,}/i,
  SQL_INJECTION: /(\b(select|union|insert|update|delete|drop|create|alter)\b.*\b(from|into|table|database)\b)/i,
};

// In-memory storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const circuitBreakerStore = new Map<string, { failures: number; successes: number; state: 'closed' | 'open' | 'half-open'; lastFailure: number; nextAttempt: number }>();

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (clientIP) {
    return clientIP;
  }

  return 'unknown';
}

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMITS.windowMs,
      blocked: false
    });
    return false;
  }

  if (record.blocked && now < record.resetTime) {
    return true;
  }

  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + RATE_LIMITS.windowMs;
    record.blocked = false;
  } else {
    record.count++;
    if (record.count > RATE_LIMITS.maxRequests) {
      record.blocked = true;
      record.resetTime = now + RATE_LIMITS.blockDuration;
      return true;
    }
  }

  return false;
}

function checkCircuitBreaker(service: string): 'closed' | 'open' | 'half-open' {
  const record = circuitBreakerStore.get(service);

  if (!record) {
    circuitBreakerStore.set(service, {
      failures: 0,
      successes: 0,
      state: 'closed',
      lastFailure: 0,
      nextAttempt: 0
    });
    return 'closed';
  }

  const now = Date.now();

  if (record.state === 'open' && now >= record.nextAttempt) {
    record.state = 'half-open';
    record.nextAttempt = now + CIRCUIT_BREAKER_CONFIG.timeoutMs;
  }

  return record.state;
}

function updateCircuitBreaker(service: string, success: boolean): void {
  const record = circuitBreakerStore.get(service);
  if (!record) return;

  const now = Date.now();

  if (success) {
    record.successes++;
    record.failures = 0;

    if (record.state === 'half-open' && record.successes >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
      record.state = 'closed';
      record.successes = 0;
    }
  } else {
    record.failures++;
    record.lastFailure = now;

    if (record.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      record.state = 'open';
      record.nextAttempt = now + CIRCUIT_BREAKER_CONFIG.timeoutMs;
      record.failures = 0;
    }
  }
}

function detectAttackPattern(request: NextRequest): { pattern: string; confidence: number } | null {
  const url = request.url;
  const headers = Object.fromEntries(request.headers.entries());
  const userAgent = headers['user-agent'] || '';
  const contentLength = parseInt(headers['content-length'] || '0');

  // Check URL patterns
  for (const [patternName, regex] of Object.entries(ATTACK_PATTERNS)) {
    if (regex.test(url) || regex.test(userAgent)) {
      return { pattern: patternName.toLowerCase(), confidence: 0.8 };
    }
  }

  // Check for suspicious body sizes (potential DoS) using content-length header
  if (contentLength > 100000) {
    return { pattern: 'large_payload', confidence: 0.6 };
  }

  // Check for suspicious headers
  if (ATTACK_PATTERNS.SUSPICIOUS_HEADERS.test(JSON.stringify(headers))) {
    return { pattern: 'suspicious_headers', confidence: 0.7 };
  }

  return null;
}

async function logSecurityEvent(event: {
  event_type: string;
  severity: string;
  source_ip: string;
  request_path: string;
  request_method: string;
  attack_pattern?: string;
  confidence_score?: number;
  metadata?: any;
}): Promise<void> {
  try {
    // Import security monitor dynamically to avoid circular dependencies
    const { securityMonitor } = await import('./lib/security-monitor');
    await securityMonitor.logSecurityEvent(event as any);
  } catch (error) {
    console.error('[SECURITY LOGGING ERROR]', error);
    // Fallback to console logging
    console.warn('[SECURITY EVENT]', event);
  }
}

export async function middleware(request: NextRequest) {
  const clientIP = getClientIP(request);
  const path = request.nextUrl.pathname;
  const method = request.method;

  // Skip middleware for static assets and API routes that need high performance
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/robots.txt') ||
    path.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next();
  }

  // Check circuit breaker
  const circuitState = checkCircuitBreaker('web-app');
  if (circuitState === 'open') {
    await logSecurityEvent({
      event_type: 'circuit_breaker_open',
      severity: 'high',
      source_ip: clientIP,
      request_path: path,
      request_method: method,
      metadata: { circuit_breaker: 'web-app' }
    });

    return new NextResponse('Service temporarily unavailable', { status: 503 });
  }

  // Apply rate limiting
  if (isRateLimited(clientIP)) {
    updateCircuitBreaker('web-app', false);

    await logSecurityEvent({
      event_type: 'rate_limit_hit',
      severity: 'medium',
      source_ip: clientIP,
      request_path: path,
      request_method: method,
      metadata: { rate_limit_exceeded: true }
    });

    return new NextResponse('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': '3600',
        'X-RateLimit-Limit': RATE_LIMITS.maxRequests.toString(),
        'X-RateLimit-Reset': Math.ceil((Date.now() + RATE_LIMITS.windowMs) / 1000).toString()
      }
    });
  }

  // Detect attack patterns
  const attackDetection = detectAttackPattern(request);
  if (attackDetection) {
    updateCircuitBreaker('web-app', false);

    await logSecurityEvent({
      event_type: 'attack_attempt',
      severity: attackDetection.confidence > 0.8 ? 'high' : 'medium',
      source_ip: clientIP,
      request_path: path,
      request_method: method,
      attack_pattern: attackDetection.pattern,
      confidence_score: attackDetection.confidence,
      metadata: {
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    return new NextResponse('Bad request', { status: 400 });
  }

  // Add security headers
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Content Security Policy (restrictive)
  response.headers.set('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co https://*.daily.co; " +
    "frame-src 'self' https://*.daily.co; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );

  // Update circuit breaker on success
  updateCircuitBreaker('web-app', true);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (health check endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
