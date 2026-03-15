# DBD App: The Entity's Wiki

Android app project for the Dead by Daylight companion app, built with Capacitor around the web version of the site.

## Project Structure
- `the-entity-wiki/web/` static frontend bundled into the app
- `the-entity-wiki/android/` native Android project
- `api/` data files and helper scripts
- `assets/` shared images and resources

## Build
```bash
cd the-entity-wiki
npm install
npm run sync
npm run android:build
```

## Open In Android Studio
```bash
cd the-entity-wiki
npm run android:open
```

## Signed Releases
For production signing, add your own Android keystore and signing configuration locally before building a release APK or AAB.
