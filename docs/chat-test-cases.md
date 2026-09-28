# Test Case Catalog — Full Suite (278 cases)

Automated suite: **271 passed, 7 conditionally skipped** (`npx vitest run`,
39 files). The 7 skipped (marked ⏭ below) need real report files from local
disk (`C:\Users\rahul\Downloads\...`, absent on most machines) and skip
automatically via `existsSync(...) ? it : it.skip`.

- Part A (this file, sections 1–10): Chapter AI behavior catalog — every chat
  query case, automated in `tests/chat-local-engine.test.ts` (70 tests) and
  `tests/chat-actions.test.ts` (10 tests).
- Part A2 (sections 12–14): chat API routes + Gemini client (20 tests).
- Part B (section 11): every other test file, one row per automated case
  (171 tests, incl. roles route cache + name-normalization + PALMS parser
  robustness + chat timestamp tests). 70 + 10 + 20 + 5 + 3 + 6 + 3 + 154 = 271
  automated; + 7 skipped = 278 total.

Run everything: `npx vitest run`
Run chat only: `npx vitest run tests/chat-local-engine.test.ts tests/chat-actions.test.ts tests/chat-history-routes.test.ts tests/chat-generate-route.test.ts tests/chat-prompt.test.ts`

Conventions (Part A): matching is case-insensitive; trailing `?!.,;:` is
stripped; `(...)` = full member detail reply.

## 1. Member lookup

| # | Query | Expect |
|---|-------|--------|
| 1.1 | `Amit gupta details` (exact full name, one shared part exists) | Record for Amit Gupta (exact wins) |
| 1.2 | `tell me about alice` | Record for Alice |
| 1.3 | `Amit's performance` (possessive) | Record for Amit |
| 1.4 | `amit gupta` (lowercase, extra spaces) | Record for Amit Gupta |
| 1.5 | `Amit Gupta?` (punctuation) | Record for Amit Gupta |
| 1.6 | `kumar` (middle name only) | Record for Amit Kumar Gupta |
| 1.7 | `how is amit doing` (two Amits) | Disambiguation list, no overview |
| 1.8 | `Nikhil verma details` (nobody matches) | "couldn't find a member", directory offer |
| 1.9 | `how am i doing` (signed in as Amit Gupta) | Amit Gupta's record |
| 1.10 | `my renewal status` (signed in as `amit`) | Amit Gupta's record (first-name login works) |
| 1.11 | `my renewal status` (signed in as Stranger X) | "couldn't tell which member you are" |
| 1.12 | `my friend alice details` (self + named) | Alice's record (named wins) |
| 1.13 | `hi alice` | Alice's record (greeting + name) |
| 1.14 | `AMIT   GUPTA`, `Amit Gupta?` | Record (case/space/punctuation tolerant) |
| 1.15 | Long message with the name buried inside | Record via exact full-name hit |
| 1.16 | `dsouza details` (member `Raj D'Souza`) | Record (apostrophes ignored) |
| 1.17 | `Mary-Kate Olsen` | Record (hyphens ignored) |
| 1.18 | Two members both named `Amit Gupta` | Disambiguation list |

## 2. Comparison

| # | Query | Expect |
|---|-------|--------|
| 2.1 | `compare alice and bob` | Side-by-side records |
| 2.2 | `alice vs. bob` | Side-by-side records |
| 2.3 | `alice and bob` | Side-by-side records |
| 2.4 | `Amit Gupta and Rohit Sharma` (two full names) | Side-by-side records |
| 2.5 | `hi, how is amit doing` (two Amits) | Disambiguation, NOT comparison |
| 2.6 | `compare alice and zzz` (one missing) | Alice's record |
| 2.7 | `compare me and alice` (as Amit Gupta) | Side-by-side Amit + Alice |
| 2.8 | `alice versus bob` | Side-by-side records |
| 2.9 | `compare me and amit` (no identity) | Amit's record (graceful fallback) |

## 3. Zones

| # | Query | Expect |
|---|-------|--------|
| 3.1 | `green zone members`, `top performers`, `best members` | Green audit |
| 3.2 | `red members`, `low score`, `lowest score`, `worst member`, `urgent` | Red audit |
| 3.3 | `yellow zone members`, `amber candidates`, `growth` | Amber audit |
| 3.4 | `grey zone`, `gray`, `no score`, `unscored` | Grey audit incl. grey streaks |
| 3.5 | `highest score`, `best score`, `best` | Green audit |
| 3.6 | `zones`, `zone breakdown`, `show traffic lights`, `traffic report` | Zone breakdown + Red attention list |
| 3.7 | `which members slipped from green` | Slipped list with was→now |
| 3.8 | `referral leaders`, `one to one leaders`, `ceu leaders`, `visitor leaders` | Respective leaderboard (metrics beat zone words) |
| 3.9 | Empty green/amber/grey audits | Honest empty text, never a crash |

## 4. Renewals

| # | Query | Expect |
|---|-------|--------|
| 4.1 | `renewals`, `pipeline`, `critical` | Full pipeline, Critical first |
| 4.2 | `payment pending members`, `critical deadline` | Only that stage |
| 4.3 | `pending documents` (reversed) | Documents Pending stage |
| 4.4 | `renewed members` / `dropped members` (outside work window) | Listed via cycle status |
| 4.5 | `2-year renewal term` | 2-year list or honest empty |
| 4.6 | `overdue renewals` | Past-due, live cycles only |
| 4.7 | `due in the next 30 days`, `due in 2 weeks` | Windowed list |
| 4.8 | `renewals due tomorrow` / `due today` | 1-day window list |
| 4.9 | `open tasks`, `tasks`, `show all tasks`, `task list` | Open-tasks leaderboard |
| 4.10 | `tasks due this week` | Due-window list (not leaderboard) |
| 4.11 | `mc discussion members` vs `member discussion` | Each stage lists only its own members |
| 4.12 | `tell me about renewals`, `payment status` | Full pipeline |
| 4.13 | `list/show/all members`, `members` | Full directory |
| 4.14 | `upcoming renewals`, `due in the next 2 weeks` | Windowed lists |
| 4.15 | Renewal dated today | Upcoming (`due today`), NOT overdue |
| 4.16 | Empty tasks/overdue/2-year states | Honest empty text |

## 5. Performance

| # | Query | Expect |
|---|-------|--------|
| 5.1 | `business leaders`, `tyfcb`, `revenue` | TYFCB leaders + total (never Green) |
| 5.2 | `who passed the most referrals` | Ranked by given |
| 5.3 | `who received the most referrals` | Ranked by received |
| 5.4 | `who gave zero referrals` | Zero-given list |
| 5.5 | `referrals last month` | Monthly snapshot or honest empty |
| 5.6 | `referrals`, `top 121` | Respective leaders |
| 5.7 | All-zero TYFCB / 1-to-1 data | Honest empty text |
| 5.6 | `most 1-to-1s` / `who has zero 1-to-1s` | Leaders / zero list |
| 5.7 | `top ceu` / `members with zero ceu` | Leaders / zero list |
| 5.8 | `who brought the most visitors` / `who brought no visitors` | Leaders / zero list |

## 6. Tenure

| # | Query | Expect |
|---|-------|--------|
| 6.1 | `newest members`, `recent joiners`, `new join` | Newest first |
| 6.2 | `oldest members`, `longest tenure` | Longest-tenured first |
| 6.3 | `members joined in 2020` | Only 2020 joiners |
| 6.4 | No join dates on record | Honest empty, no crash |
| 6.5 | `members joined in 1999` (nobody) | Honest empty with the year |
| 6.6 | `...joining date in ascending order` / `newest first` | Oldest-first / newest-first sort |

## 7. Roles & achievements

| # | Query | Expect |
|---|-------|--------|
| 7.1 | `who held the secretary role` | Holders (past or current) |
| 7.2 | `who was the vice president` | Titled "Vice President experience" |
| 7.3 | `who is the current president` | Current holder only |
| 7.4 | `committee members`, `roles` | Committee list |
| 7.5 | `top sponsors`, `trainings`, `achievements` | Sponsorship/training leaders |

## 8. Conversation & safety

| # | Query | Expect |
|---|-------|--------|
| 8.1 | `hi`, `hello`, `good morning`, `hey there`, `help`, `what can you do`, `who are you`, `main menu`, `assist me` | Capabilities menu |
| 8.2 | `thanks` / `bye` | Courteous reply, not overview |
| 8.3 | `help me find red members` | Red audit (content beats greeting) |
| 8.4 | `what is alice's phone number` | Privacy refusal, no contact data |
| 8.5 | `what's the weather?` | Generic overview + counter-question |
| 8.6 | `members?`, `""`, `???` | Directory / overview, no crash |
| 8.7 | Empty member directory | Overview with 0 counts, no crash |
| 8.8 | `my renewal status` signed in as `Member` / two-Amits as `Amit` | "couldn't tell" (no placeholder leak) / "matches several members" |
| 8.9 | `am i in the red zone` (as green Amit) | Own record showing the green zone |
| 8.10 | `yes` (bare acknowledgement) | Overview (stateless limitation, documented) |
| 8.11 | History reload in IST (or any non-UTC zone) | Local times, never server UTC |
| 8.11 | Regenerate with the offline engine (identical reply) | Same text + honesty note, never a silent repeat |
| 8.12 | Message over 2000 chars (generate) / 100k chars (history save) | 400 "Message is too long" |

## 12. Chat history privacy (per-user scoping)

`ai_chat_messages` carries `user_id` (migration `018_ai_chat_user_scope.sql`).
Every route scopes to the caller, so no user can read, add to, or wipe
another user's sessions. Automated in `tests/chat-history-routes.test.ts`.

| # | Case | Expect |
|---|------|--------|
| 12.1 | GET history | Filters by caller `user_id` + `sessionId`; corrupt stored options → `[]`; missing `sessionId` → 400 |
| 12.2 | POST history | Stamps caller `user_id`; rejects bad sender / empty / >100k chars; long AI replies (directories, audits) save fine |
| 12.3 | DELETE history | Always scoped to caller (single session or clear-all) |
| 12.4 | GET sessions | Only the caller's sessions; user-less sessions hidden |
| 12.5 | No bearer token | 401 on all four endpoints |

## 13. Generate route wiring (`tests/chat-generate-route.test.ts`)

401 without token; 400 on missing/oversized message; action path returns
`source: "action"` without the engine; Gemini text preferred with
`source: "gemini"` when the model answers; signed-in name reaches the local
engine (`my renewal status` → own record); identical local regeneration gets
the honesty note.

## 14. Gemini client (`tests/chat-prompt.test.ts`)

Null without a key; key sent as header only (never in the URL); history
capped to last 10 turns × 1500 chars; display-name newlines stripped;
`**bold**` cleaned; null when every model fails or throws.

## 9. Quick actions (`resolveOptionAction`)

MAIN_MENU, ZONE_MENU (4 zones + main), QUERY_PIPELINE, STAGE_MENU (7 stages),
QUERY_STAGE (valid lists / unknown → "No members"), QUERY_ZONE (each zone sorted;
unknown zone → zone menu, never a mislabeled audit), QUERY_EXEC (totals),
QUERY_TYFCB (leaders / honest empty), QUERY_COMMITTEE (list / honest empty),
COMPARE_MEMBERS (side-by-side / "Could not match"), unknown action → menu.

## 10. Known limitations (by design)

- Stateless: `yes`/`no`/`him`/`her` alone cannot resolve; the reply always says
  what to send next.
- Hindi/Hinglish grammar is not parsed, but name substrings still match
  (`Amit Gupta ka renewal` finds Amit Gupta).
- No data sources, so no answers, for: attendance, birthdays, meetings/events,
  goals, contact details (privacy), bare `top N` rankings.
- `my ...` queries need a display name that matches a member record;
  otherwise the bot asks for the full name.

## 11. Full automated suite catalog (154 non-chat tests)

One row per automated case. ⏭ = conditionally skipped (needs a real report
file from local disk, absent on most machines).

### Imports & guards

`tests/import-guard.test.ts` (5) — allows uploads within the cap; rejects
combined sizes over the cap; allows a single file exactly at the cap boundary;
checks the Content-Length header cheaply; ignores a malformed Content-Length
header.

`tests/database-import.test.ts` (4) — uses the report year as the annual
workflow year for next-year due dates; keeps same-year renewals unchanged;
falls back to the current UTC year when a report date is unavailable; prefers
the report date year when present.

`tests/import.test.ts` (1 + ⏭1) — maps auto-renewal Y values to true.
⏭ extracts the provided sample report rows (needs local dues XLS).

`tests/palms-import.test.ts` (11 + ⏭3) — matches rows to members by normalized
full name; accepts broad PALMS windows for lifetime imports; rejects broad
PALMS windows for monthly imports; rejects exact monthly PALMS windows for
lifetime imports; accepts PALMS datetime values in window checks; dash numeric
cells count as zero; currency symbols stripped from TYFCB; numeric XML
entities decoded in names; day-first report dates (`14-04-2026`,
`14/04/2026`); lowercase headers accepted; `Report` worksheet without the
`ss:` prefix accepted.
⏭ extracts report metadata and member rows from the provided sample report;
builds a stable report identity from the chapter and report window; recognizes
the August 4 export as the July monthly PALMS report (needs local PALMS files).

`tests/palms-monthly-performance.test.ts` (5) — recognizes exact monthly PALMS
windows; builds exact yearly totals from the latest 12 monthly PALMS files;
builds exact yearly totals from monthly PALMS files inside the anchor window;
builds six-month totals inside the anchored window; detects missing months
between uploaded monthly PALMS windows.

`tests/sponsor-import.test.ts` (1) — extracts sponsor rows and report metadata
from a SpreadsheetML report.

`tests/sponsor-database-import.test.ts` (4) — keeps rows whose sponsor matches
an imported member and skips unknown sponsors; matches sponsor names after
normalizing spacing and casing; matches sponsor names through aliases; adds
new rows, updates changed rows, and deletes removed rows on refresh.

`tests/training-import.test.ts` (1) — extracts metadata and attendance rows
from the report worksheet.

`tests/training-database-import.test.ts` (5) — keeps rows whose member matches
and skips unknown members; matches member names after normalizing spacing and
casing; matches member names through aliases; preserves overlapping historical
rows for append-only upsert; dedupes exact duplicate attendance rows within a
single file.

`tests/traffic-lights.test.ts` (5 + ⏭3) — extracts the end month from the
report footer; extracts the full report window from the footer; maps score
bands to traffic-light colors; parses rows with/without TYFCB; allows an
explicit report month override; parses score-only PDF traffic-light reports.
⏭ parses the June score-only PDF report; parses score-only XLSX traffic-light
reports; allows an explicit XLSX report month override (needs local files).

`tests/traffic-light-history.test.ts` (4) — keeps the latest six records per
member; groups independent members separately; sorts display history
chronologically; can keep all records when no limit is requested.

`tests/member-aliases.test.ts` (6) — matches the current member name before
checking aliases; matches an old spelling through aliases; returns duplicate
alias matches so imports can skip ambiguous rows; normalizes punctuation
variants (`Dr.`/`Dr`, hyphens, apostrophes) to the same key; strips PDF
control characters; matches punctuation variants of the stored member name.

### Renewals, stages, tasks

`tests/stage.test.ts` (9) — returns status stages first; uses the first
incomplete required task as the active stage; keeps active cycles in payment
pending when all required tasks are complete; does not advance stages for
cancelled required tasks; keeps active cycles out of workflow before 120 days;
keeps critical deadline as an active-cycle deadline override; calculates final
deadline across year boundaries; calculates active workflow dates; identifies
the 120-day renewal work window.

`tests/stage-groups.test.ts` (4) — selects the first stage with cycles as the
default mobile stage; falls back to MC Discussion when there are no active
cycles; groups cycles by every known stage; does not group renewals that have
not started the active workflow.

`tests/task-buckets.test.ts` (5) — groups open tasks into past due, this week,
and next week; excludes completed and cancelled tasks; excludes legacy
workflow task types; sorts tasks in each bucket by due date; excludes tasks for
cycles outside the 120-day renewal work window.

`tests/task-status.test.ts` (3) — marks the renewal cycle renewed when payment
is completed; does not renew the cycle for non-payment tasks; does not renew
the cycle when payment is cancelled or reopened.

`tests/tasks.test.ts` (7) — returns active trigger tasks due through the end
of next week; generates the four operational renewal tasks; does not generate
legacy or critical deadline tasks; does not generate triggers for completed
renewal cycles; does not generate triggers before the 120-day renewal work
window; sets completion dates when a checklist item is completed; clears
completion dates when a checklist item is unchecked.

`tests/urgency.test.ts` (12) — marks dates before today as overdue / through
the next ten days as due soon / beyond as upcoming; sorts by highest urgency,
then earliest due date; selects only the first open workflow task for each
member; chooses the first open workflow task for one cycle; chooses member
discussion when MC discussion is not open; ignores completed and cancelled
workflow tasks; returns null when no workflow task is open; keeps one next
task for each member; shows the next workflow task when earlier tasks are
already absent from open tasks; uses the earliest renewal cycle when a member
has multiple active cycles.

`tests/backfill-two-year-renewals.test.ts` (4) — selects next-year-only rows
and converts them to the annual workflow year; skips rows that already have a
current-year annual cycle; skips rows more than one year ahead; skips rows
already backfilled.

`tests/roles.test.ts` (3) — trims whitespace, collapses spaces, lowercases
role names; preserves display casing while removing duplicate spaces; maps
assignment ids to zero-based display order values.

`tests/roles-id-route.test.ts` (5) — PATCH/DELETE purge the `members` cache
tag on success; cache kept on validation, not-found, and in-use errors;
401 without a token.

### Performance & achievements

`tests/achievements.test.ts` (4) — prefers broad PALMS snapshots over newer
exact monthly snapshots; prefers the latest PALMS snapshot when present; falls
back to traffic-light history when PALMS data is missing; returns an empty
state when no data exists.

`tests/past-year-performance.test.ts` (3) — aggregates the latest twelve
months of traffic-light history; returns an empty summary when no history
exists; aggregates only the latest six snapshots when requested.

`tests/past-year-training-performance.test.ts` (4) — uses a report-date
anchored year window; returns zero when no imported trainings fall within the
window; uses inclusive six-month boundaries; handles six-month windows
anchored at the end of a longer month.

`tests/performance-averages.test.ts` (2) — builds weekly and monthly averages
from an inclusive report window; returns empty averages when the report window
is missing.

`tests/performance-share.test.ts` (3) — builds a WhatsApp-ready past year
performance summary; falls back gracefully when yearly data is missing; labels
the six-month WhatsApp summary and traffic-light history.

`tests/achievement-share.test.ts` (3) — builds a short recognition summary
from PALMS data; falls back gracefully when roles, tenure, and history are
missing; uses traffic-light fallback values when PALMS data is unavailable.

`tests/sponsor-achievements.test.ts` (2) — builds lifetime and past-year
sections using a rolling 365-day window; returns empty sections when there are
no sponsor achievements.

`tests/training-achievements.test.ts` (2) — builds lifetime and past-year
counts using a rolling 365-day window; returns empty sections when there are
no training achievements.

### Security, schema, utilities

`tests/sso-guard.test.ts` (15) — allows the app and exact trusted partner
origins; rejects unknown origins, lookalike suffix domains, partner
subdomains, unexpected ports, embedded userinfo, non-http schemes, garbage
URLs, and unparseable configs; accepts internal absolute paths; rejects
protocol-relative/backslash/control-character paths.

`tests/rate-limit.test.ts` (3) — allows requests up to the limit within the
window; tracks keys independently; lets old timestamps expire (sliding window).

`tests/schema.test.ts` (11) — does not store derived stage fields; stores
PALMS lifetime snapshots separately from monthly traffic lights; allows
storing member_since; stores reusable chapter roles and ordered member past
roles; stores member aliases; tracks import source metadata on import batches;
stores sponsor achievements separately from profile sponsor text; allows
sponsor imports as a tracked batch source; stores training achievements
separately and allows training report imports; stores traffic-light report
windows separately from the ending month; stores annual renewal workflow
separately from the imported term date.

`tests/date-format.test.ts` (9) — formats ISO dates/months for display without
leading zeroes; dashes for missing/invalid dates and months; multi-year/month
durations; recent dates as "less than one month"; clear fallback for missing
or invalid dates.
