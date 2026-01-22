import { readFileSync } from 'fs';
import { join } from 'path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

describe('Database Migrations', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer()
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .withExposedPorts(5432)
      .start();

    // Connect to the database
    client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
    });

    await client.connect();
  }, 60000); // 60 seconds timeout for container startup

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  describe('Migration 001: Create Tables', () => {
    it('should create all core tables successfully', async () => {
      // Arrange
      const migrationPath = join(process.cwd(), '../../supabase/migrations/001_create_tables.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check all tables exist
      const tables = [
        'agencies',
        'profiles',
        'clients',
        'itineraries',
        'bookings',
        'document_sections',
      ];

      for (const tableName of tables) {
        const result = await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `,
          [tableName],
        );

        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should create tables with correct column types and constraints', async () => {
      // Arrange
      const migrationPath = join(process.cwd(), '../../supabase/migrations/001_create_tables.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check agencies table structure
      const agencyColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'agencies'
        ORDER BY ordinal_position;
      `);

      expect(agencyColumns.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            column_name: 'id',
            data_type: 'uuid',
            is_nullable: 'NO',
          }),
          expect.objectContaining({
            column_name: 'name',
            data_type: 'character varying',
            is_nullable: 'NO',
          }),
          expect.objectContaining({
            column_name: 'tax_id',
            data_type: 'character varying',
            is_nullable: 'NO',
          }),
        ]),
      );

      // Check unique constraint on tax_id
      const taxIdConstraint = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'agencies'
        AND constraint_type = 'UNIQUE';
      `);

      expect(taxIdConstraint.rows.some((row) => row.constraint_name.includes('tax_id'))).toBe(true);
    });

    it('should create foreign key relationships correctly', async () => {
      // Arrange
      const migrationPath = join(process.cwd(), '../../supabase/migrations/001_create_tables.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check foreign key constraints
      const foreignKeys = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
      `);

      // Check profiles -> agencies relationship
      expect(foreignKeys.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: 'profiles',
            column_name: 'agency_id',
            foreign_table_name: 'agencies',
            foreign_column_name: 'id',
          }),
        ]),
      );

      // Check clients -> agencies relationship
      expect(foreignKeys.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: 'clients',
            column_name: 'agency_id',
            foreign_table_name: 'agencies',
            foreign_column_name: 'id',
          }),
        ]),
      );
    });
  });

  describe('Migration 004: Payments & Stripe Integration', () => {
    it('should create all payment-related tables', async () => {
      // Arrange
      // First run the base migration
      const baseMigrationPath = join(
        process.cwd(),
        '../../supabase/migrations/001_create_tables.sql',
      );
      const baseMigrationSQL = readFileSync(baseMigrationPath, 'utf8');
      await client.query(baseMigrationSQL);

      // Then run the payments migration
      const migrationPath = join(
        process.cwd(),
        '../../supabase/migrations/004_payments_stripe_integration.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check payment tables exist
      const paymentTables = [
        'subscription_plans',
        'stripe_customers',
        'subscriptions',
        'payments',
        'stripe_webhook_events',
        'invoices',
        'usage_records',
        'coupons',
      ];

      for (const tableName of paymentTables) {
        const result = await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `,
          [tableName],
        );

        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should create subscription_plans with correct structure and data', async () => {
      // Arrange
      const baseMigrationPath = join(
        process.cwd(),
        '../../supabase/migrations/001_create_tables.sql',
      );
      const baseMigrationSQL = readFileSync(baseMigrationPath, 'utf8');
      await client.query(baseMigrationSQL);

      const migrationPath = join(
        process.cwd(),
        '../../supabase/migrations/004_payments_stripe_integration.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check subscription plans data
      const plans = await client.query('SELECT * FROM subscription_plans ORDER BY price_cents;');

      expect(plans.rows).toHaveLength(3);
      expect(plans.rows[0]).toMatchObject({
        name: 'Hotel Basic',
        price_cents: 2999,
        currency: 'usd',
        interval: 'month',
      });
      expect(plans.rows[1]).toMatchObject({
        name: 'Hotel Pro',
        price_cents: 5999,
        currency: 'usd',
        interval: 'month',
      });
      expect(plans.rows[2]).toMatchObject({
        name: 'Hotel Enterprise',
        price_cents: 14999,
        currency: 'usd',
        interval: 'month',
      });
    });

    it('should create proper indexes for performance', async () => {
      // Arrange
      const baseMigrationPath = join(
        process.cwd(),
        '../../supabase/migrations/001_create_tables.sql',
      );
      const baseMigrationSQL = readFileSync(baseMigrationPath, 'utf8');
      await client.query(baseMigrationSQL);

      const migrationPath = join(
        process.cwd(),
        '../../supabase/migrations/004_payments_stripe_integration.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check indexes exist
      const indexes = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('subscription_plans', 'stripe_customers', 'subscriptions', 'payments', 'invoices');
      `);

      const indexNames = indexes.rows.map((row) => row.indexname);

      // Check for key performance indexes
      expect(indexNames).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/idx_subscription_plans_active/),
          expect.stringMatching(/idx_stripe_customers_user_id/),
          expect.stringMatching(/idx_subscriptions_user_id/),
          expect.stringMatching(/idx_payments_user_id/),
          expect.stringMatching(/idx_invoices_user_id/),
        ]),
      );
    });

    it('should enable Row Level Security on all payment tables', async () => {
      // Arrange
      const baseMigrationPath = join(
        process.cwd(),
        '../../supabase/migrations/001_create_tables.sql',
      );
      const baseMigrationSQL = readFileSync(baseMigrationPath, 'utf8');
      await client.query(baseMigrationSQL);

      const migrationPath = join(
        process.cwd(),
        '../../supabase/migrations/004_payments_stripe_integration.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check RLS is enabled
      const rlsTables = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND rowsecurity = true
        AND tablename IN ('subscription_plans', 'stripe_customers', 'subscriptions', 'payments', 'invoices', 'coupons');
      `);

      const rlsEnabledTables = rlsTables.rows.map((row) => row.tablename);

      expect(rlsEnabledTables).toEqual(
        expect.arrayContaining([
          'subscription_plans',
          'stripe_customers',
          'subscriptions',
          'payments',
          'invoices',
          'coupons',
        ]),
      );
    });

    it('should create coupon with correct data', async () => {
      // Arrange
      const baseMigrationPath = join(
        process.cwd(),
        '../../supabase/migrations/001_create_tables.sql',
      );
      const baseMigrationSQL = readFileSync(baseMigrationPath, 'utf8');
      await client.query(baseMigrationSQL);

      const migrationPath = join(
        process.cwd(),
        '../../supabase/migrations/004_payments_stripe_integration.sql',
      );
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Act
      await client.query(migrationSQL);

      // Assert - Check coupon data
      const coupons = await client.query('SELECT * FROM coupons WHERE code = $1;', ['WELCOME20']);

      expect(coupons.rows).toHaveLength(1);
      expect(coupons.rows[0]).toMatchObject({
        code: 'WELCOME20',
        name: 'Descuento de bienvenida',
        discount_type: 'percent',
        discount_value: 20,
        max_redemptions: 1000,
        redemptions_count: 0,
        is_active: true,
      });
    });
  });

  describe('Migration 006: Security Admin Setup', () => {
    it('should create security-related tables and functions', async () => {
      // Arrange
      // Run all prerequisite migrations
      const migrations = [
        '001_create_tables.sql',
        '004_payments_stripe_integration.sql',
        '006_security_admin_setup.sql',
      ];

      for (const migrationFile of migrations) {
        const migrationPath = join(process.cwd(), `../../supabase/migrations/${migrationFile}`);
        const migrationSQL = readFileSync(migrationPath, 'utf8');
        await client.query(migrationSQL);
      }

      // Assert - Check security tables exist
      const securityTables = ['security_events', 'admin_users', 'security_alerts', 'audit_logs'];

      for (const tableName of securityTables) {
        const result = await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `,
          [tableName],
        );

        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should create database functions and triggers', async () => {
      // Arrange
      const migrations = [
        '001_create_tables.sql',
        '004_payments_stripe_integration.sql',
        '006_security_admin_setup.sql',
      ];

      for (const migrationFile of migrations) {
        const migrationPath = join(process.cwd(), `../../supabase/migrations/${migrationFile}`);
        const migrationSQL = readFileSync(migrationPath, 'utf8');
        await client.query(migrationSQL);
      }

      // Assert - Check functions exist
      const functions = await client.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION';
      `);

      const functionNames = functions.rows.map((row) => row.routine_name);

      expect(functionNames).toEqual(
        expect.arrayContaining(['update_updated_at_column', 'handle_subscription_status_change']),
      );

      // Check triggers exist
      const triggers = await client.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = 'public';
      `);

      const triggerNames = triggers.rows.map((row) => row.trigger_name);

      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_subscription_plans_updated_at',
          'subscription_status_change_trigger',
        ]),
      );
    });
  });

  describe('Migration Rollback Safety', () => {
    it('should handle partial migration failures gracefully', async () => {
      // This test verifies that migrations can be safely rolled back
      // if something goes wrong midway through

      // Arrange - Create a table first
      await client.query('CREATE TABLE test_table (id SERIAL PRIMARY KEY, name TEXT);');

      // Act - Try to run a migration that might fail
      try {
        // Simulate a migration that creates a table that already exists
        await client.query('CREATE TABLE agencies (id UUID PRIMARY KEY);');
        fail('Migration should have failed due to existing table');
      } catch (error) {
        // Assert - Error should be caught and handled
        expect(error.message).toContain('already exists');
      }

      // Verify the test table still exists (rollback didn't affect it)
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'test_table'
        );
      `);

      expect(result.rows[0].exists).toBe(true);
    });
  });
});
