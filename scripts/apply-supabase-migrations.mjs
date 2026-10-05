import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function log(message) {
  process.stdout.write(`${message}\n`);
}

// Plain `node` does not load .env files (unlike `next`), so `npm run
// migrate:deploy` never saw .env.local. Fill missing vars from it; real
// environment values (e.g. on Vercel) always win.
try {
  const envLocalPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (existsSync(envLocalPath)) {
    for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
} catch {
  // A broken .env.local must not block deploys that rely on real env vars.
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const shouldSkip =
  process.env.SKIP_DB_MIGRATIONS === "1" ||
  process.env.SKIP_DB_MIGRATIONS === "true";

if (shouldSkip) {
  log("Skipping Supabase migrations because SKIP_DB_MIGRATIONS is enabled.");
  process.exit(0);
}

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  log(
    "Skipping Supabase migrations because SUPABASE_DB_URL is not configured.",
  );
  process.exit(0);
}

log("Applying Supabase migrations with `supabase db push`...");

const isWindows = process.platform === "win32";
const result = spawnSync(
  isWindows ? "npx.cmd" : "npx",
  ["supabase", "db", "push", "--db-url", dbUrl, "--include-all"],
  {
    stdio: "inherit",
    env: process.env,
    // npx.cmd is a batch file: spawning it without a shell throws EINVAL on Windows.
    shell: isWindows,
  },
);

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  fail(`Unable to run Supabase migrations: ${result.error.message}`);
}

log("Supabase migrations applied successfully.");
