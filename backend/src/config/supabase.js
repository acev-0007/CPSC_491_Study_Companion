import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in backend/.env"
  );
}

const authOptions = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
};

export function createSupabaseClient() {
  return createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: authOptions,
    }
  );
}

export function createUserSupabaseClient(accessToken) {
  return createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: authOptions,

      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Privileged server-only client. Never expose this key in frontend code,
// responses, logs, or a VITE_ environment variable.
export function createServiceRoleSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  return createClient(supabaseUrl, key, { auth: authOptions });
}
