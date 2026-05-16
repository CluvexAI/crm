-- DNS Authentication Records Storage
-- Created: 2026-05-08
-- Purpose: Store SPF, DKIM, and DMARC records per domain

CREATE TABLE IF NOT EXISTS dns_settings (
  id SERIAL PRIMARY KEY,
  domain_name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id UUID,
  status VARCHAR(50) DEFAULT 'pending' -- pending, verified, failed
);

CREATE TABLE IF NOT EXISTS dns_records (
  id SERIAL PRIMARY KEY,
  dns_setting_id INT NOT NULL REFERENCES dns_settings(id) ON DELETE CASCADE,
  record_type VARCHAR(50) NOT NULL, -- SPF, DKIM, DMARC
  record_name VARCHAR(255) NOT NULL,
  record_value TEXT NOT NULL,
  ttl INT DEFAULT 3600,
  selector VARCHAR(100), -- For DKIM
  priority INT DEFAULT 10,
  status VARCHAR(50) DEFAULT 'pending', -- pending, verified, invalid, not_found, error
  verified_at TIMESTAMP,
  verification_attempts INT DEFAULT 0,
  last_verification TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dkim_keys (
  id SERIAL PRIMARY KEY,
  dns_setting_id INT NOT NULL REFERENCES dns_settings(id) ON DELETE CASCADE,
  selector VARCHAR(100) NOT NULL,
  private_key TEXT NOT NULL, -- Encrypted
  public_key TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'rsa',
  key_size INT DEFAULT 2048,
  status VARCHAR(50) DEFAULT 'active', -- active, rotated, revoked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP,
  created_by_user_id UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS dns_verification_logs (
  id SERIAL PRIMARY KEY,
  dns_setting_id INT NOT NULL REFERENCES dns_settings(id) ON DELETE CASCADE,
  record_type VARCHAR(50) NOT NULL, -- SPF, DKIM, DMARC
  verification_status VARCHAR(50), -- valid, invalid, not_found, error
  expected_value TEXT,
  actual_value TEXT,
  error_message TEXT,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolver_ip VARCHAR(50),
  response_time_ms INT,
  created_by_user_id UUID
);

CREATE TABLE IF NOT EXISTS dns_propagation_checks (
  id SERIAL PRIMARY KEY,
  dns_setting_id INT NOT NULL REFERENCES dns_settings(id) ON DELETE CASCADE,
  check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  global_propagation_percentage INT DEFAULT 0, -- 0-100
  dns_servers_checked INT DEFAULT 0,
  dns_servers_propagated INT DEFAULT 0,
  notes TEXT
);

-- Indexes for faster queries
CREATE INDEX idx_dns_settings_domain ON dns_settings(domain_name);
CREATE INDEX idx_dns_settings_status ON dns_settings(status);
CREATE INDEX idx_dns_records_setting_id ON dns_records(dns_setting_id);
CREATE INDEX idx_dns_records_type ON dns_records(record_type);
CREATE INDEX idx_dkim_keys_setting_id ON dkim_keys(dns_setting_id);
CREATE INDEX idx_dkim_keys_selector ON dkim_keys(selector);
CREATE INDEX idx_verification_logs_setting_id ON dns_verification_logs(dns_setting_id);
CREATE INDEX idx_verification_logs_timestamp ON dns_verification_logs(verified_at);

-- Views for monitoring and reporting
CREATE VIEW dns_verification_status AS
SELECT 
  ds.domain_name,
  dr.record_type,
  dr.status,
  dr.verified_at,
  COUNT(*) as record_count
FROM dns_settings ds
JOIN dns_records dr ON ds.id = dr.dns_setting_id
GROUP BY ds.domain_name, dr.record_type, dr.status, dr.verified_at;

CREATE VIEW dkim_key_inventory AS
SELECT 
  ds.domain_name,
  dk.selector,
  dk.status,
  dk.algorithm,
  dk.key_size,
  dk.created_at,
  dk.rotated_at
FROM dns_settings ds
JOIN dkim_keys dk ON ds.id = dk.dns_setting_id
ORDER BY ds.domain_name, dk.selector;
