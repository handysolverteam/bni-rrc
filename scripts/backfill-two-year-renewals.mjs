import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function toDateOnly(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateParts(date) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function deriveImportedRenewalCycle(dueDate, referenceYear) {
  const dueParts = parseDateParts(dueDate);

  if (dueParts.year > referenceYear) {
    return {
      renewalYear: referenceYear,
      renewalDate: toDateOnly(referenceYear, dueParts.month, dueParts.day),
      reportedDueDate: dueDate,
      isTwoYearRenewal: true,
    };
  }

  return {
    renewalYear: dueParts.year,
    renewalDate: dueDate,
    reportedDueDate: null,
    isTwoYearRenewal: false,
  };
}

function parseEnvLine(line) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (!match) {
    return null;
  }

  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [match[1], value];
}

function loadDotEnvFile(path) {
  try {
    const file = readFileSync(path, "utf8");

    for (const line of file.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);

      if (!parsed || process.env[parsed[0]]) {
        continue;
      }

      process.env[parsed[0]] = parsed[1];
    }
  } catch {
    return;
  }
}

function getReferenceYear(today = new Date()) {
  return today.getUTCFullYear();
}

function normalizeMemberRelation(value) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function deriveLegacyTwoYearBackfillCandidates(cycles, referenceYear) {
  const cyclesByMember = new Map();

  for (const cycle of cycles) {
    const grouped = cyclesByMember.get(cycle.member_id) ?? [];
    grouped.push(cycle);
    cyclesByMember.set(cycle.member_id, grouped);
  }

  const candidates = [];

  for (const cycle of cycles) {
    if (cycle.reported_due_date || cycle.is_two_year_renewal) {
      continue;
    }

    if (cycle.renewal_year !== referenceYear + 1) {
      continue;
    }

    const derivedCycle = deriveImportedRenewalCycle(cycle.renewal_date, referenceYear);

    if (!derivedCycle.isTwoYearRenewal || derivedCycle.renewalYear === cycle.renewal_year) {
      continue;
    }

    const memberCycles = cyclesByMember.get(cycle.member_id) ?? [];
    const alreadyHasAnnualCycle = memberCycles.some(
      (memberCycle) => memberCycle.id !== cycle.id && memberCycle.renewal_year === derivedCycle.renewalYear,
    );

    if (alreadyHasAnnualCycle) {
      continue;
    }

    const member = normalizeMemberRelation(cycle.members);

    candidates.push({
      id: cycle.id,
      memberId: cycle.member_id,
      memberName: member?.name ?? "Unknown member",
      memberIndustry: member?.industry ?? null,
      previousRenewalYear: cycle.renewal_year,
      previousRenewalDate: cycle.renewal_date,
      nextRenewalYear: derivedCycle.renewalYear,
      nextRenewalDate: derivedCycle.renewalDate,
      reportedDueDate: derivedCycle.reportedDueDate,
    });
  }

  return candidates.sort((left, right) =>
    left.memberName.localeCompare(right.memberName) || left.previousRenewalDate.localeCompare(right.previousRenewalDate),
  );
}

async function createSupabaseClient() {
  await loadDotEnvFile(".env.local");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchRenewalCycles(supabase) {
  const { data, error } = await supabase
    .from("renewal_cycles")
    .select(
      `
      id,
      member_id,
      renewal_year,
      renewal_date,
      reported_due_date,
      is_two_year_renewal,
      members (name, industry)
    `,
    )
    .order("renewal_year", { ascending: true })
    .order("renewal_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function applyCandidates(supabase, candidates) {
  for (const candidate of candidates) {
    const { error } = await supabase
      .from("renewal_cycles")
      .update({
        renewal_year: candidate.nextRenewalYear,
        renewal_date: candidate.nextRenewalDate,
        reported_due_date: candidate.reportedDueDate,
        is_two_year_renewal: true,
      })
      .eq("id", candidate.id);

    if (error) {
      throw error;
    }
  }
}

function logCandidate(candidate) {
  const industry = candidate.memberIndustry ? ` (${candidate.memberIndustry})` : "";
  process.stdout.write(
    `- ${candidate.memberName}${industry}: ${candidate.previousRenewalYear} ${candidate.previousRenewalDate} -> ${candidate.nextRenewalYear} ${candidate.nextRenewalDate}, reported due ${candidate.reportedDueDate}\n`,
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const referenceYearArg = [...args].find((arg) => arg.startsWith("--reference-year="));
  const referenceYear = referenceYearArg
    ? Number(referenceYearArg.split("=")[1])
    : getReferenceYear();

  if (!Number.isInteger(referenceYear)) {
    throw new Error("Reference year must be an integer.");
  }

  const supabase = await createSupabaseClient();
  const cycles = await fetchRenewalCycles(supabase);
  const candidates = deriveLegacyTwoYearBackfillCandidates(cycles, referenceYear);

  process.stdout.write(
    `Found ${candidates.length} legacy 2-year renewal candidate${candidates.length === 1 ? "" : "s"} for reference year ${referenceYear}.\n`,
  );

  for (const candidate of candidates) {
    logCandidate(candidate);
  }

  if (!apply || candidates.length === 0) {
    process.stdout.write(
      apply
        ? "No updates were needed.\n"
        : "Preview only. Re-run with --apply to update these rows.\n",
    );
    return;
  }

  await applyCandidates(supabase, candidates);
  process.stdout.write("Backfill applied successfully.\n");
}

const isDirectRun =
  process.argv[1] &&
  new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
