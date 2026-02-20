import assert from "node:assert/strict";
import test from "node:test";
import { resolveAirportCode } from "../../lib/eventtrip/providers/airport-code-resolver";

test("resolveAirportCode keeps explicit iata code", () => {
  assert.equal(resolveAirportCode("SOF"), "SOF");
  assert.equal(resolveAirportCode("from (JFK)"), "JFK");
});

test("resolveAirportCode resolves exact city names", () => {
  assert.equal(resolveAirportCode("Sofia"), "SOF");
  assert.equal(resolveAirportCode("Boom"), "BRU");
  assert.equal(resolveAirportCode("Los Angeles"), "LAX");
});

test("resolveAirportCode resolves alias names", () => {
  assert.equal(resolveAirportCode("NYC"), "JFK");
  assert.equal(resolveAirportCode("New York City"), "JFK");
  assert.equal(resolveAirportCode("SF"), "SFO");
});

test("resolveAirportCode resolves segmented location labels", () => {
  assert.equal(resolveAirportCode("Boom, Belgium"), "BRU");
  assert.equal(resolveAirportCode("Travel from Sofia / Bulgaria"), "SOF");
});

test("resolveAirportCode ignores airport suffix words", () => {
  assert.equal(resolveAirportCode("Berlin International Airport"), "BER");
  assert.equal(resolveAirportCode("Paris city airport"), "CDG");
});

test("resolveAirportCode returns undefined for unknown inputs", () => {
  assert.equal(resolveAirportCode("Atlantis"), undefined);
  assert.equal(resolveAirportCode(""), undefined);
});
