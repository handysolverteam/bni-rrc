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
});
