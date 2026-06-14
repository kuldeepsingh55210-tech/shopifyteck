CREATE TABLE IF NOT EXISTS merchants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
  shop_domain VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
