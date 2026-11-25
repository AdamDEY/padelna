# Court booking — draft spec

_Draft, 14 Nov 2026. Nothing here is built. The SQL is a sketch to agree on, not a migration. Read it with `CLAUDE.md` (product rules) and `docs/admin-dashboard-spec.md` (admin rules)._

## 1. Why this is a decision, not just a feature

Today Padelna **does not book courts**. The pitch is "your padel, on the record", and `CLAUDE.md` tells us not to promise in-app booking. Booking changes that, and it only works with clubs that agree to take part. We have no partner clubs yet. So:

- Build in phases. The first phase needs no club to do anything new.
- Keep the community-first copy until a phase actually ships. Update `CLAUDE.md`, store text and the landing page at that point, not before.

## 2. What exists today

- `clubs`, `courts` (`indoor`, `lighting`, `active`), `club_hours` (day 1 = Monday, closing before opening means after midnight), and clubs have `phone`, `whatsapp`, `website`.
- `matches.court_id` is nullable. Set means "Court booked" (green), null means "Not booked yet" (sand note). Everything else reads from it: club feeds, "you played at this club", club reviews, tournaments' club.
- A host books **outside the app** (call, WhatsApp, the club's own app), then records the court with `MatchBookingSheet`. `BookingNoticeSheet` is the "book your court first" notice with a Call button.
- Rules already in the database: every match is 90 minutes, start times are on the half hour in `Africa/Tunis`, a host can't have two overlapping open matches (a `gist` exclusion on `tsrange`), and `check_match_court` blocks a closed club or a switched-off court.
- `matches.price` is per player in TND, with the comment "comes from the club later".
- Patterns to reuse: push notifications (`send-push`), expiry jobs (`expire-tournament-invites`), `admin_*` functions that log to `admin_actions`.

## 3. The one rule that keeps this simple

**A booking ends by setting `matches.court_id`.** Whatever way a court was booked (phone, request, Padelna calendar, another system), the match looks the same afterwards, so feeds, reviews and levels need no change.

## 4. Booking modes

Each club has one mode. The app shows different buttons by mode; the result is always the same.

| Mode | Player sees | Club does | Needs from the club |
|---|---|---|---|
| `manual` (today) | "Book with the club" (call, WhatsApp or link), then adds the court to the match | Nothing | Nothing |
| `request` | Picks a slot and sends a request, waits for an answer | Accepts or declines | A phone or a dashboard login |
| `native` | Live availability, instant booking | Keeps its calendar in Padelna | Moves its calendar to Padelna |
| `external` | Same as `native` | Keeps using its own system | A partnership and API access |

A club with no booking mode set is `manual`.

## 5. Data model (sketch)

All new tables get RLS on, `revoke all … from anon`, and explicit grants, like `club_hours`.

```sql
-- One row per club. No row = manual.
create table public.club_booking_settings (
  club_id text primary key references public.clubs (id) on delete cascade,
  mode text not null default 'manual'
    check (mode in ('manual', 'request', 'native', 'external')),
  -- manual mode: where "Book with the club" sends the player (falls back to clubs.website / phone)
  booking_url text,
  confirmation text not null default 'instant' check (confirmation in ('instant', 'club_confirms')),
  hold_minutes smallint not null default 10 check (hold_minutes between 2 and 30),
  request_expires_minutes smallint not null default 120,   -- request mode: club must answer by then
  min_notice_minutes integer not null default 120,         -- can't book a slot starting sooner
  max_advance_days smallint not null default 14,
  cancel_until_hours smallint not null default 12,         -- free cancellation window
  updated_at timestamptz not null default now()
);

-- Price of a court slot, by day and time of day. Per player, to match matches.price.
create table public.club_price_rules (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id) on delete cascade,
  days smallint[] not null,            -- 1 = Monday
  from_time time not null,
  to_time time not null,
  price_per_player numeric(6, 2) not null check (price_per_player >= 0)
);

-- Times a court can't be booked: maintenance, lessons, the club's own use.
create table public.court_blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text not null default '',
  created_by uuid references auth.users (id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id),
  booked_by uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,                 -- half hour, Africa/Tunis, same check as matches
  -- always 90 minutes, same as matches.duration_minutes
  status text not null check (status in
    ('held', 'requested', 'confirmed', 'declined', 'cancelled', 'expired')),
  source text not null default 'padelna' check (source in ('padelna', 'external')),
  external_ref text,                              -- id in the club's own system
  price_per_player numeric(6, 2),
  held_until timestamptz,                         -- held: until the player confirms; requested: until the club answers
  decided_by uuid references auth.users (id),     -- club or admin who accepted / declined
  decided_at timestamptz,
  cancelled_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  -- The core guarantee: nobody can take a court twice. Same shape as the matches exclusion.
  exclude using gist (
    court_id with =,
    tsrange((starts_at at time zone 'UTC'), (starts_at at time zone 'UTC') + interval '90 minutes') with &&
  ) where (status in ('held', 'requested', 'confirmed'))
);

-- A match created from a booking points back to it.
alter table public.matches add column booking_id uuid unique references public.bookings (id);
```

Notes on this sketch:

- **Stale holds.** A `held` or `requested` booking whose `held_until` passed still blocks the exclusion constraint until it is marked `expired`. A job (like `expire-tournament-invites`) does that every minute, and `hold_booking` also expires stale rows for the court it is about to book. Availability ignores them either way.
- **Matches booked the old way still occupy the court.** A match with `court_id` set (host-recorded) must also make that slot unavailable, so availability counts open matches with a court as well as bookings and blocks.
- **Native clubs can't be bypassed.** For `native` and `external` clubs, `check_match_court` should reject a `court_id` that doesn't come from a confirmed booking (otherwise a host can record a court that someone else holds). `manual` and `request` clubs keep today's behaviour.
- **Pricing source.** The admin spec mentions club prices; I did not check the current columns. Reconcile `club_price_rules` with whatever the admin already stores before writing a migration.
- **Staff access.** The admin spec says there are no club-manager logins. `native` and `request` modes need someone at the club to act. See phase 2.

### Later (phase 4 only)

```sql
create table public.club_integrations (
  club_id text primary key references public.clubs (id) on delete cascade,
  provider text not null,
  config jsonb not null default '{}',   -- non-secret settings, e.g. the club's id in that system
  secret_name text,                     -- name of the secret in Supabase Vault, never the secret itself
  status text not null default 'disabled' check (status in ('disabled', 'active', 'error')),
  last_synced_at timestamptz
);
```

## 6. Database functions

All validate, raise messages written for players, and are `security definer` with `search_path = ''` like the existing functions. Every new `raise exception` text must be added to `SERVER_MESSAGES` in `src/lib/error-message.ts` and to `errors.server` in both locale files.

| Function | Who | What |
|---|---|---|
| `get_club_availability(p_club_id, p_date)` | Player | Free 90-minute starts per court that day: opening hours, minus bookings, blocks and open matches with that court, minus slots inside `min_notice_minutes`. Includes the price. Not for `manual` clubs. |
| `hold_booking(p_court_id, p_starts_at)` | Player | `native`: creates a `held` booking until `hold_minutes`. Fails if taken, the club is closed or not `published`, the court is inactive, or the slot is out of range. |
| `confirm_booking(p_booking_id, p_match jsonb)` | Player | Turns the hold into `confirmed` (instant clubs) or `requested` (club confirms), and creates the match with `court_id` and `booking_id` in the same transaction, using the same fields as `create_match`. |
| `request_booking(...)` | Player | `request` mode: same as hold + confirm in one step, status `requested`. |
| `cancel_booking(p_booking_id)` | Player or club | Allowed until `cancel_until_hours` before the start for players. Sets the match's `court_id` back to null and posts a chat note, like `MatchBookingSheet` does today. |
| `decide_booking(p_booking_id, p_accept, p_note)` | Club or admin | Accepts or declines a request. Notifies the player. |
| `expire_bookings()` | Job | Marks stale `held` and `requested` rows `expired` and notifies where needed. |
| `club_list_bookings(p_club_id, p_from, p_to)`, `club_block_court(...)` | Club or admin | Calendar for the club side. |

Notifications to add: request received (club), accepted, declined, expired, cancelled (player and other players on the match). Add each as a notification type, with a setting like tournaments have if they should be switchable.

## 7. Player experience

1. **Club page.** The button depends on the mode.
   - `manual`: "Book with the club", which opens `booking_url`, WhatsApp or the phone. It replaces today's notice sheet. "Create match here" stays for hosts who already booked.
   - `request` and `native`: "Book a court".
2. **Pick a slot.** Date with `DateStrip`, then a list of free start times (half-hour steps, always 90 minutes), then a court (indoor/outdoor, price). Use the existing `Dropdown` and `CourtFields` where they fit.
3. **Details.** The same fields as `CreateMatchSheet` (match type, level range, players needed, note), so booking and match creation are one flow, not two.
4. **Hold (native).** A countdown of the hold time. Leaving or timing out releases the slot.
5. **Result.**
   - Instant: the match appears with the green "Court booked" pill.
   - Request: "Waiting for the club" (sand), with a push when the club answers. A declined request leaves the match in place as "Not booked yet" (same state as today) and says why.
6. **Cancel / change.** From the match's host tools, inside the free window.

Follow the code rules: a new `booking-repository.ts` (the only place that calls Supabase for this), React Query hooks in `useBooking.ts`, types in `src/types/booking.ts`, new sheets built on HeroUI `BottomSheet`, strings in both locale files, design from `design.md`. This needs a design artboard first; none exists yet.

## 8. Club and admin side

- **Phase 1–2 (pilot): the founder runs the calendar for the club** from `padelna-admin`. A new "Bookings" tab on each club shows a day calendar per court, requests to accept or decline, and blocks. Every action is logged to `admin_actions`. This needs no club login and fits the admin spec as it is.
- **Phase 3: club staff logins.** Add `club_members (club_id, user_id, role)` and let `is_club_member(club_id)` open the same functions, with the admin spec's "no club-manager logins" line revised. Decide this only once a club asks for it.

## 9. Payment

- **Phase 1–3: pay at the club**, like tournament fees today. The app shows the price and says so.
- **Later:** online payment per player or split between the four. Check which Tunisian providers fit (Konnect, Flouci and Paymee are the ones I know of; not verified). Needs refunds tied to the cancellation window. Do not start this before bookings work.

## 10. Other booking systems (`external` mode)

- One edge function per provider, all with the same three calls: `getAvailability(court, date)`, `createBooking(...)`, `cancelBooking(...)`, plus a webhook or a short polling job to catch bookings made on the club's side.
- **The club's system stays the source of truth.** Padelna asks it for the slot when booking and stores only a `bookings` row with `source = 'external'` and `external_ref`. It does not keep its own copy of that club's calendar, or the same court gets booked twice.
- Most booking systems have no open API; access is a partnership. Build an adapter only when a club that matters asks for it, and only after confirming the provider allows it. Do not scrape booking sites.
- When a club's system has no API, it stays `manual` (with its `booking_url`) or `request`.

## 11. Phases

| Phase | Ship | Needs | Done when |
|---|---|---|---|
| 0 | `manual` improved: `booking_url`, "Book with the club" button, notice sheet reworked. Booking mode and booking method recorded per club in the admin. | No partner | Every club shows a working way to reach it |
| 1 | `request` mode, `bookings`, notifications, founder-run calendar in the admin | 1–2 pilot clubs | A pilot club gets and answers real requests from the app |
| 2 | `native` mode: availability, holds, instant booking, blocks, price rules | A club willing to move its calendar | A club takes bookings in Padelna with no double bookings for 4 weeks |
| 3 | Club staff logins, cancellation policy, no-show handling | Several clubs | A club runs the calendar without the founder |
| 4 | `external` adapters, online payment | A partnership each | Demand from a club, not a guess |

## 12. Risks

- **Double booking** is the damage that ends trust in a booking app. The exclusion constraint, the stale-hold cleanup and the rule that native clubs can't set a court by hand exist to prevent it. Test these before any pilot.
- **Clubs that keep two calendars** (paper or WhatsApp plus Padelna) will double book. A club should either run the Padelna calendar or stay `manual`/`request`.
- **No-shows and late cancellations** have no penalty until payment exists. Start with a visible cancellation window and a "no-show" mark.
- **Scope creep**: no coaches, classes, memberships, equipment rental or open play slots in this spec.

## 13. Open questions

1. Which clubs would pilot, and how do they take bookings today? Add a "booking method" column to `tunisia_padel_clubs.xlsx` and fill it in before choosing phase 1 versus 2.
2. Court price: per slot or per player, and does it vary by time of day? What does the admin store today?
3. Should a booking always create a match, or can a player book a court and decide later whether to publish the match? (This draft says it always creates one, which keeps `court_id` as the single source of truth.)
4. Does a request that nobody answers expire (this draft: 2 hours), and who is told?
5. Who may cancel after the free window, and what happens to the other players on the match?

## 14. When this is built

Per `CLAUDE.md`: add scenarios for the app and the dashboard to `docs/test-scenarios.md` with a change-log line, including double-booking races (two players, one slot), hold expiry, a declined request, a cancelled booking with players already joined, and a club closing or a court being switched off after a booking exists.
