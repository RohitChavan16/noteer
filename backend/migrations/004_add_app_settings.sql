-- Migration: Add app_settings table for runtime configuration
-- This allows OIDC settings to be configured via Admin Panel instead of env vars

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Insert default empty OIDC settings
INSERT INTO app_settings (key, value) VALUES 
  ('oidc_issuer_url', ''),
  ('oidc_client_id', ''),
  ('oidc_client_secret', '')
ON CONFLICT (key) DO NOTHING;
