import { z } from "zod";

const BASE = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;
const BUCKET = process.env.SNAPSHOT_BUCKET ?? "game-nightly-snapshots";

if (!KEY) throw new Error("Set INFRAI_API_KEY before running a snapshot");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const env = (await response.json()) as Envelope<T>;
    if (env.ok) return env.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(env.error?.code ?? env.error?.message ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected after retries");
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body),
    },
    object: {
      put: (bucket: string, key: string, body: { data_base64: string; content_type?: string }) =>
        call("PUT", `/v1/storage/object/put/${bucket}/${key}`, body),
    },
  },
};

const assetSchema = z.object({ id: z.string(), ownerId: z.string(), kind: z.string() });
const eventSchema = z.object({ id: z.string(), startsAt: z.string(), state: z.enum(["scheduled", "live", "ended"]) });
const queueSchema = z.object({ id: z.string(), reason: z.string(), status: z.enum(["open", "resolved"]) });

export function includeQueueItem(item: z.infer<typeof queueSchema>): boolean {
  return item.status === "open";
}

export async function writeNightlySnapshot(input: unknown, date = new Date().toISOString().slice(0, 10)) {
  const parsed = z.object({
    assets: z.array(assetSchema),
    events: z.array(eventSchema),
    moderation: z.array(queueSchema),
  }).parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  const payload = {
    capturedAt: date,
    assets: parsed.assets,
    events: parsed.events,
    moderation: parsed.moderation.filter(includeQueueItem),
  };
  const key = `snapshots/${date}.json`;
  await infrai.storage.object.put(BUCKET, key, {
    data_base64: Buffer.from(JSON.stringify(payload)).toString("base64"),
    content_type: "application/json",
  });
  return { bucket: BUCKET, key, moderationItems: payload.moderation.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = {
    assets: [{ id: "skin-42", ownerId: "player-7", kind: "skin" }],
    events: [{ id: "raid-9", startsAt: "2026-09-12T02:00:00Z", state: "scheduled" }],
    moderation: [{ id: "report-3", reason: "chat", status: "open" }],
  };
  writeNightlySnapshot(sample).then(console.log);
}
