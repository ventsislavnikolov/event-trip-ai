import assert from "node:assert/strict";
import test from "node:test";
import { buildEventCandidateSelectionPrompt } from "../../lib/eventtrip/disambiguation-selection";

test("buildEventCandidateSelectionPrompt includes candidate context", () => {
  const prompt = buildEventCandidateSelectionPrompt({
    id: "ticketmaster:tm-1",
    name: "Tomorrowland 2026",
    location: "Boom, BE",
    startsAt: "2026-07-20T18:00:00.000Z",
  });

  assert.match(prompt, /I choose this event/i);
  assert.match(prompt, /Tomorrowland 2026/);
  assert.match(prompt, /Boom, BE/);
  assert.match(prompt, /2026-07-20T18:00:00.000Z/);
});

test("buildEventCandidateSelectionPrompt includes prior trip context when provided", () => {
  const prompt = buildEventCandidateSelectionPrompt(
    {
      id: "ticketmaster:tm-1",
      name: "Tomorrowland 2026",
      location: "Boom, BE",
    },
    {
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 900,
    }
  );

  assert.match(prompt, /From Sofia/i);
  assert.match(prompt, /for 2 travelers/i);
  assert.match(prompt, /max budget 900 per person/i);
});

test("buildEventCandidateSelectionPrompt works with minimal candidate fields", () => {
  const prompt = buildEventCandidateSelectionPrompt({
    id: "seatgeek:sg-1",
    name: "US Open",
  });

  assert.match(prompt, /US Open/);
  assert.match(prompt, /seatgeek:sg-1/);
});
