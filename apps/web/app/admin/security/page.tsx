'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  Settings,
  Bell,
  Eye,
  Lock,
  Zap,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface SecurityStats {
  totalEvents: number;
  activeAlerts: number;
  criticalAlerts: number;
  attackAttemptsToday: number;
  rateLimitHitsToday: number;
  circuitBreakerTripsToday: number;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  source_ip: string;
  request_path: string;
  attack_pattern?: string;
  confidence_score?: number;
  created_at: string;
}

interface SecurityAlert {
  id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/security?action=stats&range=24h');
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch security stats:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/security/events?limit=50');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Failed to fetch security events:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/security/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Failed to fetch security alerts:', error);
    }
  };

  const sendTestAlert = async () => {
    try {
      const response = await fetch('/api/security/alerts/test', {
        method: 'POST',
      });
      if (response.ok) {
        alert('Test alert sent successfully!');
        fetchAlerts(); // Refresh alerts
      }
    } catch (error) {
      console.error('Failed to send test alert:', error);
      alert('Failed to send test alert');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchEvents(), fetchAlerts()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchEvents();
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-red-100 text-red-800';
      case 'acknowledged': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-500 animate-pulse" />
          <h2 className="mt-4 text-xl font-semibold">Loading Security Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Security Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage HOTELCRM security in real-time
          </p>
        </div>
        <Button onClick={() => { fetchStats(); fetchEvents(); fetchAlerts(); }} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Security events logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.criticalAlerts || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attack Attempts Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.attackAttemptsToday || 0}</div>
            <p className="text-xs text-muted-foreground">Blocked attacks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Hits</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.rateLimitHitsToday || 0}</div>
            <p className="text-xs text-muted-foreground">Requests blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Security Status
                </CardTitle>
                <CardDescription>Current system protection status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Middleware Active</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">✅ ON</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Attack Detection</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">✅ ON</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rate Limiting</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">✅ ON</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Circuit Breaker</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">✅ ON</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Test security features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={sendTestAlert} variant="outline" className="w-full">
                  <Bell className="h-4 w-4 mr-2" />
                  Send Test Alert
                </Button>
                <Button onClick={() => window.open('/api/security?action=stats&range=1h', '_blank')} variant="outline" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View API Stats
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Security Events
              </CardTitle>
              <CardDescription>Latest security events and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {events.slice(0, 20).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getSeverityColor(event.severity)} text-white`}>
                        {event.severity}
                      </Badge>
                      <div>
                        <p className="font-medium">{event.event_type.replace('_', ' ').toUpperCase()}</p>
                        <p className="text-sm text-gray-500">
                          {event.source_ip} → {event.request_path}
                        </p>
                        {event.attack_pattern && (
                          <p className="text-xs text-red-600">
                            Pattern: {event.attack_pattern}
                            {event.confidence_score && ` (${Math.round(event.confidence_score * 100)}% confidence)`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No security events in the last 24 hours</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Alerts
              </CardTitle>
              <CardDescription>Active and recent security alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(alert.status)}>
                          {alert.status}
                        </Badge>
                        <Badge className={`${getSeverityColor(alert.severity)} text-white`}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                    <p className="text-xs text-gray-400 mt-2">Type: {alert.alert_type}</p>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active security alerts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Security Configuration
              </CardTitle>
              <CardDescription>Current security system settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Rate Limiting</h3>
                    <p className="text-sm text-gray-600">100 requests per 15 minutes</p>
                    <p className="text-sm text-gray-600">1 hour block duration</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Circuit Breaker</h3>
                    <p className="text-sm text-gray-600">10 failure threshold</p>
                    <p className="text-sm text-gray-600">60 second timeout</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Attack Detection</h3>
                    <p className="text-sm text-gray-600">RSC deserialization</p>
                    <p className="text-sm text-gray-600">Flight protocol abuse</p>
                    <p className="text-sm text-gray-600">SQL injection patterns</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Notifications</h3>
                    <p className="text-sm text-gray-600">Email alerts enabled</p>
                    <p className="text-sm text-gray-600">Daily reports at 08:00</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
