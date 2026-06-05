-- Extended schema: analytics, vehicle positions, routes, timetables
-- Applied after schema.sql in docker-compose.full.yml

-- ROUTES
CREATE TABLE IF NOT EXISTS public.routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    color TEXT,
    agency_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_mode ON public.routes(mode);

-- ROUTE STOPS (ordered sequence)
CREATE TABLE IF NOT EXISTS public.route_stops (
    route_id TEXT REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    stop_id TEXT REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
    sequence INTEGER NOT NULL,
    PRIMARY KEY (route_id, stop_id)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops(route_id, sequence);

-- TIMETABLES (static schedule cache)
CREATE TABLE IF NOT EXISTS public.timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stop_id TEXT REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
    route_id TEXT REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIME NOT NULL,
    day_type TEXT NOT NULL DEFAULT 'weekday',
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timetables_stop_day ON public.timetables(stop_id, day_type, departure_time);

-- VEHICLE POSITIONS (partitioned by date)
CREATE TABLE IF NOT EXISTS public.vehicle_positions (
    id UUID DEFAULT uuid_generate_v4(),
    vehicle_id TEXT NOT NULL,
    route_id TEXT,
    stop_id TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    bearing REAL,
    speed_kmh REAL,
    occupancy_status TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE IF NOT EXISTS public.vehicle_positions_default
    PARTITION OF public.vehicle_positions DEFAULT;

CREATE INDEX IF NOT EXISTS idx_vehicle_positions_route_time
    ON public.vehicle_positions(route_id, recorded_at DESC);

-- ANALYTICS EVENTS
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    session_id TEXT,
    platform TEXT,
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_type_time
    ON public.analytics_events(user_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_created
    ON public.analytics_events(created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own analytics"
    ON public.analytics_events FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON public.audit_log(user_id, created_at DESC);

-- GEO INDEX on stations
CREATE INDEX IF NOT EXISTS idx_stations_geo ON public.stations USING gist (
    ll_to_earth(lat, lon)
);
