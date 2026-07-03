# Parabolic Mobile — Product Requirements Document

**Version:** 0.2 · **Date:** July 3, 2026 · **Owner:** Sax
**Repo:** `saxm-dev/parabolic-mobile` · **Designs:** Figma `Parabolic (Copy)` → page **"Visual Exploration 03 — June 24"**

---

## 1. Product summary

Parabolic Mobile is the iOS app for Parabolic (parabolic.gg): **trade live win probability on real games with leverage**, using paper money. It is not a port of the web terminal — it is a purpose-designed mobile experience (Robinhood-style flows) built on the same Railway backend, oracle, and exchange engine as the web app.

**Beta goal:** a TestFlight build covering **every live sport the web app offers** (MLB, World Cup soccer, NFL, NBA/NCAAM, NHL, MLS — whatever the backend discovers in season), where the full loop — browse → market → wager → track → cash out — feels native and fast. No launch deadline and no user acquisition yet; the bar is quality, not a date.

**Success criteria:**
- New user: install → skippable welcome → first paper trade in under 60 seconds as a guest.
- Full loop works on-device for every live sport the backend serves.
- Crash-free ≥ 99.5%; usable on iPhone SE through Pro Max.
- Passes Beta App Review so an external TestFlight link exists (even if unshared for now).

## 2. Non-goals (v1)

- **No real money.** Paper USDC only; no deposits/withdrawals/wallet connect.
- **No Android build.**
- **No draw leg.** Soccer designs show 3 bet types (home/draw/away); all markets are strictly **2-way** (draws settle 0.5). The terminal and wager flow only ever offer two sides.
- **No limit orders.** Market orders with leverage + auto cash-out (TP/SL) only.
- **No iPad layout** (`supportsTablet: false`).

## 3. Users & identity

| User | Experience |
|---|---|
| Guest | Full access: browse, charts, chat (read), **trading is NOT gated** — a device-local guest UUID gets the standard **$10,000 paper balance, shown in the balance pill immediately** |
| Registered | Same + persistent cross-device balance, username on leaderboard, points/streaks, chat send |

- Guest UUID + auth token live in `expo-secure-store`.
- Signup **claims** the guest account (`POST /auth/register`) — balance and bet history carry over. Login: `POST /auth/login`; token attached to order/profile writes.
- **Terminology: "cash out" everywhere** — closing a position is always "Cash out", never "close position". Auto cash-out = TP/SL.
- **Wager input is dollars.** The $ amount (margin) is the canonical input; contracts and ¢/share are derived read-outs.

## 4. The four build targets

Everything below is designed in Figma and is the entire v1 surface. Exact frames:

| # | Flow | Figma nodes |
|---|---|---|
| 1 | Welcome + login | `63:1791` (hero + Skip), `63:2294` (name entry step) |
| 2 | Home | `63:2319` (base), `63:2583` (bet-placed chip variant) |
| 3 | Trading terminal | `63:2869` (Box Score state), `63:3719` (Gamecast state) — draw pill omitted |
| 4 | Wagering flow | `63:4321` (amount), `63:4924` (leverage sheet), `63:4740` (auto cash-out sheet), `63:4666` (review) |

Supporting sheets from the same page: cash-out sheet `63:3498`, position long-press overlay `63:4404`.

### 4.1 Welcome + login (`63:1791`, `63:2294`)
- First-launch screen: full-bleed athlete hero on "WIN" pattern (lime), wordmark top-left, **Skip pill top-right**, tagline "Trade LIVE on every game as it happens", white **Create account** CTA, dark **Log in** button.
- **Skip → Home as a guest** with $10k balance. No forced signup, ever.
- Create account: stepped conversational flow, one field per screen with the keyboard up (`63:2294` "What's your name" pattern) → username → password → (email optional) → claims guest UUID.
- Log in: username + password.
- Reachable later from Profile (guests see the same CTAs there).
- Ships with the WIN-pattern background only (no athlete imagery for now — decision July 3).

### 4.2 Home (`63:2319`, `63:2583`)
- **Top bar:** wordmark · **balance pill** (always visible, $10k for fresh guests; `GET /api/balance/:userId`) · avatar → Profile. After a fill, the top bar swaps to the **"Bet placed ✓ / View"** chip briefly (`63:2583`), View → the game.
- **Greeting block:** time-of-day greeting (+ name when known). Subline: open-bets P&L when the user has bets ("You're **+$450** FROM 5 BETS · 2 open bets still in play"), else live-game count.
- **Open bets strip:** horizontal cards (team flag/logo, name, P&L $, return % pill) → tap into the game.
- **Sport category nav:** horizontal chips with sport icons (Football, Soccer, Basketball, MMA… per design) — white active pill. Only sports with games appear; "All" default.
- **Market cards:** league label, LIVE pill, "A vs. B" title, logos + scores + clock (live) / countdown + start time (upcoming), per-side win % + split probability bar. Live section first, then **Upcoming**.
- **Liquid glass bottom nav — 5 targets**: **Home · Trades (bets) · Leaderboard (trophy) · Profile · Search**. Built on SDK 57 native tabs / `expo-glass-effect` so iOS renders true liquid glass. Search ships as a stub screen in v1 (no backend search yet).
- Data: `GET /api/games` 15s poll → WebSocket `game_update` push in M5.

### 4.3 Trading terminal (`63:2869`, `63:3719`)
- **Nav row:** back · bookmark (defer) · share (native sheet, links to `app.parabolic.gg`) · chat shortcut with unread dot.
- **Scoreboard:** logos, names, records, big score, period/clock, LIVE pill; pregame = countdown + start time.
- **Chart:** win-prob lines for **both sides** (no draw line) with floating `ABBR NN%` pills; volume read-out; timeframe chips **1H · 2H · 12H · 1D · LIVE** filtering `GET /api/oracle/:id/history`.
- **Chat teaser:** avatar stack + "N users chatting" + **Join chat** — opens the per-game chat (backend `src/chat.js` + WS is live on web). **Anyone can read AND send without logging in for now** (decision July 3 — mobile diverges from the web login gate; guests get a generated display name).
- **Tabs: Gamecast · Box Score · Chat.**
  - Gamecast: play timeline, scoring plays highlighted (goals/cards/subs markers for soccer, HT/FT dividers per design).
  - Box Score: possession-style leader bar + stat comparison rows with leader highlighting; Top players section when ESPN provides player data.
  - Chat: live per-game room (WS), auto bet-messages appear as on web; sender position chips.
- **My position in this market** (when open): row above tabs with live P&L → tap = **cash-out sheet** (`63:3498`: "Get back $X · Profit +$Y" → white "Cash out $Z" / "Keep it open"; reduce-only market order; P&L from the fill response).
- **Sticky wager bar: two pills** `[logo] NN%` (away / home) — the design's 3-pill soccer variant collapses to 2. Tap → wagering flow with side preselected. Disabled with reason when not tradeable.
- Poll 10s until WS.

### 4.4 Wagering flow (`63:4321` → `63:4924` / `63:4740` → `63:4666`)
1. **Amount** (`63:4321`): header "Buy {TEAM} at {NN}%" + balance pill · giant **$ amount** with custom in-app keypad · `+$1 +$2 +$5 +$10` chips · "{n} shares · {c}¢ per share" subline. Rows: **Leverage** ("Liquidation at NN%" · "4x >") and **Auto cash-out** toggle ("TP +$50 · SL −$25" summary). **Review** CTA (white pill).
2. **Leverage sheet** (`63:4924`): big "4x", slider 1x–10x with − / + steppers, **liquidation callout** ("Liquidation at 51% · Only 12.5% away" + High-risk pill when close), amber warning line, Confirm. Slider max = backend `maxLeverageBySide` from `GET /api/market/:gameId` (gap-aware caps).
3. **Auto cash-out sheet** (`63:4740`): Take-profit toggle → "Cash out at $X" with **+NN% slider (5%–300%)** and green +$ delta pill; Stop-loss same pattern below; Cancel / Confirm.
4. **Review** (`63:4666`): "BETTING ON {TEAM} TO WIN" coin badge · $ amount ("YOUR BET") · rows: Entry %, Leverage, Liquidation ~%, Auto cash-out summary · **Max loss** (red) and **Payout if win** (green) · **slide-to-confirm**.
5. **Submit:** `POST /api/orders` (market order, side, margin $, leverage, TP/SL, token when registered). Success → haptic + return to terminal with position visible + "Bet placed ✓" chip on Home. Backend rejections map to friendly copy (`leverageRejected`, `marketClosed`, balance).

## 5. Remaining surfaces (thin v1 versions)

- **Trades tab:** open bets (cash-out from here too) + settled history (`GET /api/profile/:userId/trades`). Long-press overlay (`63:4404`): Bet details / Go to match.
- **Profile tab:** guest → stats + Create account/Log in; registered → performance stats, grouped settings (Account details, Privacy, Support, Log out) per the web ProfilePage structure.
- **Leaderboard (trophy tab):** points ↔ ROI toggle, current-user row highlighted.
- **Search:** stub — market search comes later (needs backend endpoint).

## 6. Backend dependencies

| Need | Endpoint | Status |
|---|---|---|
| Games / detail / oracle history / market caps / orders / positions / balance / leaderboard / auth / profile / trades | existing REST | ✅ live |
| WS push: `game_update`, liquidation, settlement, chat | `wss://…/ws` | ✅ live |
| Per-game chat REST + WS | `src/chat.js` | ✅ live (confirm mobile can join WS room without web session) |
| Notifications feed | — | ❌ later (bell stays stub) |
| Market/text search | — | ❌ later (search stays stub) |
| Push notifications (APNs via Expo) | — | ❌ later milestone |

## 7. Design system

- **Tokens** (`src/constants/theme.ts`): carbon surfaces `#06070a / #0b0d11 / #11141a`, mint `#1fd182` (brand/positive), red `#ff5247` (negative/live pill), side accents home `#7cc0f4` / away `#e9a7f7`, lime `#d8f65f` (WIN motif/leader), **white pill = primary CTA** with near-black text.
- **Typography:** system font now; Clash Display + Hanken Grotesk via `expo-font` in the polish milestone (needs OTFs).
- **Materials:** liquid glass bottom nav (`expo-glass-effect` / native tabs); bottom sheets with grabber for leverage/TP-SL/cash-out.
- **Haptics:** slide-to-confirm progression, fill success, cash-out.
- **Assets needed from Sax:** app icon + splash (v99 sparkle-star mark), welcome hero image, sport chip icons if custom.

## 8. Non-functional & App Review

- Cold start → Home < 3s on LTE; 60fps chart pan; poll 15s/10s until WS milestone.
- Fetch timeouts + pull-to-refresh everywhere; offline = last cached state + banner; never fabricate data.
- Secrets: token/UUID in secure store only; TLS only; nothing sensitive in the repo.
- App Review: paper-trading/points framing in all App Store metadata (no bet/wager/cash-out language there), age 17+ (simulated gambling), privacy policy URL, App Privacy = contact info account-linked. Review notes state clearly: no real money in or out.

## 9. Milestones

| # | Deliverable | Definition of done |
|---|---|---|
| M0 ✅ | Foundation | Home cards, terminal (chart/gamecast/box score), leaderboard on live data |
| M1 | **Wagering flow** | Amount keypad → leverage sheet → auto cash-out sheet → review → slide-to-confirm → real fill → position visible in terminal; cash-out sheet works; errors handled |
| M2 | **Welcome + identity** | Welcome/login with Skip, stepped signup claiming guest UUID, balance pill everywhere ($10k guests), Trades tab with history |
| M3 | **Terminal complete + glass nav** | Chat tab + teaser live over WS, timeframe chips, records/leader highlighting, 5-icon liquid glass nav with bell/search stubs, home open-bets strip + P&L greeting + bet-placed chip |
| M4 | **TestFlight internal** | Icon/splash, `eas build` production, App Store Connect record, installed on Sax's phone |
| M5 | **Live polish + external-ready** | WS everywhere (no polling), brand fonts, haptics tuned, scoring markers on chart, Beta App Review passed |

## 10. Open questions

None — all v0.1/v0.2 questions resolved July 3: trophy/Leaderboard replaces the bell; chat is open to guests for now; welcome ships WIN-pattern-only. Build order: welcome/login → home → terminal → wagering flow.
