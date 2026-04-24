import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schema", () => {
  it("does not store derived stage fields", () => {
    const sql = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8").toLowerCase();

    expect(sql).not.toContain(" stage ");
    expect(sql).not.toContain("mc_discussion_date");
    expect(sql).not.toContain("docs_deadline");
    expect(sql).not.toContain("final_deadline");
  });

  it("stores PALMS lifetime snapshots separately from monthly traffic lights", () => {
    const sql = readFileSync("supabase/migrations/005_member_palms_snapshots.sql", "utf8").toLowerCase();

    expect(sql).toContain("create table public.member_palms_snapshots");
    expect(sql).toContain("unique (member_id, chapter_name, report_from, report_to)");
    expect(sql).toContain("referrals_given_inside");
    expect(sql).toContain("referrals_received_outside");
  });

  it("allows storing member_since for tenure on members", () => {
    const sql = readFileSync("supabase/migrations/006_member_since.sql", "utf8").toLowerCase();

    expect(sql).toContain("alter table public.members");
    expect(sql).toContain("add column member_since date");
  });

  it("stores reusable chapter roles and ordered member past roles", () => {
    const sql = readFileSync("supabase/migrations/007_member_past_roles.sql", "utf8").toLowerCase();

    expect(sql).toContain("create table public.chapter_roles");
    expect(sql).toContain("unique (normalized_name)");
    expect(sql).toContain("create table public.member_past_roles");
    expect(sql).toContain("unique (member_id, role_id)");
    expect(sql).toContain("display_order integer not null default 0");
  });

  it("tracks import source metadata separately on import batches", () => {
    const sql = readFileSync("supabase/migrations/008_import_batches_source_metadata.sql", "utf8").toLowerCase();

    expect(sql).toContain("alter table public.import_batches");
    expect(sql).toContain("add column source_type text not null default 'unknown'");
    expect(sql).toContain("'palms_chapter_summary'");
    expect(sql).toContain("add column source_report_from date");
    expect(sql).toContain("add column source_report_to date");
  });

  it("stores sponsor achievements separately from member profile sponsor text", () => {
    const sql = readFileSync("supabase/migrations/011_member_sponsor_achievements.sql", "utf8").toLowerCase();

    expect(sql).toContain("create table public.member_sponsor_achievements");
    expect(sql).toContain("sponsored_full_name text not null");
    expect(sql).toContain("application_date date not null");
    expect(sql).toContain("unique (member_id, sponsored_full_name, application_date, sponsored_chapter)");
  });

  it("allows sponsor imports as a tracked import batch source type", () => {
    const sql = readFileSync(
      "supabase/migrations/012_import_batches_sponsor_source_type.sql",
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("drop constraint if exists import_batches_source_type_check");
    expect(sql).toContain("'chapter_sponsor_report'");
  });

  it("stores training achievements separately and allows training report imports", () => {
    const sql = readFileSync(
      "supabase/migrations/013_member_training_achievements.sql",
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("create table public.member_training_achievements");
    expect(sql).toContain("unique (member_id, chapter_name, event_date, event_type)");
    expect(sql).toContain("'chapter_member_training_report'");
  });

  it("stores traffic-light report windows separately from the ending month", () => {
    const sql = readFileSync("supabase/migrations/009_traffic_light_report_windows.sql", "utf8").toLowerCase();

    expect(sql).toContain("alter table public.member_traffic_lights");
    expect(sql).toContain("add column report_window_start date");
    expect(sql).toContain("add column report_window_end date");
  });

  it("stores annual renewal workflow separately from the imported term date", () => {
    const sql = readFileSync("supabase/migrations/010_two_year_renewal_terms.sql", "utf8").toLowerCase();

    expect(sql).toContain("alter table public.renewal_cycles");
    expect(sql).toContain("add column reported_due_date date");
    expect(sql).toContain("add column is_two_year_renewal boolean not null default false");
  });
});
