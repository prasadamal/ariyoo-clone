# Ariyoo Mobile (iOS & Android)

Production-ready Expo app for the Ariyoo expert Q&A platform.

## Stack

- Expo SDK 57 + Expo Router (tabs + stack)
- React Native Paper (dark theme)
- Axios + Socket.IO client
- Secure token storage (`expo-secure-store`), push via `expo-notifications`

## What the app does

- **Ask:** write a question with #topics. An expert who follows a topic gets it; otherwise it waits in the open queue.
- **Chats:** your conversations, and (for experts) open questions to pick up.
- **Conversation:** text and photos, live. Report or block from the ⋮ menu.
- **Profile:** expert mode and topics, blocked people, terms and privacy, sign out, delete account.

## Development

```bash
cd apps/mobile
npm ci
cp .env.example .env.local   # optional
npm start
npm run verify               # typecheck + unit tests
```

Point the app at your API:

- iOS simulator: `http://localhost:5296` (default in dev)
- Android emulator: `http://10.0.2.2:5296` (default in dev)
- Physical device: set `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5296`

Start the API from the repo root environment (`services/api` on port 5296).

## Production builds

See **`store/SUBMISSION_CHECKLIST.md`** for full Play Store and App Store steps.

```bash
eas login
eas init
npm run build:all      # cloud builds for iOS + Android
npm run submit:android
npm run submit:ios
```

Bundle identifiers:

| Platform | ID |
| --- | --- |
| iOS | `com.ariyoo.mobile` |
| Android | `com.ariyoo.mobile` |

## Store assets

- Listing copy: `store/play-store-listing.md`, `store/app-store-listing.md`
- Privacy policy template: `store/PRIVACY_POLICY.md`
