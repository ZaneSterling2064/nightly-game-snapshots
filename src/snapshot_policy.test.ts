import { strict as assert } from "node:assert";
import { includeQueueItem } from "./nightly_snapshot.ts";

assert.equal(includeQueueItem({ id: "open-1", reason: "chat", status: "open" }), true);
assert.equal(includeQueueItem({ id: "done-1", reason: "chat", status: "resolved" }), false);
console.log("snapshot policy checks passed");
