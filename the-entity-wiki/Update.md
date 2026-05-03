# Update

Date: 2026-04-30

## 9.6.0 Mid-Season Sync

Updated the app to the live DBD 9.6.0 patch using the local sync pipeline.

- Refreshed Otz community content, map-layout metadata, game icons, perk/add-on reports, and runtime web bundles.
- Scraped the current cosmetics wiki inventory and expanded cosmetics coverage to 103 character swaps and 4,136 full-set entries.
- Downloaded 105 new cosmetic assets and refreshed the Android full-set cosmetic asset pack.
- Applied official 9.6.0 overrides for Fast Track, affected killer add-ons, and Blight's 4.4 m/s movement speed because the public description API had not fully caught up yet.
- Updated app metadata to 5.30.0 / game version 9.6.0.

Validation passed:

```text
node scripts/normalize-images.js --check
node scripts/build-data.js --check
node scripts/audit-cosmetics.js
node scripts/verify-teachables.js
node scripts/verify-perk-descriptions.js
node scripts/verify-data-contracts.js
node scripts/verify-offline-runtime.js
python3 scripts/smoke-test.py
npm run android:copy
npm run android:prepare-release-assets
```

Sources checked:

- Official 9.6.0 notes via BHVR/SteamDB.
- Officially recognised DBD Wiki patch page.
- Otzdarva public resource pages.

---

Date: 2026-04-17

## Perk Description Rendering Fix

The killer-card perk slide-up view was showing unresolved post-9.5.0 description tokens for some killer perks, for example:

```text
{Tunable.K40P02.AuraRevealDuration}s
{Tunable.K40P02.Cooldown}s
```

The issue was in the data sync pipeline, not the slide-up renderer. The slide-up correctly rendered `descriptionPost95`, but some synced post-9.5.0 descriptions still contained raw API template tokens.

## Root Cause

`scripts/sync-descriptions.js` only handled older placeholder formats, such as positional tokens and exact simple keys. The current perk API also returns named template tokens, including:

- `{Tunable...}`
- `{Keyword...}`
- `{Input...}`

Those tokens were not resolved before writing `descriptionPost95` into `content/database.json` and the generated runtime bundle.

## What Changed

- Updated `scripts/sync-descriptions.js` to resolve named tunable, keyword, and input tokens.
- Regenerated canonical and runtime data:
  - `content/database.json`
  - `web/data.js`
- Added verification so unresolved named post-9.5.0 tokens now fail checks.
- Updated the fallback perk manifest pipeline to reject unresolved named tokens as well.
- Fixed one fallback manifest entry for Clairvoyance where `{Input.UseItem}` needed readable text.

## Result

Phantom Fear now resolves in the runtime bundle as:

```text
Whenever a Survivor within your Terror Radius looks at you, they scream, then you see their Aura for 2s. Cooldown: 80/70/60s.
```

The runtime bundle was checked for unresolved named tokens and returned `0` remaining matches.

## Verification

The following checks passed:

```text
node scripts/build-data.js --check
node scripts/verify-perk-descriptions.js
node scripts/verify-data-contracts.js
node scripts/verify-offline-runtime.js
python3 scripts/smoke-test.py
```

The smoke test passed all 8 scenarios, including the killer profile flow.

## Notes

- No runtime fetching was added.
- `web/data.js` was regenerated from the canonical content source.
- The old `NEXT_STEPS.md` handoff checklist was replaced by this update file.
