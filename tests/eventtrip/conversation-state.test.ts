import assert from "node:assert/strict";
import test from "node:test";
import { deriveEventTripConversationState } from "../../lib/eventtrip/conversation-state";

test("returns idle phase for empty message history", () => {
  const state = deriveEventTripConversationState([]);

  assert.equal(state.phase, "idle");
  assert.equal(state.suggestedPrompts.length > 0, true);
});

test("returns event-selection phase when candidates exist without selection", () => {
  const state = deriveEventTripConversationState([
    {
      role: "assistant",
      parts: [{ type: "data-eventtripCandidates" }],
    },
  ]);

  assert.equal(state.phase, "event-selection");
});

test("returns packages-ready phase when package data is present", () => {
  const state = deriveEventTripConversationState([
    {
      role: "assistant",
      parts: [{ type: "data-eventtripPackages" }],
    },
  ]);

  assert.equal(state.phase, "packages-ready");
});

test("returns collecting-requirements when assistant asks follow-up details", () => {
  const state = deriveEventTripConversationState([
    {
      role: "assistant",
      parts: [{ type: "text", text: "What is your max budget per person?" }],
    },
  ]);

  assert.equal(state.phase, "collecting-requirements");
});
