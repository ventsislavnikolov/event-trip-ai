import assert from "node:assert/strict";
import test from "node:test";

import { resolveIntentModelIds } from "../../lib/eventtrip/intent/model-routing";

test("resolveIntentModelIds defaults to selected chat model when no env overrides are set", () => {
  const resolved = resolveIntentModelIds({
    selectedChatModel: "google/gemini-2.5-flash-lite",
    env: {},
  });

  assert.equal(resolved.primaryModelId, "google/gemini-2.5-flash-lite");
  assert.equal(resolved.fallbackModelId, null);
});

test("resolveIntentModelIds applies env primary and fallback overrides", () => {
  const resolved = resolveIntentModelIds({
    selectedChatModel: "google/gemini-2.5-flash-lite",
    env: {
      EVENTTRIP_INTENT_PRIMARY_MODEL: "anthropic/claude-haiku-4.5",
      EVENTTRIP_INTENT_FALLBACK_MODEL: "openai/gpt-4.1-mini",
    },
  });

  assert.equal(resolved.primaryModelId, "anthropic/claude-haiku-4.5");
  assert.equal(resolved.fallbackModelId, "openai/gpt-4.1-mini");
});

test("resolveIntentModelIds drops fallback when it matches the primary model", () => {
  const resolved = resolveIntentModelIds({
    selectedChatModel: "google/gemini-2.5-flash-lite",
    env: {
      EVENTTRIP_INTENT_PRIMARY_MODEL: "openai/gpt-4.1-mini",
      EVENTTRIP_INTENT_FALLBACK_MODEL: "openai/gpt-4.1-mini",
    },
  });

  assert.equal(resolved.primaryModelId, "openai/gpt-4.1-mini");
  assert.equal(resolved.fallbackModelId, null);
});
