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

  it("stores traffic-light report windows separately from the ending month", () => {
    const sql = readFileSync("supabase/migrations/009_traffic_light_report_windows.sql", "utf8").toLowerCase();

    expect(sql).toContain("alter table public.member_traffic_lights");
    expect(sql).toContain("add column report_window_start date");
    expect(sql).toContain("add column report_window_end date");
  });
});
