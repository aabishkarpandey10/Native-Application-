-- TripView Platform — PostgreSQL Production Schema
-- Run via: docker compose -f docker-compose.full.yml up postgres

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS & AUTH
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'operator')),
    is_premium BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{"theme":"system","notificationsEnabled":true}'::jsonb,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- TRANSIT STATIC DATA
CREATE TABLE routes (
    id TEXT PRIMARY KEY,
    route_number TEXT NOT NULL,
    name TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('train','metro','bus','light_rail','ferry')),
    color TEXT,
    operator TEXT DEFAULT 'Transport NSW',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_routes_mode ON routes(mode);

CREATE TABLE stops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    mode TEXT NOT NULL,
    parent_stop_id TEXT REFERENCES stops(id),
    platform_code TEXT,
    wheelchair_accessible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stops_mode ON stops(mode);
CREATE INDEX idx_stops_lat_lon ON stops(lat, lon);

CREATE TABLE route_stops (
    route_id TEXT REFERENCES routes(id) ON DELETE CASCADE,
    stop_id TEXT REFERENCES stops(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    PRIMARY KEY (route_id, stop_id)
);

CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id TEXT REFERENCES routes(id),
    stop_id TEXT REFERENCES stops(id),
    service_id TEXT NOT NULL,
    departure_time TIME NOT NULL,
    day_type TEXT NOT NULL DEFAULT 'weekday',
    valid_from DATE,
    valid_to DATE
);
CREATE INDEX idx_timetables_stop_day ON timetables(stop_id, day_type, departure_time);

-- REAL-TIME (partitioned by day)
CREATE TABLE vehicle_positions (
    id UUID DEFAULT uuid_generate_v4(),
    vehicle_id TEXT NOT NULL,
    route_id TEXT,
    stop_id TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    bearing REAL,
    speed_kmh REAL,
    occupancy TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE vehicle_positions_default PARTITION OF vehicle_positions DEFAULT;

-- USER DATA
CREATE TABLE saved_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    alias TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stop_id)
);
CREATE INDEX idx_saved_stations_user ON saved_stations(user_id);

CREATE TABLE saved_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_stop_id TEXT NOT NULL REFERENCES stops(id),
    destination_stop_id TEXT NOT NULL REFERENCES stops(id),
    alias TEXT,
    preferred_modes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, origin_stop_id, destination_stop_id)
);
CREATE INDEX idx_saved_trips_user ON saved_trips(user_id);

-- ALERTS
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
    affected_routes TEXT[] DEFAULT '{}',
    affected_stops TEXT[] DEFAULT '{}',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    source TEXT DEFAULT 'tfnsw',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_active ON alerts(starts_at, ends_at);

-- PUSH NOTIFICATIONS
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    commute_alerts BOOLEAN DEFAULT TRUE,
    subscribed_routes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, expo_push_token)
);

-- ANALYTICS (partitioned monthly)
CREATE TABLE analytics_events (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    session_id TEXT,
    platform TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name, recorded_at);

-- AUDIT LOG
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    resource TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
