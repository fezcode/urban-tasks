# Urban Tasks — Mobile

Expo / React Native client, sharing auth + data with the web app's backend.

## Theme

Colors, typography, and spacing are mirrored from `frontend/src/index.css` into
`src/theme/tokens.ts`. Keep both in sync when the palette changes. Light and
dark palettes match the web app's warm / terracotta aesthetic.

## Run

```bash
cd mobile
npm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, `w` for web.

## API base URL

Defaults to `http://localhost:8080`. Override with an env var when starting
Expo:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:8080 npx expo start
```

When running on a physical device, the backend must be reachable from that
device's network (use your machine's LAN IP, not `localhost`).

## Stack

- Expo SDK 52
- expo-router (file-based routing)
- expo-secure-store (token persistence)
- React Native 0.76 with new architecture
