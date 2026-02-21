import assert from "node:assert/strict";
import test from "node:test";
import { appMetadata } from "../../lib/seo/metadata";

test("app metadata is branded for EventTrip", () => {
  assert.equal(appMetadata.title, "EventTrip.ai | Event-First Trip Planning");
  assert.match(
    String(appMetadata.description ?? ""),
    /event-first trip planning/i
  );
});
