import { createClient } from "@supabase/supabase-js";

// Load configuration with mock fallbacks for safe local development
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export interface UserProfile {
  id: string;
  email: string;
  is_premium: boolean;
  settings: {
    theme: "light" | "dark" | "system";
    notificationsEnabled: boolean;
    favoriteModes: string[];
  };
}

export interface SavedStation {
  id: string;
  station_id: string;
  alias?: string;
  created_at: string;
}

export interface SavedTrip {
  id: string;
  origin_station_id: string;
  destination_station_id: string;
  alias?: string;
  created_at: string;
}
