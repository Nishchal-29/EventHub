-- Event Registration Portal — Database Schema
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Case-insensitive unique email
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    venue VARCHAR(200),
    category VARCHAR(50),
    event_date TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date);

CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    registered_at TIMESTAMPTZ DEFAULT now(),
    cancelled_at TIMESTAMPTZ
);

-- Database-level duplicate guard: only one active registration per user per event.
-- Cancelled rows are kept as history; re-registration inserts a new active row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_registration
    ON registrations (event_id, user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations (event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user_status ON registrations (user_id, status);

-- Brute-force protection
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(150) NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts (ip_address, email, attempted_at);
