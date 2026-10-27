import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Missing Supabase settings. Copy .env.example to .env.local and fill it in.");
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // The session lives on the device, so players stay signed in between launches
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only for web redirects; the app reads no session from a URL
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is open, as Supabase recommends for React Native
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
