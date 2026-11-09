# Padelna Admin — product and technical spec

_Written 7 Nov 2026 from the Padelna app repo (`AdamDEY/padelna`) and the `padelna-admin` repo. Read this together with the app's `design.md` (visual language) and `CLAUDE.md` (product rules)._

## 1. What this is

The Padelna Admin is a web dashboard for **one administrator** (the founder) to run Padelna: manage clubs, look after players, watch matches and scores, handle reports and see how the app is growing. It shares the **same Supabase project** as the player app. The app repo owns the database (`supabase/migrations/`); the admin repo is a client of it.

Padelna in one paragraph: players (level 1–7) create and join padel matches (2 vs 2, four seats, always 90 minutes, start times on the half hour, Tunisian time `Africa/Tunis`), at real clubs with courts. Matches are friendly or competitive. After a match the host enters the score; a player from the other team confirms it (or enters the real one, which the host's team then confirms); an unconfirmed score expires after 48 hours. Competitive confirmed scores and player ratings move levels. Launch market: Tunisia (`+216` phones, prices in TND).

### Goals
1. Run the supply side: clubs, courts, hours, photos, prices, status.
2. See and fix players: find anyone fast, correct data, suspend, delete.
3. Watch the product work: weekly matches, unfilled seats, unbooked courts, scores that stall.
4. Keep the community safe: reports inbox, moderation of reviews.
5. Show growth: signups, matches, fill rate, confirmed-score rate, level distribution.
6. Leave a trail: every admin write is logged with a reason.

### Not in scope for now
- **Coach verification** (paper sheet, per-skill scores, "Verified 4.5 · Nov 2026" badge). Deferred on purpose. When built, the coach level overrides the quiz level and `level_history.cause` needs a `coach` value. Do not build it yet.
- Multiple admins, roles, club-manager logins.
- French/Arabic UI (English only; leave room for longer text).
- Dark mode. Mobile layouts below tablet width.

## 2. Current state of `padelna-admin`

Stack: Next.js 16 (App Router, `src/proxy.ts` instead of middleware), React 19, TypeScript, HeroUI v3 (`@heroui/react`), Tailwind CSS 4, `@supabase/ssr`, Leaflet (club map pin), dnd-kit (photo ordering), Biome (tabs, single quotes), pnpm.

- **Read `node_modules/next/dist/docs/` before writing Next code**; this Next version differs from what most people know (see the repo's `AGENTS.md`).
- HeroUI in server components: import named parts (`CardRoot`, `CardHeader`), not `Card.Header`, which works only in client components.
- Checks: `pnpm check` (typegen + tsc), `pnpm lint`.

Built:
- Sign-in, session refresh and access rules in `src/proxy.ts`: signed-out → `/sign-in`, signed in but not admin → `/not-allowed`.
- Dashboard shell: left sidebar (`src/lib/nav.ts`: Overview, Clubs, Players, Matches, Scores, Reports, Settings), sign out.
- **Clubs**: list (`admin_list_clubs`), new, edit with courts, photos (upload, order, cover), status, hours, facilities, prices, map pin. Saves go through `admin_upsert_club`, `admin_upsert_court`, `admin_set_club_status`, `admin_reorder_club_photos`.

Placeholders (`SectionPlaceholder`): Overview, Players, Matches, Scores, Reports, Settings.

Gap to fix first: `src/lib/supabase/database.types.ts` is **stale** (it lacks player_ratings, notifications, match_messages, club_reviews, push tables, etc.). Regenerate it from the live project before building new sections.

## 3. Access, data and safety rules (apply everywhere)

**Who is admin.** The one account with `app_metadata.role = 'admin'`. Players cannot edit app_metadata. In SQL: `public.is_admin()`; every `admin_*` function starts with `perform public.assert_admin();`.

**How the dashboard reads and writes.**
- **Reads** of big or joined data go through `admin_*` read functions (security definer, `assert_admin` first), as `admin_list_clubs` does. Simple reads may use RLS policies for admins (as `admin_actions`, `level_history`, `score_events`, profiles and connections already have).
- **Writes** always go through `admin_*` functions: they validate, change data, and call `log_admin_action(action, target_type, target_id, before, after, reason)`. The dashboard never updates tables directly and never uses the service-role key in the browser.
- Next.js: do reads in server components with the server Supabase client; do writes in server actions that return `{ error?: string }`. Database functions raise messages written for the admin, shown as they are.
- Run `revalidatePath` after writes.

**Reasons.** Every action that changes a player, a match, a score or a report requires a written reason (min 3 characters) in a confirmation dialog. Ordinary club edits keep the reason optional (current behaviour).

**Destructive actions** (delete player, void score, cancel match, delete club) always use the shared confirm dialog (`src/components/confirm-dialog.tsx`), state what will be lost and what players will see, and are logged.

**Time and money.** Show all dates/times in `Africa/Tunis`. Prices in TND. Phones as `+216 XX XXX XXX` (stored as the 8 digits).

**Definitions used across the dashboard**
- *Match played*: `matches.status = 'open'`, start + 90 min ≤ now, and all 4 seats taken (`players_needed + 1` rows in `match_players`). SQL helper: `public.played_matches()`.
- *Match cancelled*: `matches.status = 'cancelled'`. There is no other stored status; "open / full / in the past" are derived.
- *Seats*: seats 1–2 = team 1 (the host's), 3–4 = team 2.
- *Score status*: none (no row in `match_scores`), `pending` (before `expires_at`), `expired` (pending past `expires_at`, derived), `confirmed`.
- *Logged match*: `matches.origin = 'logged'` (played outside the app and entered afterwards) vs `'app'`.
- *Level*: `profiles.level`, `numeric(2,1)`, 1–7. Changes are in `level_history` (causes `quiz`, `match`, `admin`).
- *Friendly vs competitive*: `matches.kind`. Only competitive confirmed matches move levels.
- *Active player* (for stats): played or joined at least one match in the last 30 days.

## 4. Global UI

Follow `design.md`: light grey canvas `#F4F6F8`, white cards with 1 px `#E3E7EC` borders and 20 px radius, no gradients/emoji/card shadows, Nunito (weights 800–900 for hierarchy), blue `#2D63C8` for primary actions, lime soft `#E4F59E` for level chips, status tints (green confirmed, sand pending/warning, orange attention, red `#B42318` only for destructive). Define these once as tokens in `src/app/globals.css`; no hard-coded hex in components. One blue primary button per page.

- **Shell**: fixed left sidebar (logo, 7 items, sign out); top bar with page title, global search (players by name/phone, clubs by name) and account menu.
- **Tables**: sticky header, sortable columns where it makes sense, 25 rows per page with paging, row click opens the detail page, filters above the table with an active-filter summary and "Clear".
- **Chips**: status chips (Published, Draft, Pending, Confirmed, Expired…), level chip, club/city chip.
- **States for every screen**: loading skeleton, empty (with what to do next), error with Try again (use `error.tsx`), and "not found" for bad ids.
- **Accessibility**: 44 px targets for primary controls, visible labels, icon-only buttons have `aria-label`, colour never the only signal.

## 5. Sections

### 5.1 Overview (`/`)
**Purpose**: how the app is doing this week, and what needs me today.

**Top row — 4 KPI tiles** with change vs the previous 7 days (arrow + %): New players, Matches created, Matches played, Confirmed-score rate (confirmed ÷ scores submitted for matches that ended 48h+ ago).
**Date range switch**: 7 days / 30 days / 90 days (default 30; applies to charts).

**Charts** (pick one chart library, e.g. Recharts; none is installed yet; check its React 19 support):
1. Signups per week (line/area).
2. Matches per week, stacked: friendly vs competitive (bar).
3. Fill rate per week: matches that reached 4 players ÷ matches created (line).
4. Level distribution of all players (histogram, buckets of 0.5).
5. Activity heatmap: matches by weekday × start hour.
6. Top clubs by matches played (horizontal bars, top 8).

**"Needs attention" card** (each item links to its section with the filter applied): scores pending > 24 h, scores expiring in < 12 h, open reports (new), upcoming matches within 24 h with open seats, clubs published with no match in 30 days, drafts clubs.

**Data**: one `admin_overview_stats(p_days int)` function returning JSON (counts, weekly series, histogram, heatmap, attention counts), so the page makes one call. Time buckets in `Africa/Tunis`.
**Acceptance**: numbers match the Players, Matches and Scores lists when filtered the same way; empty database renders zeros, not errors.

### 5.2 Clubs (`/clubs`, `/clubs/new`, `/clubs/[id]`) — built, with gaps
**Exists**: table (name, city, status, indoor/outdoor court counts, photos, matches in 30 days, updated), create/edit form, courts (indoor/outdoor, lighting, active), weekly hours (day 1 = Monday, closing before opening = after midnight), photos (upload ≤ 10 MB jpeg/png/webp to private bucket `club-photos/<club id>/…`, drag to order, one cover), facilities (parking, showers, changing rooms, café, pro shop, racket rental, balls for sale, coaching, air-conditioned indoor), prices off-peak/peak, contact, map pin, status (`draft`, `published`, `temporarily_closed` with a required note, `closed`), featured flag.

**Rules to keep**: new clubs start as `draft` and are invisible to players. Only `published` clubs can host new matches (`check_match_court`). Closed clubs and switched-off courts stay readable because past matches reference them.

**Add**
1. **Delete rule**: a "Delete club" action allowed only when `club_has_matches(club_id)` is false (function exists); otherwise the button explains and offers Close instead. Logged.
2. **Club stats panel** on `/clubs/[id]`: matches in 30 days, fill rate, average review score, review count, courts used.
3. **Reviews moderation**: list of `club_reviews` for the club (author, six aspect scores, tags, comment, date). Action **Hide review** with reason. Needs `club_reviews.hidden boolean default false` and `get_club_ratings` / `get_club_reviews` to ignore hidden rows (app repo migration), plus `admin_set_review_hidden(p_review_id, p_hidden, p_reason)`.
4. Show the number of open reports about that club's reviews.

### 5.3 Players (`/players`, `/players/[id]`)
**Purpose**: find any player and, when needed, correct, suspend or delete them.

**List** (`admin_list_players(p_search, p_city, p_level_min, p_level_max, p_status, p_sort, p_limit, p_offset)`):
- Search: name (first/last, accent-insensitive, partial) or phone (8 digits, with or without `+216`).
- Filters: city, level range, status (active / suspended), has reports.
- Columns: avatar + name, phone, city, level (chip), joined date, matches played, last match date, status chip.
- Sort: newest, name, level, matches played. Total count shown.

**Detail** (`admin_get_player(p_id)` returns profile, stats, history, matches, ratings, connections in one JSON or a few focused calls):
- Header: avatar, name, level chip, status chip, phone, city, joined, last active, id.
- Profile: bio, hand, side, play style.
- Level history: line chart of `level_history` (old → new, cause, match link).
- Stats: matches played, hosted, joined, competitive vs friendly, win rate (from confirmed scores), no-score matches.
- Matches: upcoming and past, role (host/joined), club, score status; links to the match page.
- Ratings received: average and counts per rating (-2…+2) and the tag counts (`player_ratings`, `player_rating_tags`; anonymous, counts only, never who gave them).
- Connections: accepted count and the list of names.
- Clubs played at.
- Reports: reports filed about this player and by this player.
- Audit: `admin_actions` for this player.

**Actions** (each opens a dialog with a required reason; each calls an `admin_*` function and is logged with before/after):
1. **Edit details**: first/last name, city, bio, phone (8 digits), level (1.0–7.0, steps of 0.1). Changing level writes `level_history` with cause `admin` through the existing trigger. Admin functions bypass `protect_profile_columns` because `current_user` is not `anon`/`authenticated`.
2. **Remove photo**: clears `avatar_url` and deletes the object from the `avatars` bucket.
3. **Suspend / reinstate**: needs `profiles.status text default 'active' check in ('active','suspended')`, `suspended_at`, `suspended_reason`. Suspended players can sign in and look around but cannot create or join matches, send connection requests or send chat messages, and do not appear in player discovery. Enforce in the database (RLS/triggers/functions, like `check_match_court`), not only in the app. Grants on `profiles` are column-based, so the new column stays unwritable by players by default.
4. **Delete player**: `delete from auth.users` inside a security definer function (same pattern as `delete_own_account`). **Danger**: `matches.host_id` cascades, so deleting a host deletes their matches. Rule: refuse while the player hosts upcoming (non-cancelled) matches, naming them and telling the admin to cancel those first; allow otherwise. Joining players' seats are removed by cascade. Confirmation requires typing the player's name.

**Out of scope here**: coach verification and any "Verified" badge.
**Open item**: showing the sign-in email (lives in `auth.users`, not `profiles`) as a read-only column; a function can read it.

### 5.4 Matches (`/matches`, `/matches/[id]`)
**Purpose**: know everything about the matches that will be played this week, and fix problems.

**Views**
- **Week view** (default): day columns or day-grouped list for the selected week with week switcher (this week, next, custom); each match as a card: time, club + court (or "Court not booked" sand note), level range chip, friendly/competitive, price, seats filled (e.g. 3/4 with avatars and dashed empty slots), score status for past ones.
- **List view**: table with the same filters, sortable.
- **Filters**: club, city, kind, status (upcoming open / full / cancelled / past), court booked or not, origin (app/logged), date range.
- **Flags** (chips and a "Needs attention" filter): open seats and starts within 24 h, court not booked and starts within 48 h, host has a cancelled history (later), score missing after the match.
- **Counters** above the view: matches this week, with open seats, without court, cancelled.

**Detail** (drawer or page): host, line-up with team A (seats 1–2) / team B (seats 3–4), level range, kind, price, note, club/court, created at, origin; chat transcript (read-only, from `match_messages`, including system notes); score status and the score events timeline; notifications sent (optional); admin audit entries.

**Actions**
- **Cancel match** (`admin_cancel_match(p_match_id, p_reason)`): sets status `cancelled`, writes the existing system chat note, and queues a `match_cancelled` push/notification to every joined player (reuse `queue_push`). Allowed for upcoming matches; for past matches show "cannot cancel a match that already happened" and point to Scores.
- **Remove a player from a match** (later): frees the seat, notifies them.

**Data**: `admin_list_matches(filters…)` and `admin_get_match(p_id)`.

### 5.5 Scores (`/scores`)
**Purpose**: keep results trustworthy and unstick stalled scores.

**Queues (tabs)**
1. **Pending > 24 h**, soonest to expire first (shows time left to `expires_at`).
2. **Disputed**: a score was corrected by the other team (`score_events` has `correct`) and still waits for the host's team.
3. **Expired**: pending past `expires_at` (never counts).
4. **No score**: matches played (all 4 seats, over for > 24 h) with no `match_scores` row.
5. **Recently confirmed** (reference).

Row: match, date, club, kind, teams, the score set by set, submitted by (name, team), age.

**Score page / drawer**: match info, line-up, full `score_events` timeline (`submit`, `correct`, `confirm`, `expire`, `admin_set`, `reopen`, `void`), current score, who confirmed.

**Admin actions** (required reason, logged, write a `score_events` row with actor = admin):
- **Set score** (`admin_set_score`): enter or replace the score set by set (validated with `is_valid_padel_score`: best of three; sets 6-0…6-4, 7-5, 7-6) and mark it confirmed → event `admin_set`. If the match is competitive this must trigger the same level settlement as a confirmed score (`settle_match_levels`).
- **Reopen** (`admin_reopen_score`): back to `pending` with a fresh 48 h `expires_at` and notify the other team (`score_to_confirm`) → event `reopen`.
- **Void** (`admin_void_score`): the score never counts → event `void`. **Open design question**: if levels were already settled for that match, voiding must reverse the rows in `match_level_changes` and the matching `level_history` entries. Decide before building; until then block void on matches whose levels were settled.

Notes: `submit_score` overwrites `match_scores`; `score_events` is the only history of corrections, so always show it. A pending score "expires by its date", no row is written for it.

### 5.6 Reports (`/reports`)
**Purpose**: handle what players flag. **Needs new work in both repos**, because the app has no Report feature yet.

**App repo (Padelna)**
- Table `reports`: `id`, `reporter_id` (FK profiles, set null on delete), `target_type` (`player`, `match`, `club_review`, `chat_message`), `target_id text`, `target_player_id uuid null` (the person responsible, to count repeat offenders), `reason` (`harassment`, `fake_profile`, `no_show`, `wrong_score`, `inappropriate_content`, `other`), `details text ≤ 500`, `status` (`new`, `in_review`, `resolved`, `dismissed`), `resolution` (`dismissed`, `warned`, `content_hidden`, `suspended`), `admin_note`, `created_at`, `resolved_at`, `resolved_by`. One open report per (reporter, target).
- Function `submit_report(...)` for players (RLS: players can create, never read others').
- Report buttons in the app: player sheet/profile, match chat message, match, club review.

**Admin inbox**: filters (status, target type, reason), newest first, unread/new count badge in the sidebar. Row: reporter, target (with link to the player/match/review/message), reason, snippet, age, how many reports this player already has.
**Report page**: reporter and target context, what was reported (message text, review text, player summary), the target player's history (reports, suspensions), internal notes (editable), status stepper.
**Actions** (reason required, one resolution per report, logged): Dismiss; Warn (needs a new `admin_warning` notification kind: add it to the `notifications` and `notification_outbox` check constraints); Hide content (review via `club_reviews.hidden`; chat message via a `hidden` flag); Suspend the player (same function as in Players). Resolving closes the report and stores the action taken.

### 5.7 Settings (`/settings`)
- **Audit log**: read-only table of `admin_actions` (when, action, target type + link, summary of before/after, reason), filter by target type, target id and date range, expandable JSON diff.
- **Account**: admin email, change password (Supabase auth), sign out.
- Later: broadcast announcements by city/club using `notification_outbox` and push tokens; level-calibration constants (`c_rating_step`, `c_min_raters`, `c_max_change` in `settle_match_levels`, currently placeholders and `c_rating_step = 0`) once the product decides.

## 6. Database work, in order

All migrations live in the **app repo**: `supabase/migrations/<timestamp>_<name>.sql`, same style as the existing ones: comments that explain why, `security definer` + `set search_path = ''`, `revoke all … from public, anon`, `grant execute … to authenticated`, `assert_admin()` first, `log_admin_action` for writes. Apply them to the real project only after review.

| # | Migration | Contents |
| --- | --- | --- |
| 1 | `admin_players_read` | `admin_list_players`, `admin_get_player` |
| 2 | `admin_player_actions` | `profiles.status/suspended_*`, `admin_update_player`, `admin_remove_player_photo`, `admin_set_player_status`, `admin_delete_player`, enforcement of suspension in join/create/connect/chat |
| 3 | `admin_scores` | `admin_list_scores`, `admin_get_score`, `admin_set_score`, `admin_reopen_score`, `admin_void_score` (+ decision on level reversal) |
| 4 | `admin_matches` | `admin_list_matches`, `admin_get_match`, `admin_cancel_match` |
| 5 | `reports` | `reports` table, `submit_report`, `admin_list_reports`, `admin_get_report`, `admin_resolve_report`, `admin_warning` notification kind, `hidden` flags on reviews/messages |
| 6 | `admin_club_extras` | `admin_delete_club`, `admin_set_review_hidden`, club stats function |
| 7 | `admin_overview` | `admin_overview_stats` |
| 8 | `admin_audit_log` | optional read function with filters/paging (policy already allows admin reads of `admin_actions`) |

After each migration: regenerate `database.types.ts` in the admin repo.

## 7. Suggested build order
1. Regenerate types; audit log page (cheap, table exists).
2. **Players**: read-only list and detail → then edit/suspend/delete.
3. Scores queue and actions.
4. Matches week view and cancel.
5. Reports (app work first, then inbox) and review moderation.
6. Overview last, once the sections give it meaning.
7. Later: coach verification, broadcasts, level calibration.

Each piece: branch from `dev` in the admin repo (`feature/<name>`), build, test in the browser with the admin account, run `pnpm check` and `pnpm lint`, then report and wait before committing.

## 8. Open questions
1. Suspended players: exactly what is blocked? (Proposal in 5.3.)
2. Void score after levels settled: reverse the level changes, or block? (5.5.)
3. Show the sign-in email in Players? (5.3.)
4. Which chart library? (5.1.)
5. Should the admin be able to remove a player from a match, and edit a match (time, club) on a host's behalf? (5.4.)
6. Warnings: a notification only, or tracked as strikes on the player?
