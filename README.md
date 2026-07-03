# Parabolic Mobile

iOS app for [Parabolic](https://parabolic.gg) — trade live win probability on real games.

Built with Expo SDK 57 (React Native + expo-router native tabs), shipped to TestFlight via EAS Build/Submit (cloud iOS builds — no Mac required).

## Stack

- **Expo SDK 57** / React Native 0.86 / TypeScript, `expo-router` with native iOS tabs
- **Backend**: same Railway API as the web terminal (`src/lib/api.ts`)
- **Theme**: Parabolic carbon + mint palette, mirrored from the web app (`src/constants/theme.ts`)

## Develop

```sh
npm install
npx expo start        # scan QR with Expo Go on iPhone
npx expo start --web  # browser preview
```

## Build & ship

```sh
eas build --platform ios --profile production
eas submit --platform ios
```

## Layout

- `src/app/` — screens (expo-router): `index` Markets, `positions`, `leaderboard`, `profile`
- `src/lib/api.ts` — typed backend client (games, oracle, leaderboard)
- `src/constants/theme.ts` — brand palette + spacing
- `src/components/app-tabs.tsx` — native tab bar (`.web.tsx` variant for browser)
