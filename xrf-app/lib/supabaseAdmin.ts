import { createClient } from "@supabase/supabase-js";

// Cliente apenas para uso no servidor (API routes). Usa a service role key
// e opera exclusivamente no schema "xrf", dedicado a este app.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nao configuradas");
  }

  return createClient(url, serviceRoleKey, {
    db: { schema: "xrf" },
    auth: { persistSession: false },
  });
}
