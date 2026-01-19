// Mock environment variables for testing
(process.env as any).NODE_ENV = 'test';
(process.env as any).STRIPE_SECRET_KEY = 'sk_test_mock_key';
(process.env as any).STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
(process.env as any).SUPABASE_URL = 'https://mock.supabase.co';
(process.env as any).SUPABASE_ANON_KEY = 'mock-anon-key';
(process.env as any).SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Global test timeout
jest.setTimeout(30000);
