import { pool } from '../db';

const setupDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting database migrations...');
    await client.query('BEGIN');

    // Enable pgcrypto for uuid generation
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Enums
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE detected_intent_t AS ENUM ('order_status', 'refund', 'policy', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE resolution_status_t AS ENUM ('auto_resolved', 'escalated', 'pending');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 1. Shops Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_domain VARCHAR UNIQUE NOT NULL,
        access_token VARCHAR,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);

    // 2. Tickets Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
        customer_email VARCHAR,
        order_number VARCHAR,
        raw_message TEXT,
        detected_intent detected_intent_t,
        intent_confidence FLOAT,
        resolution_status resolution_status_t DEFAULT 'pending',
        ai_response TEXT,
        response_confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // 3. Automation Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
        action_taken VARCHAR,
        shopify_data_snapshot JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_shop_id ON tickets(shop_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_customer_email ON tickets(customer_email);`);

    await client.query('COMMIT');
    console.log('Migrations completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
};

setupDatabase();
