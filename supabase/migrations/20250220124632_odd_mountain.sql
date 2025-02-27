-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- User companies junction table
CREATE TABLE IF NOT EXISTS user_companies (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  no_gps_signal BOOLEAN DEFAULT FALSE,
  end_latitude DOUBLE PRECISION,
  end_longitude DOUBLE PRECISION,
  no_gps_signal_end BOOLEAN DEFAULT FALSE
);

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Form fields table
CREATE TABLE IF NOT EXISTS form_fields (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT CHECK(type IN ('text', 'number', 'date')) NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER NOT NULL
);

-- Form companies junction table
CREATE TABLE IF NOT EXISTS form_companies (
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (form_id, company_id)
);

-- Form responses table
CREATE TABLE IF NOT EXISTS form_responses (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Form field responses table
CREATE TABLE IF NOT EXISTS form_field_responses (
  id SERIAL PRIMARY KEY,
  form_response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('usuario'), ('controlador')
ON CONFLICT (id) DO NOTHING;

-- Insert default admin user
INSERT INTO users (username, password, is_admin)
VALUES ('admin', 'admin123', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Insert regular user
INSERT INTO users (username, password, is_admin)
VALUES ('usuario1', 'user123', FALSE)
ON CONFLICT (username) DO NOTHING;

-- Insert controller user
INSERT INTO users (username, password, is_admin)
VALUES ('controlador1', 'ctrl123', FALSE)
ON CONFLICT (username) DO NOTHING;

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'usuario1' AND r.name = 'usuario'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'controlador1' AND r.name = 'controlador'
ON CONFLICT DO NOTHING;

-- Insert test companies
INSERT INTO companies (name, description) VALUES
  ('AWS', 'Amazon Web Services Cloud Provider'),
  ('Google Cloud', 'Google Cloud Platform Services'),
  ('Azure', 'Microsoft Azure Cloud Services')
ON CONFLICT DO NOTHING;

-- Assign companies to usuario1
INSERT INTO user_companies (user_id, company_id)
SELECT u.id, c.id
FROM users u, companies c
WHERE u.username = 'usuario1'
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_company_id ON visits(company_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_visit_id ON form_responses(visit_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_user_id ON form_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_field_responses_form_response_id ON form_field_responses(form_response_id);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_responses_updated_at
    BEFORE UPDATE ON form_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();