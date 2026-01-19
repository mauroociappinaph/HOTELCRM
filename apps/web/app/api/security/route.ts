import { NextResponse } from 'next/server';

// GET /api/security - Get security statistics
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    // Import security monitor dynamically
    const { securityMonitor } = await import('../../../lib/security-monitor');

    if (action === 'stats') {
      const timeRange = searchParams.get('range') || '24h';
      const stats = await securityMonitor.getSecurityStats(timeRange as '1h' | '24h' | '7d');

      return NextResponse.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'start-monitoring') {
      securityMonitor.startMonitoring();
      return NextResponse.json({
        success: true,
        message: 'Security monitoring started',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'stop-monitoring') {
      securityMonitor.stopMonitoring();
      return NextResponse.json({
        success: true,
        message: 'Security monitoring stopped',
        timestamp: new Date().toISOString()
      });
    }

    // Default: return basic security status
    return NextResponse.json({
      success: true,
      data: {
        status: 'operational',
        nextjs_vulnerabilities: {
          cve_2025_55184: 'patched',
          cve_2025_55183: 'patched',
          version: '14.2.35'
        },
        security_features: [
          'rate_limiting',
          'circuit_breaker',
          'attack_detection',
          'security_headers',
          'content_security_policy'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[SECURITY API ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Security API error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
