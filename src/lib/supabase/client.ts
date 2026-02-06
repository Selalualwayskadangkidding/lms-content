import { createBrowserClient } from "@supabase/ssr";

// Permanent: disable auto refresh/persist to avoid refresh-token loop in browser.
const client = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export function createClient() {
  return client;
}
