# Padelna Design Guidelines

_Last updated: 23 Oct 2026_

Padelna uses one soft, minimal visual language on every screen: a light grey canvas, white rounded cards, one calm blue for actions and a soft lime for levels. This file records the values used in the Padel Social App design canvas so design and React Native code stay in sync.

## Principles

- **Soft and calm.** Light backgrounds, rounded shapes, no harsh contrasts or heavy shadows. Players of every age should feel at ease.
- **One clear action per screen.** Each screen has a single blue primary button, usually pinned at the bottom.
- **Readable first.** Body text is never below 13 px, labels never below 11 px, and every touch target is at least 44 px.
- **Trust is visible.** Level, verification and confirmed scores are always shown with the same badges, so players learn to read credibility at a glance.
- **No decoration for its own sake.** No gradients, no emoji, no drop-shadow cards. Colour carries meaning (blue = action, lime = level, green = confirmed, orange = warning).

## Colours

The palette is a cool neutral base, one primary blue and a soft lime accent; every other colour is a pale tint paired with a dark text colour of the same hue.

### Core

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | #F4F6F8 | App background behind cards |
| `surface` | #FFFFFF | Cards, sheets, inputs, tab bar |
| `ink` | #17202B | Titles and main text |
| `ink-2` | #4A5462 | Secondary body text |
| `muted` | #5E6875 | Captions, hints, sub-labels |
| `muted-icon` | #6B7480 | Inactive tab icons and labels |
| `line` | #E3E7EC | Card borders |
| `line-input` | #DDE2E8 | Input and chip borders, dividers |
| `fill` | #F0F3F7 | Quiet button and icon backgrounds |
| `track` | #E8ECF1 | Segmented control track, progress track |
| `primary` | #2D63C8 | Primary buttons, links, selected states, active tab |
| `primary-dark` | #1F4A99 | Text on `primary-soft`, link hover |
| `primary-soft` | #E3ECFA | Selected option fill, secondary buttons, info notes |
| `primary-tint-text` | #D6E3FA | Secondary text on blue cards |
| `lime` | #D8F06C | Highlights: "In 2 days", SOON badge, quiz ball |
| `lime-soft` / text | #E4F59E / #2E3A0A | Level range chips, WIN tag |

### Status

| Meaning | Background | Text | Used for |
| --- | --- | --- | --- |
| Success / confirmed | #DFF1E7 | #1D6E48 | Confirmed score, Court booked, good fit |
| Warning / pending | #FBF1D3 | #6B4F00 | Starting level, 1 spot left, court not booked |
| Attention / negative | #FBE8DA | #8A3A12 | To work on, worn gear; report and leave actions use #A44A1E |
| Destructive | #FDE8E6 | #B42318 | Delete account only |
| Notification dot | — | #E0703A | Unread badges |
| Rating star | — | #E5A823 | Club ratings |

### Avatar tints

Initial avatars rotate through five pairs (background / text): blue #E3ECFA / #2D5DB8, peach #FBE8DA / #9A4317, mint #DFF1E7 / #1D6E48, lilac #ECE6F8 / #5E3FA0 and sand #FBF1D3 / #6B4F00.

### Image placeholders

Court drawings sit on #D9E6F6 (blue court), #CFE6D8 (green court), #F7E6DA (peach) or #E8F2CF (lime), with white court lines at 70–95% opacity. Modal overlays use rgba(23,32,43,0.42–0.45).

## Typography

One typeface, Nunito, in weights 400–900; its rounded letters give the soft feel, and heavy weights (800–900) carry hierarchy instead of extra colours.

- **Font:** Nunito (Google Fonts), fallback `sans-serif`. Weights loaded: 400, 600, 700, 800, 900.
- **Display numbers** (levels, scores, countdowns) use weight 900 with tight negative letter-spacing.
- **Uppercase labels** (e.g. "YOUR NEXT MATCH", "LEVEL QUIZ") use 12–13 px, weight 800, +0.6 to +0.8 px letter-spacing.

| Style | Size / line height | Weight | Letter-spacing | Example |
| --- | --- | --- | --- | --- |
| Level display | 56–72 px / 1.0 | 900 | −2 to −3 px | 3.5 on the starting-level screen |
| Stat display | 34–42 px / 1.0 | 900 | −1 px | 4.5 on Profile |
| H1 screen title | 28–30 px / 1.15 | 900 | −0.5 px | "Tell us about you", "Matches" |
| H1 compact (sheets, sub-pages) | 20–24 px / 1.2 | 900 | −0.3 to −0.4 px | "Create a match", "Rate the players" |
| Countdown / card title | 22–32 px | 900 | −0.3 to −0.8 px | "Sat 25 Oct · 18:00" |
| H2 section | 17–19 px | 900 | 0 | "Open matches for you" |
| Body large | 16–17 px / 1.5 | 400–700 | 0 | Onboarding text, input values |
| Body | 15 px / 1.4–1.5 | 700–800 | 0 | List titles, names, options |
| Body small | 14 px / 1.45 | 600–700 | 0 | Field labels, descriptions |
| Caption | 13 px | 600–700 | 0 | Meta lines, hints, counters |
| Micro | 11–12 px | 700–800 | 0 to +0.8 px | Chips, tab labels, badges |
| Button | 15–17 px | 800 | 0 | "Continue", "Publish match" |

## Spacing and layout

Screens are designed at 390 × 844 (iPhone 14/15) with 20–24 px side margins and spacing in steps of 2, mostly 6, 8, 10, 12, 14, 16, 18 and 22 px.

| Token | Value | Where |
| --- | --- | --- |
| Screen side margin | 20 px (app screens), 24 px (auth, setup, onboarding) | All screens |
| Top safe area | 56–60 px before the first element | Header row |
| Section gap | 16–22 px (setup step 2: 34 px) | Between blocks on a screen |
| Label → field gap | 6 px | Form fields |
| Field → field gap | 10–16 px | Forms |
| Chip / pill gap | 6–8 px | Filters, tags |
| Card padding | 14–18 px | Cards, sheets |
| Card list gap | 10–12 px | Match lists, club lists |
| Bottom action | 34 px from the bottom edge | Pinned primary buttons |
| Tab bar | 86 px tall, 10 px top padding | Classic bottom bar |
| Glass tab bar | 66 px tall, 14 px from the sides, 26 px from the bottom | Liquid Glass variant |

- **Grids:** two-up fields use a 2-column grid with 10–12 px gap; option sets use 3- or 4-column grids (side picker, play style, durations).
- **Horizontal carousels** (open matches, people you may know) show 1.5 cards so the scroll is obvious.
- **Bottom sheets** start 56–86 px from the top and keep the dimmed screen visible behind them.

## Corners, borders and shadows

Everything is rounded, borders are 1 px and light, and shadows are reserved for things that float.

| Element | Radius |
| --- | --- |
| Small chips, badges | 8–12 px |
| Inputs, small buttons, option tiles | 12–16 px |
| Primary buttons | 16–18 px |
| Cards | 18–24 px |
| Bottom sheets (top corners) | 28 px |
| Hero / illustration blocks | 32–36 px |
| Pills, filter chips, avatars, icon buttons | Fully round |

- **Borders:** 1 px `line` (#E3E7EC) on cards, 1 px `line-input` (#DDE2E8) on inputs. Selected state = 2 px `primary` border. Empty slots and "add" actions use a 2 px dashed #9DB8E6 border.
- **Shadows:** none on cards. Only floating elements get one: FAB `0 8 24 rgba(23,32,43,0.16)`, centre Create button `0 6 18 rgba(45,99,200,0.35)`, selected segment `0 1 3 rgba(23,32,43,0.08)`.
- **Liquid Glass:** rgba(255,255,255,0.52–0.55) fill, 22 px blur + 180% saturation, 1 px white border at 75%, shadow `0 10 34 rgba(23,32,43,0.18)`. In the app, use the native iOS tab bar rather than recreating it.

## Components

A small set of building blocks covers every screen; reuse them rather than styling one-offs.

| Component | Spec | Seen on |
| --- | --- | --- |
| Primary button | 54–56 px tall, radius 16–18, `primary` fill, white 17 px / 800 | Continue, Publish match, Join |
| Secondary button | Same size, `primary-soft` fill, `primary-dark` text | Message, Directions |
| Outline button | 1 px #C9D6EE border, white fill, `primary` text | Invite to a match, Ask to join |
| Danger buttons | Outline #F0C9B2 with #A44A1E text (Report, Leave, Cancel); solid #B42318 only for Delete account | Profile, Your match |
| Text button | No fill, `muted` 16 px / 800 | Skip, Retake, Cancel |
| Icon button | 44 px circle, white fill, 1 px `line` border | Back, notifications, settings |
| Text input | 52 px tall, radius 14, white, 1 px `line-input`, 16 px text; label above 14 px / 700 | All forms |
| Phone input | Fixed "+216" box + number field, 8 px gap | Profile setup 1 |
| Segmented control | `track` background, 5 px padding, radius 16; selected = white with soft shadow | Hand, booking, Friendly/Competitive |
| Option tile | 76–92 px tall, radius 16, icon over label; selected = `primary-soft` + 2 px `primary` | Preferred side, play style |
| Answer card | 60 px min, radius 16, radio circle left; selected = `primary-soft`, 2 px border, tick | Level quiz |
| Filter chip | 36–40 px pill; on = `primary-soft` or solid `primary` with tick | Matches filters |
| Level chip | `lime-soft` fill, #2E3A0A text, 12 px / 800, radius 10 | "4.0 – 5.0" on match cards |
| Card | White, 1 px `line`, radius 20–24, padding 14–16 | Matches, posts, reviews |
| Info note | `primary-soft` fill, radius 18, icon + 14 px text, first sentence bold | Starting level hint |
| Bottom sheet | White, top radius 28, 40 × 5 px grab handle, dimmed backdrop | Create match, booking notice, delete |
| Tab bar | 5 items, 24 px icons, 11 px labels; active = `primary`, inactive = #6B7480 | All main screens |
| Progress (setup) | 3 segments, 6 px tall, radius 3, 6 px gap, "n of 3" on the right | Profile setup |
| Page dots (onboarding) | 8 px dots, active = 24 px wide `primary` pill | Onboarding |

## Icons, avatars and imagery

Icons are simple outline strokes, avatars are photos with an initials fallback, and images are court photos or soft court-line drawings.

- **Icons:** outline style on a 24 × 24 grid, 1.8 px stroke, round caps and joins, `currentColor`. Sizes: 24 px in the tab bar, 20–22 px in buttons, 14–18 px inline with text. A Lucide-style set matches this.
- **Avatars:** circles at 28–36 px (lists, stacks), 40–52 px (rows, line-ups), 60–92 px (profile). Fallback = initials in weight 800–900 on one of the five avatar tints. In stacks they overlap by 8–12 px with a 2 px ring in the background colour.
- **Your own avatar** gets a 2 px `primary` ring and a small lime level badge when it opens your profile.
- **Empty slot:** an open spot is a dashed `primary` circle with a +.
- **Images:** match and club photos use radius 14–18 inside cards. Until real photos exist, use the court-line placeholder: a tinted block with white court outline, net line and an optional lime ball.
- **Logo:** lime circle with a ball-seam mark and the "Padelna" wordmark in Nunito 900.

## Level, status and trust patterns

Credibility is the core of the app, so level and match status always use the same visual codes.

| Pattern | Look | Meaning |
| --- | --- | --- |
| Level number | Weight 900, `primary` or `ink`, on a 1–7 scale | A player's current level |
| Level range chip | `lime-soft` pill, e.g. "4.0 – 5.0" | Who a match is for |
| Out-of-range chip | #EEF0F3 pill, `muted` text | Match above or below your level |
| Starting level tag | Sand pill (#FBF1D3 / #6B4F00) | Level from the quiz, not yet shaped by matches |
| Fit line | Green tick + "Great fit for your level" | Match suits you |
| Score confirmed | Green shield + "Score confirmed by all 4" | Result is trusted |
| Court booked / not booked | Green tick pill / sand clock note | Booking status set by the host |
| WIN tag | `lime-soft` micro chip | Winning team in a result |
| Reputation tags | `primary-soft` pills with counts, e.g. "Fair play · 12" | What other players say |

- A **coach-verified** badge is planned for later; until then avoid the word "Verified" for levels built only from matches and reviews.
- Scores are shown set by set in a small grid (team name + 3 columns), winner's sets in weight 900, loser's in `muted`.

## Accessibility and tone of voice

The app must work for teenagers and for 60-year-old club regulars alike: large targets, high contrast and plain, friendly words.

- **Touch targets:** 44 px minimum; main buttons 54–56 px.
- **Contrast:** text meets 4.5:1 on its background. Never use `muted` text below 13 px on `bg`, and never put white text on lime.
- **Colour is never the only signal:** selected states add a border or tick, warnings add an icon, win/loss add a W/L letter.
- **Labels:** every input has a visible label; icon-only buttons have an accessible name ("Back", "Notifications").
- **Tone:** short, warm and direct. Say "Let's play", "Book your court first", "There are no wrong answers". Use first names, avoid jargon except padel terms players know (bandeja, víbora, bajada).
- **Language:** English in the mockups; plan for French and Arabic (right-to-left), so avoid text baked into images and leave room for longer words.

## Tokens for code

```ts
export const theme = {
  colors: {
    bg: '#F4F6F8', surface: '#FFFFFF',
    ink: '#17202B', ink2: '#4A5462', muted: '#5E6875', mutedIcon: '#6B7480',
    line: '#E3E7EC', lineInput: '#DDE2E8', fill: '#F0F3F7', track: '#E8ECF1',
    primary: '#2D63C8', primaryDark: '#1F4A99', primarySoft: '#E3ECFA', primaryTintText: '#D6E3FA',
    lime: '#D8F06C', limeSoft: '#E4F59E', limeText: '#2E3A0A',
    success: '#1D6E48', successSoft: '#DFF1E7',
    warning: '#6B4F00', warningSoft: '#FBF1D3',
    attention: '#8A3A12', attentionSoft: '#FBE8DA', attentionAction: '#A44A1E',
    danger: '#B42318', dangerSoft: '#FDE8E6',
    dot: '#E0703A', star: '#E5A823',
  },
  font: { family: 'Nunito', weights: [400, 600, 700, 800, 900] },
  radius: { chip: 10, input: 14, button: 16, card: 20, sheet: 28, hero: 32, pill: 999 },
  space: { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, screen: 20, screenAuth: 24, bottomAction: 34 },
  size: { touch: 44, input: 52, button: 54, tabBar: 86 },
};
```
