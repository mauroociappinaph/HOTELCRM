import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'HOTELCRM Web App',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'HOTELCRM Web App',
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}

export async function GET_DETAILED() {
  try {
    const memoryUsage = process.memoryUsage();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'HOTELCRM Web App',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      memory: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
      build: {
        nextVersion: process.env.NEXT_RUNTIME || 'unknown',
        buildId: process.env.NEXT_BUILD_ID || 'unknown',
      },
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'HOTELCRM Web App',
        error: 'Detailed health check failed',
      },
      { status: 500 }
    );
  }
}
