import assert from "node:assert/strict";
import test from "node:test";
import { buildEventTripFunnelEvent } from "../../lib/eventtrip/analytics/funnel-events";

test("buildEventTripFunnelEvent returns a structured event payload", () => {
  const event = buildEventTripFunnelEvent("packages_generated", {
    chatId: "chat-123",
    packageCount: 3,
  });

  assert.equal(event.event, "packages_generated");
  assert.equal(event.payload.chatId, "chat-123");
  assert.equal(event.payload.packageCount, 3);
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
});
