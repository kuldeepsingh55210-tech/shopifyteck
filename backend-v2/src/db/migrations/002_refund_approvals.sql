CREATE TABLE IF NOT EXISTS refund_approvals (
  id SERIAL PRIMARY KEY,
  shop_domain VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  amount VARCHAR(50),
  reason TEXT,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_approvals_token ON refund_approvals(token);
CREATE INDEX IF NOT EXISTS idx_refund_approvals_shop_status ON refund_approvals(shop_domain, status);
