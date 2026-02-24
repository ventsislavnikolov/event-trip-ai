import assert from "node:assert/strict";
import test from "node:test";
import { searchCuratedEventIndex } from "../../lib/eventtrip/providers/curated-index";

test("searchCuratedEventIndex prioritizes Italy-relevant F1 curated events", async () => {
  const results = await searchCuratedEventIndex(
    "Formula 1 Italy Grand Prix 2026"
  );

  assert.equal(results.length > 0, true);
  assert.equal(results[0]?.country, "IT");
  assert.equal(
    results.some((event) => event.id === "curated-f1-italian-gp-2026"),
    true
  );
  assert.equal(
    results.some((event) => event.id === "curated-f1-emilia-romagna-2026"),
    true
  );
});

test("searchCuratedEventIndex keeps top candidate focused on Italy for Italy query", async () => {
  const results = await searchCuratedEventIndex("f1 italy gp 2026");

  assert.equal(results.length > 0, true);
  assert.equal(results[0]?.country, "IT");
});

test("searchCuratedEventIndex does not mix F1 events into Tomorrowland query", async () => {
  const results = await searchCuratedEventIndex(
    "Tomorrowland 2026 from Sofia for 2 travelers"
  );

  assert.equal(results.length > 0, true);
  assert.equal(results[0]?.id, "curated-tomorrowland-2026");
  assert.equal(
    results.some((event) => event.id.startsWith("curated-f1-")),
    false
  );
});
