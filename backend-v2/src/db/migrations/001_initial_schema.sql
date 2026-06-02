-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop old tables if exist
DROP TABLE IF EXISTS automation_logs;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS shops;

-- Shops table
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id),
    customer_email VARCHAR(255),
    order_number VARCHAR(100),
    raw_message TEXT NOT NULL,
    detected_intent VARCHAR(50),
    intent_confidence FLOAT,
    resolution_status VARCHAR(50) DEFAULT 'pending',
    ai_response TEXT,
    response_confidence FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Automation logs table
CREATE TABLE automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id),
    action_taken VARCHAR(100),
    shopify_data_snapshot JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_shop_id ON tickets(shop_id);
CREATE INDEX idx_tickets_customer_email ON tickets(customer_email);
CREATE INDEX idx_automation_logs_ticket_id ON automation_logs(ticket_id);