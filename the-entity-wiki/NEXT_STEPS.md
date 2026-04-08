# The Entity's Wiki: Handoff Notes

Last updated: 2026-03-29

## Project Contract

- The app is an offline snapshot of Dead by Daylight.
- The built app must never self-refresh or depend on runtime internet access.
- Content updates happen only when a new release is prepared and built.

## Current Status

### Phase 1

Phase 1 is complete.

What phase 1 means in practice:

- Startup JS is local.
- Runtime image resolution is local-only.
- Missing perk/map art now has explicit local fallback assets.
- A verification command exists to catch regressions: `npm run verify:offline`
- Android web assets were synced with `npm run android:copy`

Important note:

- Phase 4 later cleaned the shipped database so those legacy remote-looking gameplay image strings are no longer part of the active runtime data.
- The phase 1 guarantee still matters: runtime rendering must remain local-only even if future content work introduces bad paths by mistake.

### Phase 2

Phase 2 is complete.

What phase 2 means in practice:

- The canonical build-time source for shipped database content now lives in:
  - `content/database.json`
  - `content/timeline.json`
- The shipped runtime files are now generated artifacts:
  - `web/data.js`
  - `web/lore.js`
- The generator entrypoint is:
  - `scripts/build-data.js`
- The data pipeline commands are:
  - `npm run build:data`
  - `npm run check:data`

Important note:

- `api/` remains in the repo as legacy/reference material only.
- `api/dbd_data.json` is still **not** part of the active build path.
- `web/scripts/*.py` are not the canonical pipeline for shipped runtime data.

## How The App Actually Works

These points matter before touching data or scripts:

- The shipped app runtime reads:
  - `web/index.html`
  - `web/data.js`
  - `web/lore.js`
- The runtime does **not** use `api/dbd_data.json`
- User-created data is stored locally via `localStorage`
- Capacitor serves the local `web/` bundle

Practical implication:

- Updating `api/dbd_data.json` alone does not update the app.
- If content changes are made, they must end up in the files the app actually ships with.

## Ordered Next Steps

## Phase 3: Refresh The DBD Snapshot

Phase 3 is complete.

What phase 3 means in practice:

- The offline snapshot now targets `9.5.0 | All-Kill: Comeback` from March 12, 2026.
- `content/database.json` now includes Kwon Tae-Young, his 3 perks, the Sleepless District realm, and Trickster's Delusion.
- `content/timeline.json` now includes the `All-Kill: Comeback` release entry.
- The shipped data was regenerated into:
  - `web/data.js`
  - `web/lore.js`
- Hardcoded DBD text in `web/index.html` was reviewed and updated where it would otherwise surface stale names or stale live-state references:
  - changelog
  - perk synergies
  - Trickster guide/stats
  - premade builds
  - achievements
  - glossary sync

Important live-state corrections included in this phase:

- Halloween perk names now use the current live primary names, while old names remain as aliases for compatibility.
- Haddonfield / Lampkin Lane were removed from the current live database snapshot after the official retirement notice, while historical timeline data remains intact.
- Trickster's live rework and the targeted stale perk descriptions identified in the audit were updated in the canonical source.

Verification completed in this phase:

- `npm run build:data`
- `npm run check:data`
- `npm run verify:content`
- `npm run verify:offline`
- `npm run android:copy`

Additional content-integrity guarantee now in place:

- `scripts/verify-teachables.js` checks that every killer and survivor in `content/database.json` owns exactly 3 teachable perks.
- The same verifier checks that every teachable perk icon resolves to a bundled local file using the same perk resolution logic the app uses at runtime.
- `npm run check:data` now includes this teachable-link verification, so Taurie-style missing-link regressions should fail during the normal content pipeline.

Primary official sources used for this phase:

- `https://support.deadbydaylight.com/hc/pt-br/articles/47138866657044-9-5-0-All-Kill-Comeback`
- `https://deadbydaylight.com/news/all-kill-comeback-trickster-map-kwon-tae-young/`
- `https://deadbydaylight.com/game/characters/kwon-tae-young/`
- `https://deadbydaylight.com/game/characters/the-trickster/`
- `https://deadbydaylight.com/news/halloween-leaving-dead-by-daylight/`

## Phase 4: Normalize Asset References

Phase 4 is complete.

What phase 4 means in practice:

- `content/database.json` image fields for shipped gameplay content now use explicit bundled local paths only:
  - `assets/...`
  - `dbd_images/...`
- Regenerated `web/data.js` no longer contains gameplay image refs like:
  - `https://dbd.tricky.lol/...`
  - `UI/Icons/...`
- The old runtime rescue logic was removed from `web/index.html`, including:
  - `IMAGE_ALIASES`
  - `buildPerkCandidates`
  - `buildMapCandidates`
  - raw remote URL promotion for shipped content
- The shared `AssetFrame` renderer now accepts only local shipped image paths plus default local fallback assets.

New/updated tooling added in this phase:

- `scripts/normalize-images.js`
- `npm run normalize:images`
- `npm run check:images`

Verification tightened in this phase:

- `npm run check:data` now fails if canonical image normalization is stale.
- `npm run verify:content` now assumes teachable perk images are already explicit local files and checks the local files directly.
- `npm run verify:offline` now fails if generated gameplay data contains remote-looking or Unreal-style image refs, and it also checks that the legacy runtime resolver helpers stay removed.

Important implementation notes:

- Killer power entries that live in the `items` dataset were normalized to their real bundled power art under `dbd_images/powers/...`.
- A few truly missing bundled assets were mapped to explicit local placeholders so the offline contract remains deterministic:
  - `dbd_images/items/iconitems_missing.png`
  - `dbd_images/addons/iconaddon_missing.png`
  - `dbd_images/offerings/iconfavors_missing.png`
- `The Onryō` power icon path now preserves the accented `ō`, which matches the actual bundled filename and avoids a silent broken icon.

Verification completed in this phase:

- `npm run normalize:images`
- `npm run build:data`
- `npm run check:data`
- `npm run verify:content`
- `npm run verify:offline`
- deterministic second `npm run build:data`
- `npm run android:copy`

## Phase 5: Release Hardening

Goal:

- Make releases predictable and easy to verify.

What to do:

- Document the full release flow
- Keep the offline verifier in the release checklist
- Build Android locally once SDK configuration is available
- Decide whether the Android `INTERNET` permission should remain

Suggested release flow:

1. Update canonical content source
2. Generate shipped web data
3. Run `npm run check:data`
4. Run `npm run verify:offline`
5. Run `npm run android:copy`
6. Build the Android app
7. Smoke test the packaged app offline

## Things To Avoid

- Do not add runtime fetches, CDN scripts, remote fonts, or remote fallback logic.
- Do not update only `api/dbd_data.json` and assume the app changed.
- Do not hand-edit `web/data.js` or `web/lore.js`; regenerate them from `content/*`.
- Do not remove `npm run verify:offline`; extend it if needed.
- Do not mix data refresh work with large architecture changes in the same pass unless the pipeline is already stable.

## Quick Commands

- Normalize canonical gameplay image paths:
  - `npm run normalize:images`
- Sync trusted post-9.5 perk descriptions into the canonical database:
  - `npm run sync:perk-descriptions`
- Generate shipped runtime data:
  - `npm run build:data`
- Check that generated runtime data is current:
  - `npm run check:data`
- Verify character-to-teachable links and local teachable icons:
  - `npm run verify:content`
- Offline verification:
  - `npm run verify:offline`
- Sync web bundle into Android:
  - `npm run android:copy`
- Full Android release build:
  - `npm run android:build`

## Final Reminder

The guiding rule for all future work:

- The app is a packaged offline encyclopedia, not a live client.
- Every change should preserve that model.

## Perk Description Mode

Current model:

- `web/index.html` now supports a Settings toggle between `legacy` and `post95` perk descriptions.
- `content/database.json` stores legacy text in `description`.
- Verified newer wording is stored in `descriptionPost95`.
- All `309` perks are now classified in `content/perk-description-report.json` as either:
  - `different`
  - `same_as_legacy`
- In the app, `post95` mode shows `descriptionPost95` when present, otherwise it falls back to `description`.

Source policy:

- The canonical source for the full post-9.5 verification pass is the set of NightLight manifest shards:
  - `scripts/perk-description-manifest-part1.json`
  - `scripts/perk-description-manifest-part2.json`
  - `scripts/perk-description-manifest-part3.json`
  - `scripts/perk-description-manifest-part4.json`
  - `scripts/perk-description-manifest-part5.json`
  - `scripts/perk-description-manifest-part6.json`
- Each manifest entry records:
  - `status`
  - `sourceUrl`
  - `descriptionPost95` when the wording is actually different
- The source pages are NightLight direct perk pages, not wiki summaries or marketing blurbs.

Important implementation details:

- `npm run sync:perk-descriptions` now runs a deterministic importer:
  - `python3 scripts/sync-perk-descriptions.py`
- The importer requires every perk to be present in the manifest shards and fails if anything is unresolved.
- The importer strips NightLight flavor quotes and glossary/help lines before storing `descriptionPost95`.
- The importer also writes `content/perk-description-report.json`, which is the provenance/coverage report for the full 309-perk roster.
- `verify:content` and `check:data` now include `scripts/verify-perk-descriptions.js`.
- Current verified counts:
  - `different = 194`
  - `same_as_legacy = 115`
  - `unresolved = 0`
- The UI highlights percentage tokens in post-9.5 mode and preserves multiline/bullet formatting where stored.
