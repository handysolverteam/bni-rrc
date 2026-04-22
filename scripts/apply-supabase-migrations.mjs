import { spawnSync } from "node:child_process";

function log(message) {
  process.stdout.write(`${message}\n`);
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

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "db", "push", "--db-url", dbUrl, "--include-all"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  fail(`Unable to run Supabase migrations: ${result.error.message}`);
}

log("Supabase migrations applied successfully.");
