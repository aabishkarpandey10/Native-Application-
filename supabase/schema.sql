-- Sydney Transit Supabase Schema Setup
-- Relational tables for users, transit structures, and favorite customizations

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE NOT NULL,
    settings JSONB DEFAULT '{"theme": "system", "notificationsEnabled": true, "favoriteModes": ["train", "metro", "bus", "lightrail", "ferry"]}'::jsonb NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.users FOR UPDATE 
    USING (auth.uid() = id);

-- Trigger to automatically create a user profile when a new user signs up in auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (new.id, new.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. STATIONS / STOPS
CREATE TABLE IF NOT EXISTS public.stations (
    id TEXT PRIMARY KEY, -- GTFS stop_id
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    mode TEXT NOT NULL, -- 'train', 'metro', 'bus', 'lightrail', 'ferry'
    parent_station TEXT, -- GTFS parent_station
    platform_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stations" ON public.stations FOR SELECT USING (true);

-- 4. SAVED STATIONS (FAVORITES)
CREATE TABLE IF NOT EXISTS public.saved_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    station_id TEXT REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
    alias TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, station_id)
);

ALTER TABLE public.saved_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their saved stations" 
    ON public.saved_stations FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their saved stations" 
    ON public.saved_stations FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved stations" 
    ON public.saved_stations FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved stations" 
    ON public.saved_stations FOR DELETE 
    USING (auth.uid() = user_id);

-- 5. SAVED TRIPS
CREATE TABLE IF NOT EXISTS public.saved_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    origin_station_id TEXT REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
    destination_station_id TEXT REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
    alias TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, origin_station_id, destination_station_id)
);

ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their saved trips" 
    ON public.saved_trips FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their saved trips" 
    ON public.saved_trips FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved trips" 
    ON public.saved_trips FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved trips" 
    ON public.saved_trips FOR DELETE 
    USING (auth.uid() = user_id);

-- 6. ALERTS & NOTIFICATIONS CACHE
CREATE TABLE IF NOT EXISTS public.alerts_cache (
    id TEXT PRIMARY KEY, -- Alert identifier
    title TEXT NOT NULL,
    description TEXT,
    affected_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    severity TEXT NOT NULL DEFAULT 'warning',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.alerts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view cached alerts" ON public.alerts_cache FOR SELECT USING (true);

-- 7. PUSH NOTIFICATIONS SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.notifications_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    expo_push_token TEXT NOT NULL,
    commute_alerts_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    subscribed_routes TEXT[] DEFAULT '{}'::text[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, expo_push_token)
);

ALTER TABLE public.notifications_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their notifications configuration"
    ON public.notifications_config
    USING (auth.uid() = user_id);
