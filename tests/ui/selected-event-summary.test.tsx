import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SelectedEventSummary } from "../../components/eventtrip/selected-event-summary";

test("renders selected event metadata", () => {
  const html = renderToStaticMarkup(
    <SelectedEventSummary
      event={{
        provider: "ticketmaster",
        providerEventId: "tm-1",
        name: "Tomorrowland 2026",
        city: "Boom",
        country: "BE",
        venue: "Main Stage",
        startsAt: "2026-07-20T18:00:00.000Z",
      }}
    />
  );

  assert.match(html, /Tomorrowland 2026/);
  assert.match(html, /Provider: ticketmaster/);
  assert.match(html, /Location: Boom, BE/);
  assert.match(html, /Venue: Main Stage/);
  assert.match(html, /Starts: 2026-07-20/);
});
