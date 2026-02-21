import assert from "node:assert/strict";
import test from "node:test";
import { buildEventTripOutboundLinks } from "../../lib/eventtrip/outbound-links";

test("buildEventTripOutboundLinks adds UTM and package tracking params", () => {
  const links = buildEventTripOutboundLinks({
    packageId: "provider-1-2",
    tier: "Best Value",
    env: {},
  });

  for (const value of Object.values(links)) {
    const url = new URL(value);
    assert.equal(url.searchParams.get("utm_source"), "eventtrip");
    assert.equal(url.searchParams.get("utm_medium"), "assistant");
    assert.equal(url.searchParams.get("utm_campaign"), "eventtrip_mvp");
    assert.equal(url.searchParams.get("package_id"), "provider-1-2");
    assert.equal(url.searchParams.get("tier"), "Best Value");
  }
});

test("buildEventTripOutboundLinks appends travelpayouts marker to flight and hotel links", () => {
  const links = buildEventTripOutboundLinks({
    packageId: "provider-1-2",
    tier: "Budget",
    env: {
      TRAVELPAYOUTS_MARKER: "marker-123",
    },
  });

  const flightUrl = new URL(links.flight);
  const hotelUrl = new URL(links.hotel);
  const ticketUrl = new URL(links.ticket);

  assert.equal(flightUrl.searchParams.get("marker"), "marker-123");
  assert.equal(hotelUrl.searchParams.get("marker"), "marker-123");
  assert.equal(ticketUrl.searchParams.get("marker"), null);
});
