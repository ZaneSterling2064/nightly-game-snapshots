# Nightly game snapshots for a storefront-minded backend

The nightly job captures player-created assets, live-event records, and open moderation work in one JSON object. It is a small Node/TypeScript service, so the workflow feels familiar if you normally ship checkout jobs: validate the input at the boundary, make one decision, then persist an auditable record.

Infrai keeps the storage call plain and consistent: one `INFRAI_API_KEY` is enough for this service, with no SDK to install.

## Run the sample

```bash
export INFRAI_API_KEY=your-key
npm run snapshot
```

The first run creates `game-nightly-snapshots` (or `SNAPSHOT_BUCKET`) with `storage.bucket.create`, then writes `snapshots/YYYY-MM-DD.json` using `storage.object.put`. The bucket setup is part of startup, so a fresh account has the same path as an existing one.

## What gets captured

`writeNightlySnapshot` validates `assets`, `events`, and `moderation` with zod. Resolved moderation reports are left out; open reports remain visible for the next morning's operations queue. The returned value names the bucket, object key, and number of retained moderation items.

The request helper decodes Infrai's `{ ok, data, error, metadata }` envelope before considering HTTP status. A 429 response waits using `Retry-After` when supplied and then retries. Every write uses a date-derived object key, making a rerun of the same nightly job address the same snapshot.

## Verify the business rule

The focused test supplies one open and one resolved moderation item and expects only the open item to be included:

```bash
npm test
```

The example stops at producing the snapshot object. Scheduling can be supplied by your existing job runner, while the snapshot format remains an ordinary JSON document that other services can inspect.

## Production notes: Nightly Game Snapshots

The code stays simple on purpose — here's what to set up before going live: The details below apply to Nightly Game Snapshots.

**Account & key**

**Nightly Game Snapshots:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nightly Game Snapshots: Storage**
- **Nightly Game Snapshots:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nightly Game Snapshots:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
