# Padelna test scenarios

The scenarios to run by hand before a release, for the player app (`Padelna`, Expo) and the admin dashboard (`padelna-admin`, Next.js). Both use the same Supabase project, so many scenarios cross from one to the other.

**Keep this file up to date.** Every pull request that adds or changes a feature adds or edits its scenarios here, in the same PR, and adds a line to the [Change log](#change-log). If a bug is found, add the scenario that would have caught it.

## How to use it

- Each scenario has an ID (`APP-MATCH-07`, `ADM-TOUR-12`). Don't reuse or renumber IDs; mark removed ones `~~struck~~` instead.
- **Priority**: **P0** must pass before any release (money, trust, data loss, sign-in). **P1** core flows. **P2** edge cases and polish.
- **↔** marks a scenario that needs both the app and the dashboard.
- To record a test run, copy the checklist into the PR or a release note and tick `[x]` as you go. Leave this file unticked.

### Test setup

You need at least:

| Account | Use |
| --- | --- |
| Admin | account with `app_metadata.role = 'admin'`, signs in to the dashboard |
| Player A (man) | host of most matches |
| Player B (man) | partner of A |
| Player C (woman) | opponent, for audience and mixed checks |
| Player D | opponent, second device if possible |
| Player E | new account, created during the test run |

- Two devices or simulators (iOS and Android) for push, realtime and chat.
- At least one **published** club with courts, one **draft** club, and one **closed** club.
- Check every app scenario in **English and French** at least once per release (French copy is longer).
- Check push on a real device; the simulator doesn't receive remote pushes reliably.

---

## Player app

### Sign-in, sign-up and account (APP-AUTH)

- [ ] **APP-AUTH-01 (P0)** Sign up with email. The new account lands on Setup, not on the tabs.
- [ ] **APP-AUTH-02 (P0)** Sign in with Google, then with Apple (iOS). A first sign-in goes to Setup; a returning account goes to Home.
- [ ] **APP-AUTH-03 (P1)** Wrong password, unknown email and no network each show a clear message, never a raw error.
- [ ] **APP-AUTH-04 (P1)** Kill and reopen the app: the session is kept. Sign out: the app returns to sign-in and the back gesture doesn't reopen the tabs.
- [ ] **APP-AUTH-05 (P0)** Delete account from Settings: confirmation sheet, then the account is gone, sign-in with it fails, and the player no longer shows in Players, feeds or line-ups.
- [ ] **APP-AUTH-06 (P2)** Delete an account that hosts an upcoming match: check what happens to the match and its other players (they should be told, not see a broken match).

### Profile setup, level quiz and onboarding (APP-SETUP)

- [ ] **APP-SETUP-01 (P0)** Step 1 About you: name, phone (`+216`, 8 digits), city, gender and birthday are required; an invalid phone or a birthday under the minimum age is refused.
- [ ] **APP-SETUP-02 (P1)** Step 2 Your game: hand, side and play style save. Steps swap in place and the progress bar shows "n of 3".
- [ ] **APP-SETUP-03 (P0)** Level quiz: answers give a starting level between 1.0 and 7.0; it appears on the Profile and in `level_history` with cause `quiz`.
- [ ] **APP-SETUP-04 (P1)** Quit the app in the middle of setup and reopen: the player returns to setup, not to the tabs.
- [ ] **APP-SETUP-05 (P1)** Onboarding: four pages, "n of 4". Skip jumps to Fair play, which must be accepted before entering the app.
- [ ] **APP-SETUP-06 (P2)** Add a profile photo from camera and from library; deny the permission and check the message.

### Home (APP-HOME)

- [ ] **APP-HOME-01 (P1)** Next match card shows the player's next match; with no match it shows the empty state.
- [ ] **APP-HOME-02 (P1)** Open matches near the player's level appear; tapping one opens the match.
- [ ] **APP-HOME-03 (P1)** Tournament card appears for an upcoming or live tournament and opens it.
- [ ] **APP-HOME-04 (P1)** Score reminder appears when the player owes a score or a confirmation.
- [ ] **APP-HOME-05 (P2)** Pull to refresh; airplane mode shows `LoadError` with Try again, which recovers.

### Creating and editing matches (APP-MATCH)

- [ ] **APP-MATCH-01 (P0)** Create a match from the Home button: club, court, date, half-hour start, 90 minutes, level range, Friendly or Competitive, price, note, seat in the line-up. It appears in Matches and to other players.
- [ ] **APP-MATCH-02 (P0)** Only **published** clubs can be picked; a draft or closed club never shows.
- [ ] **APP-MATCH-03 (P1)** A start time in the past, or a match overlapping one the host already plays, is refused.
- [ ] **APP-MATCH-04 (P1)** Audience: a man can create Men or Mixed, a woman Women or Mixed; a host can't open a match for the other gender.
- [ ] **APP-MATCH-05 (P1)** Court not booked: the booking notice shows and the match shows "Court not booked".
- [ ] **APP-MATCH-06 (P1)** Edit match while nobody has joined: time, level, type and audience can change.
- [ ] **APP-MATCH-07 (P1)** Edit match after someone joined: only the court can change; every player gets a chat note and a notification.
- [ ] **APP-MATCH-08 (P1)** Cancel a match as host: players are told (push, notification, chat note) and the match is shown as cancelled.

### Joining and leaving matches (APP-JOIN)

- [ ] **APP-JOIN-01 (P0)** Join an open seat with a level inside the range: the seat fills right away for everyone (realtime), the host gets "X joined".
- [ ] **APP-JOIN-02 (P1)** Level outside the range: the player can't join directly (ask to join / blocked, as designed) and sees why.
- [ ] **APP-JOIN-03 (P1)** Gender: a woman can't join a Men match and a man can't join a Women match; anyone can join Mixed.
- [ ] **APP-JOIN-04 (P1)** Two players tap the same seat at the same time: one gets it, the other sees a clear message and the line-up refreshes.
- [ ] **APP-JOIN-05 (P1)** Joining a match that overlaps one you already play is refused.
- [ ] **APP-JOIN-06 (P1)** Leave a match: the seat frees up for everyone and the host is told.
- [ ] **APP-JOIN-07 (P2)** A full match (4/4) shows as full and can't be joined.

### Match invitations (APP-INVITE)

- [ ] **APP-INVITE-01 (P1)** Host invites a player to an open seat: the seat shows as held, the player gets "You're invited".
- [ ] **APP-INVITE-02 (P1)** Accept: the player takes the seat like a join, the host hears "X joined", the invite notification disappears.
- [ ] **APP-INVITE-03 (P1)** Decline: the seat opens again and the host gets a note.
- [ ] **APP-INVITE-04 (P1)** Host takes the invite back: the player is told and the invite can no longer be answered.
- [ ] **APP-INVITE-05 (P1)** Match cancelled while an invite waits: the invite notification disappears.
- [ ] **APP-INVITE-06 (P2)** Level range is ignored for invites, but gender and time overlap still block them.
- [ ] **APP-INVITE-07 (P2)** Nobody else can join a seat held by a pending invite.

### Match chat (APP-CHAT)

- [ ] **APP-CHAT-01 (P1)** Players in the match send and receive messages in real time on two devices.
- [ ] **APP-CHAT-02 (P1)** System notes appear for joins, leaves, court changes and cancellation.
- [ ] **APP-CHAT-03 (P1)** A player not in the match can't read or send messages.
- [ ] **APP-CHAT-04 (P2)** A new message pushes to the other players (when they have match pushes on) and opens the chat when tapped.

### Scores and confirmation (APP-SCORE)

- [ ] **APP-SCORE-01 (P0)** After the match ends, the host adds the score set by set; invalid scores are refused (sets 6-0…6-4, 7-5, 7-6; super tie-break for the third set).
- [ ] **APP-SCORE-02 (P0)** A player from the **other** team confirms it: status becomes Confirmed and the match reaches the feeds. A teammate of the host can't confirm.
- [ ] **APP-SCORE-03 (P0)** The other team corrects the score instead: the host's team must confirm the corrected score.
- [ ] **APP-SCORE-04 (P0)** Nobody confirms within 48 hours: the score shows Expired, never counts and never moves levels.
- [ ] **APP-SCORE-05 (P1)** A score can't be added before the match has ended or for a match without 4 players.
- [ ] **APP-SCORE-06 (P2)** Team photo added with the score shows on the result card in Community.

### Ratings and levels (APP-LEVEL)

- [ ] **APP-LEVEL-01 (P1)** Competitive match: after the score is saved, each player rates the other three (-2…+2) and can pick up to 5 tags. Friendly match: no rating step at all.
- [ ] **APP-LEVEL-02 (P1)** Ratings are anonymous: a player never sees who rated them.
- [ ] **APP-LEVEL-03 (P0)** Competitive match, score confirmed and everyone rated: levels change once (`level_history` cause `match`). Rating again or reloading doesn't apply it twice.
- [ ] **APP-LEVEL-04 (P0)** Competitive match, not everyone rates: levels settle 3 days after confirmation.
- [ ] **APP-LEVEL-05 (P0)** Friendly match: levels never change, even when confirmed.
- [ ] **APP-LEVEL-06 (P1)** Level chart on Profile shows the new point.

### Log a match played outside the app (APP-LOG)

- [ ] **APP-LOG-01 (P1)** Log a match: you and a partner against two opponents, with the score. The opponents get "X logged a match with you".
- [ ] **APP-LOG-02 (P0)** It counts only once an opponent confirms (feeds, played-with, clubs, levels if competitive). Unconfirmed after 48 h it expires.
- [ ] **APP-LOG-03 (P1)** Logged matches don't add join notes to chat or "joined your match" pushes.
- [ ] **APP-LOG-04 (P2)** Logging with a date in the future is refused.

### Community (APP-COMM)

- [ ] **APP-COMM-01 (P1)** Friends, My clubs and All Tunisia feeds show only **confirmed** results.
- [ ] **APP-COMM-02 (P1)** Friends' matches show in Friends only, not again in My clubs or All Tunisia.
- [ ] **APP-COMM-03 (P2)** Paging loads more on scroll; empty feeds show the empty state.
- [ ] **APP-COMM-04 (P2)** Share a match from the + button.

### Players, connections and share codes (APP-PLAYER)

- [ ] **APP-PLAYER-01 (P1)** Discover players: search and filters work; the player themselves never appears.
- [ ] **APP-PLAYER-02 (P1)** Connect: Connect → Pending for the sender, Accept for the receiver, then Connected for both. Requests banner and sheet update.
- [ ] **APP-PLAYER-03 (P1)** Remove a friend: both sides lose the connection.
- [ ] **APP-PLAYER-04 (P1)** Share profile: QR code and a 6-character code (like `4XZ123`, no 0/O/1/I/L).
- [ ] **APP-PLAYER-05 (P1)** Open a `/u/<code>` link: the right player opens; lowercase and old 10-character codes still work.
- [ ] **APP-PLAYER-06 (P2)** An unknown code shows a clear "not found".
- [ ] **APP-PLAYER-07 (P1)** Report a player from their sheet: reason + details, confirmation shown.
- [ ] **APP-PLAYER-08 (P2)** Friends screen and "played with" list are correct after a confirmed match.

### Clubs and reviews (APP-CLUB)

- [ ] **APP-CLUB-01 (P1)** All clubs lists only published clubs; club page shows courts, hours, facilities, prices, photos and open matches.
- [ ] **APP-CLUB-02 (P1)** Rate the club (six aspects, tags, comment); the review shows on the club page and the full list. Sending again replaces the review (one per player per club).
- [ ] **APP-CLUB-04 (P1)** A player who hasn't played a full match at the club can't review it.
- [ ] **APP-CLUB-03 (P2)** A club unpublished in the dashboard disappears from the app after refresh. ↔

### Tournaments: browsing and joining (APP-TOUR)

- [ ] **APP-TOUR-01 (P1)** Tournaments list: live first, then upcoming; filter by format; detail shows club, category, level range, date and spots.
- [ ] **APP-TOUR-02 (P0)** Group stage, join as a pair: invite a partner, the spot is held 24 h; partner accepts → Confirmed.
- [ ] **APP-TOUR-03 (P1)** Partner declines, or doesn't answer within 24 h: within about a minute the entry goes away, the captain is told, the spot frees up (the oldest waitlisted pair moves up) and the invite notification disappears.
- [ ] **APP-TOUR-03b (P2)** A player on the partner list receives an invite: the invite becomes their entry until they answer it.
- [ ] **APP-TOUR-03c (P2)** Americano with fixed pairs opens read-only (no join button).
- [ ] **APP-TOUR-04 (P1)** Tournament full: the pair goes to the waitlist; when a spot frees up, the oldest waitlisted pair moves to Confirmed.
- [ ] **APP-TOUR-05 (P1)** Join alone ("looking for a partner"): the player shows on the partner list for the organiser.
- [ ] **APP-TOUR-06 (P1)** Fit checks: wrong category (gender), below or above the level range, or already in a team are refused with the right message. A missing level or gender doesn't block.
- [ ] **APP-TOUR-07 (P1)** Individual Americano: join alone in one tap; waitlist when full.
- [ ] **APP-TOUR-08 (P1)** Leave a tournament before it starts: the spot frees up (and a waitlisted entry moves up).
- [ ] **APP-TOUR-09 (P2)** Tournament pushes can be turned off in notification settings; the in-app list still receives them.

### Tournaments: live (APP-LIVE)

- [ ] **APP-LIVE-01 (P1)** Group + knockout live screen: groups, standings, matches and bracket match the dashboard. ↔
- [ ] **APP-LIVE-02 (P0)** A player in a match sends the score (two sets to 4, super tie-break at one set all). It shows as waiting and doesn't count until the organiser confirms it. ↔
- [ ] **APP-LIVE-03 (P1)** Sending again while it waits replaces the submission; a player not in the match can't send.
- [ ] **APP-LIVE-04 (P1)** The score is entered from the player's own side and shows correctly from both sides after confirmation (no swapped teams).
- [ ] **APP-LIVE-05 (P0)** Individual Americano: a player in the match enters the score and it counts right away; any player in that match can correct it while the tournament is live.
- [ ] **APP-LIVE-06 (P1)** Americano leaderboard adds up each player's games or points; rounds show the right partners and opponents.
- [ ] **APP-LIVE-07 (P2)** Finished tournament still opens and shows the final results.

### Tournaments: history and recap (APP-THIST)

- [ ] **APP-THIST-01 (P1)** Profile has a "Tournament history" row under "Match history" showing how many finished tournaments you played. With none, tapping it shows the "Play your first tournament" toast.
- [ ] **APP-THIST-02 (P1)** Tournament history lists only finished tournaments where you held a spot (not invites, the waitlist or the partner list), newest first, grouped by month; the header shows played, titles, best Americano place and matches won – lost. The All / Knockout / Americano filter changes the list and its counts stay the same.
- [ ] **APP-THIST-03 (P1)** A tournament you won shows the dark "Winner" chip and the "N title" line in the header; a quarter-final exit shows "Quarter-final"; an Americano shows "3rd of 16" (lime with a trophy on the podium).
- [ ] **APP-THIST-04 (P2)** A tournament you're registered in (or playing) shows above the months with a blue border, and opens its detail / live screen. Pair tournaments say who you registered with.
- [ ] **APP-THIST-05 (P1)** Group + knockout recap: your finish, matches and sets won, the podium (third place shared with the other semi-final loser), your path match by match with scores from your side, and your group table with "You finished Nth".
- [ ] **APP-THIST-06 (P1)** Americano recap (individual and pairs): place, points and rounds won; best round; leaderboard (your row is always visible); each of your rounds with partner, opponents and score from your side.
- [ ] **APP-THIST-07 (P2)** Opening the recap of a tournament that isn't finished offers to open the tournament instead; one that was removed says "Tournament not found".
- [ ] **APP-THIST-08 (P1)** "Share result" opens the sheet with the result card preview. Share and Save image produce the 1080 × 1920 result image (Save asks to add photos once); Copy link copies the tournament link. "Post to Community" is covered in APP-THPOST.
- [ ] **APP-THIST-09 (P2)** Turning "Post in Community" off hides the caption and tagged partner and disables "Post to Community".
- [ ] **APP-THIST-10 (P2)** French: place endings (1er, 2e), plurals and long stage names ("Quart de finale") fit in the header strip and rows without cutting.

### Tournaments: Community posts (APP-THPOST)

- [ ] **APP-THPOST-01 (P0)** "Post to Community" on a recap you played posts your result (with the caption) and closes the sheet with a "Posted" toast; posting again only changes the caption. With the switch off, the button is disabled.
- [ ] **APP-THPOST-02 (P0)** Your post, and your friends' posts (or posts by someone whose partner is your friend), show in Community > Friends. Group + knockout posts get the blue card with the final, Americano posts the light card with place and points.
- [ ] **APP-THPOST-03 (P0)** A post by someone who isn't your friend does not show in Friends; it shows in All Tunisia (filtered by the tournament club's city), and in My clubs when the tournament was at a club you've played at. It never shows in two tabs.
- [ ] **APP-THPOST-04 (P1)** Posts and matches mix by date in every feed, "Show older results" keeps the order with no gaps or repeats.
- [ ] **APP-THPOST-05 (P1)** The title is told from your side ("You and Amira won…") and a post about a tournament you also played adds "You finished …". "See the tournament" opens your recap when you played it, else the tournament page.
- [ ] **APP-THPOST-06 (P1)** Only a finished tournament you played can be posted: the database refuses anything else, and the card shown is the real result, never one the poster typed.

### Notifications and push (APP-NOTIF)

- [ ] **APP-NOTIF-01 (P1)** Each event creates an in-app notification and a push: joined, left, invited, court changed, cancelled, score to confirm, score confirmed, connection request, tournament invite.
- [ ] **APP-NOTIF-02 (P1)** Tapping a push or a notification opens the right screen, from a killed app and from the background.
- [ ] **APP-NOTIF-03 (P1)** Turning a push category off in settings stops those pushes, not the in-app rows.
- [ ] **APP-NOTIF-04 (P2)** Delete a notification (slides away), paging of an old list.

### Profile and settings (APP-PROF)

- [ ] **APP-PROF-01 (P1)** Profile shows level, gender and age, real stats and match history. Win rate, streak and the other stats show only from 5 matches with a confirmed score; before that the hero shows dashes and the new-player cards.
- [ ] **APP-PROF-02 (P1)** Coach verified badge shows only for a player with a coach evaluation from the dashboard. ↔
- [ ] **APP-PROF-03 (P1)** Edit profile saves; level and other protected columns can't be changed from the app.
- [ ] **APP-PROF-04 (P1)** Language switch English ↔ French changes the whole app; following the phone language works on first launch.

### General app checks (APP-GEN)

- [ ] **APP-GEN-01 (P1)** Every list has loading, empty and error states; no raw error text ever shows.
- [ ] **APP-GEN-02 (P1)** iOS and Android both: tab bar, bottom sheets, keyboard over inputs, back gesture.
- [ ] **APP-GEN-03 (P2)** Small screen (iPhone SE) and large text: nothing is cut off; French fits.
- [ ] **APP-GEN-04 (P2)** Slow network: buttons don't double-submit (double-tap Join, Save score, Create).

---

## Admin dashboard

### Access (ADM-AUTH)

- [ ] **ADM-AUTH-01 (P0)** Signed out, any dashboard URL redirects to `/sign-in`.
- [ ] **ADM-AUTH-02 (P0)** A player account (not admin) signs in and lands on `/not-allowed`; it can't call any `admin_*` function (try from the app's session too).
- [ ] **ADM-AUTH-03 (P1)** Admin sign in, refresh after a long idle (session refresh), sign out.

### Overview (ADM-OVER)

- [ ] **ADM-OVER-01 (P1)** KPI tiles (new players, matches created, matches played, confirmed-score rate) match the Players, Matches and Scores lists filtered the same way.
- [ ] **ADM-OVER-02 (P1)** 7 / 30 / 90 day switch updates the charts; times are in `Africa/Tunis`.
- [ ] **ADM-OVER-03 (P2)** Needs attention items link to the right list with the filter applied.
- [ ] **ADM-OVER-04 (P2)** An empty database shows zeros, not errors.

### Clubs (ADM-CLUB)

- [ ] **ADM-CLUB-01 (P1)** Create a club: it starts as Draft and is invisible in the app. ↔
- [ ] **ADM-CLUB-02 (P0)** Publish it: it appears in the app and can host new matches. Close it: no new matches, but past matches still show it. ↔
- [ ] **ADM-CLUB-03 (P1)** Edit hours (closing after midnight), facilities, prices, map pin; changes show in the app. ↔
- [ ] **ADM-CLUB-04 (P1)** Courts: add, edit (indoor/outdoor, lighting), switch off, delete; a switched-off court can't be picked for a new match. ↔
- [ ] **ADM-CLUB-05 (P1)** Photos: upload (≤ 10 MB, jpeg/png/webp), refuse a bigger or wrong file, drag to reorder, set cover, delete.
- [ ] **ADM-CLUB-06 (P1)** Delete club: allowed only when it has no matches; otherwise the dashboard explains and offers Close.
- [ ] **ADM-CLUB-07 (P2)** Filters and search on the clubs table; bad id shows "not found".
- [ ] **ADM-CLUB-08 (P1)** Logo: upload (≤ 2 MB), replace and clear it from the club editor; the clubs table and the app (Home, Clubs, club rows) show the new logo, and a replaced or cleared file is removed from storage. ↔

### Players (ADM-PLAYER)

- [ ] **ADM-PLAYER-01 (P1)** Search by name (partial, accents ignored) and phone (with or without `+216`); filters for city, level, gender.
- [ ] **ADM-PLAYER-02 (P1)** Player page: profile, age and birth date, stats, level chart, matches, ratings as counts only (never who gave them).
- [ ] **ADM-PLAYER-03 (P0)** Edit player (name, city, phone, level, gender, birth date): saved, logged in `admin_actions`; a level change writes `level_history` with cause `admin` and shows in the app. ↔
- [ ] **ADM-PLAYER-04 (P1)** Level outside 1.0–7.0 or with two decimals is refused.
- [ ] **ADM-PLAYER-05 (P1)** Remove photo: the app shows initials instead. ↔
- [ ] **ADM-PLAYER-06 (P1)** Coach evaluation: adding one sets the player's level (`level_history` cause `coach`) and shows "Coach verified" in the app. ↔

### Matches (ADM-MATCH)

- [ ] **ADM-MATCH-01 (P1)** Week view: switch weeks; matches at the same time sit side by side; cards show court booked or not, level, kind, seats, score status.
- [ ] **ADM-MATCH-02 (P1)** List view with filters (club, kind, status, court booked, origin, dates) gives the same matches as the week view.
- [ ] **ADM-MATCH-03 (P1)** Match drawer: line-up by team, chat transcript, score timeline.
- [ ] **ADM-MATCH-04 (P0)** Cancel an upcoming match: status Cancelled, players get the push and a chat note, it is logged. ↔
- [ ] **ADM-MATCH-05 (P1)** A past match can't be cancelled; the message points to Scores.

### Scores (ADM-SCORE)

- [ ] **ADM-SCORE-01 (P1)** Queues (pending, disputed, expired, no score, recently confirmed) show the right matches; time left to expiry is correct.
- [ ] **ADM-SCORE-02 (P1)** Score detail shows the full event timeline (submit, correct, confirm, expire).
- [ ] **ADM-SCORE-03 (P1)** Search by player or club.

### Reports (ADM-REP)

- [ ] **ADM-REP-01 (P0)** Report a player in the app; it appears at the top of Reports with the reported player, reason, "Played together" and who sent it. ↔
- [ ] **ADM-REP-02 (P1)** Open a report: both players, the reporter's three answers (played together, reason, comment), the linked match with score and teams, and the ratings the reported player gave in it.
- [ ] **ADM-REP-03 (P1)** Filter by reason and by played together; the URL keeps the filters and an empty result says so.
- [ ] **ADM-REP-04 (P1)** History shows reports on the player in the last 30 days by reason, and how many reports the reporter has sent.
- [ ] **ADM-REP-05 (P2)** A report whose players were deleted still opens ("Deleted player"); with more than 50 reports the list pages.
- [ ] **ADM-REP-06 (P2)** The screen is read only: no action buttons yet.

### Tournaments: setup (ADM-TOUR)

- [ ] **ADM-TOUR-01 (P1)** Wizard: create a group-stage tournament with club, category (men/women/mixed), level range, date and start time.
- [ ] **ADM-TOUR-02 (P1)** Create an Americano (pairs) and an individual Americano; individual capacity must be a multiple of 4.
- [ ] **ADM-TOUR-03 (P1)** Level range with more than one decimal (3.75) is refused, not rounded.
- [ ] **ADM-TOUR-04 (P0)** Open registration (set capacity): the tournament becomes joinable in the app. ↔
- [ ] **ADM-TOUR-05 (P1)** Registration card shows confirmed, invited, waitlist and looking entries live as players join in the app. ↔
- [ ] **ADM-TOUR-06 (P1)** Add a pair of app players with the player picker; the fit checks (category, level, already in a team) apply.
- [ ] **ADM-TOUR-07 (P1)** Pair two "looking" players into a team; edit and remove entries.
- [ ] **ADM-TOUR-08 (P1)** Individual Americano: add an app player, confirmed straight away.
- [ ] **ADM-TOUR-09 (P1)** Draw: seeded, random and manual (drag between groups); save the draw.
- [ ] **ADM-TOUR-10 (P0)** Start the tournament: only confirmed entries go into the draw; invited, waitlist and looking entries are removed. ↔
- [ ] **ADM-TOUR-11 (P1)** Delete a tournament (draft and live): confirm dialog, it disappears from the app. ↔

### Tournaments: running (ADM-RUN)

- [ ] **ADM-RUN-01 (P0)** Enter a group match score; standings update with the tie-break order (points, head-to-head, sets, games).
- [ ] **ADM-RUN-02 (P0)** Confirm a score a player sent from the app: it becomes the real score and shows in the app. Reject it: the player can send again. ↔
- [ ] **ADM-RUN-03 (P1)** Create the knockout from group results: crossings A1–D2, B1–C2, C1–B2, D1–A2; no same-group rematch in the quarter-finals.
- [ ] **ADM-RUN-04 (P1)** Knockout scores move winners to the next round up to the final.
- [ ] **ADM-RUN-05 (P1)** Americano rounds: partners change each round, byes are fair for counts not divisible by 4, leaderboard matches the app. ↔
- [ ] **ADM-RUN-06 (P1)** Organiser corrects an individual Americano score a player entered; the app updates. ↔
- [ ] **ADM-RUN-07 (P2)** League score form saves and standings update.

### General dashboard checks (ADM-GEN)

- [ ] **ADM-GEN-01 (P0)** Every write is logged in `admin_actions` with before/after.
- [ ] **ADM-GEN-02 (P1)** Every destructive action uses the confirm dialog and says what will be lost.
- [ ] **ADM-GEN-03 (P1)** Each page has loading, empty, error (Try again) and not-found states.
- [ ] **ADM-GEN-04 (P1)** Dates and times are in `Africa/Tunis`, prices in TND, phones as `+216 XX XXX XXX`.
- [ ] **ADM-GEN-05 (P2)** Data changed in the app shows after a refresh (no stale cache after `revalidatePath`).

---

## Security and data rules (SEC)

Run these against the database directly (SQL editor or a player's session token), not only through the UI.

- [ ] **SEC-01 (P0)** A player can't call any `admin_*` function.
- [ ] **SEC-02 (P0)** A player can't update protected profile columns (level, status, share code) with a direct update.
- [ ] **SEC-03 (P0)** A player can't read other players' ratings, private profile data or chats of matches they're not in.
- [ ] **SEC-04 (P0)** A player can't insert a match at a draft or closed club, or in the past, with a direct insert.
- [ ] **SEC-05 (P1)** A player can't confirm their own team's score or submit a tournament score for a match they don't play.
- [ ] **SEC-06 (P1)** Supabase advisors (security and performance) show no new warnings after each migration.

## Not built yet (add scenarios when they ship)

- Dashboard: Reports inbox, Settings (audit log, account), Set / Reopen / Void score actions, Suspend and Delete player, review moderation, club stats panel.
- App: Arabic (right-to-left), reporting chat messages, matches and reviews.

---

## Change log

| Date | Change |
| --- | --- |
| 2026-11-09 | First version, covering app up to individual Americano (PR #120) and dashboard up to individual Americano (PR #59). |
| 2026-11-10 | Added Reports (ADM-REP): read-only inbox of player reports. |
| 2026-11-10 | Removed the in-app QR scanner (camera); sharing your code and opening `/u/<code>` links stay. App icon is now the logo on blue. |
| 2026-11-10 | Added Tournament history and recaps (APP-THIST): Profile row, history list, group + knockout and Americano recaps, share sheet and result image. Needs migration `20261110140000_tournament_history.sql`. |
| 2026-11-10 | Added tournament result posts in the Community feeds (APP-THPOST). Needs migration `20261110160000_tournament_posts.sql`. |
| 2026-11-10 | Added the club logo scenario (ADM-CLUB-08). The migrations `20261108220000_admin_edit_gender_birthday.sql` and `20261108240000_admin_reason_optional.sql` were applied to the database earlier but missing from the repo; added. |
| 2026-11-10 | Hid the Share button on the tournament detail screen (commented out for now); no scenario covered it. |
