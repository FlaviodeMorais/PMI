import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// parse .env.local manually
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  db: { schema: "xrf" },
  auth: { persistSession: false },
});

// count before
const { count: before } = await supabase.from("readings").select("*", { count: "exact", head: true });
console.log(`Registros antes: ${before}`);

// truncate via rpc (TRUNCATE ... RESTART IDENTITY needs raw SQL)
const { error } = await supabase.rpc("truncate_readings");

if (error) {
  // fallback: delete all rows
  console.log("RPC não disponível, usando DELETE...");
  const { error: delError, count: deleted } = await supabase
    .from("readings")
    .delete({ count: "exact" })
    .neq("id", 0); // match all rows

  if (delError) {
    console.error("Erro ao deletar:", delError.message);
    process.exit(1);
  }
  console.log(`✓ ${deleted} registros removidos via DELETE.`);
} else {
  console.log("✓ Tabela truncada via RPC.");
}

// count after
const { count: after } = await supabase.from("readings").select("*", { count: "exact", head: true });
console.log(`Registros após: ${after}`);
