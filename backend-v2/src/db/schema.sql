-- Drop tables if they exist (in reverse order due to foreign keys)
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Shops table
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_email VARCHAR(255),
    order_number VARCHAR(100),
    raw_message TEXT NOT NULL,
    detected_intent VARCHAR(100),
    intent_confidence FLOAT,
    resolution_status VARCHAR(50) DEFAULT 'pending',
    ai_response TEXT,
    response_confidence FLOAT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Automation logs table
CREATE TABLE automation_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    action_taken VARCHAR(100),
    shopify_data_snapshot TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks table (track registered webhooks per shop)
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    webhook_id BIGINT UNIQUE,
    topic VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table (store webhook order data)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shopify_order_id BIGINT,
    order_number VARCHAR(100),
    customer_email VARCHAR(255),
    total_price DECIMAL(10, 2),
    financial_status VARCHAR(50),
    fulfillment_status VARCHAR(50),
    order_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_shop_id ON tickets(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_ticket_id ON automation_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_shop_id ON webhooks(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON orders(shopify_order_id);

-- Customer Memory table
CREATE TABLE IF NOT EXISTS customer_memory (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    total_orders INTEGER DEFAULT 0,
    total_tickets INTEGER DEFAULT 0,
    refund_request_count INTEGER DEFAULT 0,
    refund_approved_count INTEGER DEFAULT 0,
    sentiment_score FLOAT DEFAULT 0.5,
    is_vip BOOLEAN DEFAULT false,
    language_preference VARCHAR(50) DEFAULT 'english',
    last_seen_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(shop_domain, customer_email)
);

-- Conversation History table
CREATE TABLE IF NOT EXISTS conversation_history (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    message TEXT,
    intent VARCHAR(100),
    sentiment VARCHAR(50),
    resolution VARCHAR(100),
    ai_response TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reasoning Logs table
CREATE TABLE IF NOT EXISTS reasoning_logs (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255),
    customer_email VARCHAR(255),
    ticket_id INTEGER,
    intent VARCHAR(100),
    sentiment VARCHAR(50),
    escalation_probability INTEGER,
    decision VARCHAR(100),
    reasoning_summary TEXT,
    fraud_flag BOOLEAN DEFAULT false,
    refund_eligible VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255),
    customer_email VARCHAR(255),
    ticket_id INTEGER,
    action_type VARCHAR(100),
    action_data JSONB,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_queue (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255),
    ticket_id INTEGER,
    customer_email VARCHAR(255),
    reason TEXT,
    priority VARCHAR(50) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to VARCHAR(255),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discount_codes (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255),
    customer_email VARCHAR(255),
    discount_code VARCHAR(255),
    discount_percent INTEGER,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_settings (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    auto_resolve BOOLEAN DEFAULT true,
    escalate_angry BOOLEAN DEFAULT true,
    fraud_detection BOOLEAN DEFAULT true,
    vip_detection BOOLEAN DEFAULT true,
    escalation_threshold INTEGER DEFAULT 60,
    fraud_refund_limit INTEGER DEFAULT 3,
    min_confidence INTEGER DEFAULT 50,
    email_notifications BOOLEAN DEFAULT false,
    notification_email VARCHAR(255),
    discount_enabled BOOLEAN DEFAULT false,
    discount_percent INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Update legacy float values to proper integers
UPDATE merchant_settings 
SET escalation_threshold = 60 
WHERE escalation_threshold < 1;


-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Merchant knowledge base table
CREATE TABLE IF NOT EXISTS merchant_knowledge_base (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding vector(768),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast vector search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON merchant_knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS knowledge_base_shop_idx 
ON merchant_knowledge_base(shop_domain);

CREATE TABLE IF NOT EXISTS csat_ratings (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) NOT NULL,
    ticket_id INTEGER,
    customer_email VARCHAR(255),
    rating INTEGER CHECK (rating IN (1, -1)),
    feedback TEXT,
    intent VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canned_responses (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    intent VARCHAR(100),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_states (
    id SERIAL PRIMARY KEY,
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
