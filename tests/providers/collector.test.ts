import assert from 'node:assert/strict';
import test from 'node:test';

import { collectProviderData } from '../../lib/eventtrip/providers/collector';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('returns degraded result when one provider times out', async () => {
  const result = await collectProviderData({
    timeoutMs: 50,
    retries: 0,
    providers: {
      ticketmaster: async () => ['ticket-1'],
      seatgeek: async () => {
        await sleep(100);
        return ['ticket-2'];
      },
      travelpayouts: async () => ['travel-1'],
    },
  });

  assert.equal(result.degraded, true);
  assert.deepEqual(result.results.ticketmaster, ['ticket-1']);
  assert.deepEqual(result.results.travelpayouts, ['travel-1']);
  assert.equal(result.results.seatgeek, null);
  assert.equal(result.failures.seatgeek?.kind, 'timeout');
});

test('retries provider call once and succeeds', async () => {
  let attempts = 0;

  const result = await collectProviderData({
    timeoutMs: 100,
    retries: 1,
    providers: {
      ticketmaster: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('temporary failure');
        }
        return ['ticket-1'];
      },
      seatgeek: async () => ['ticket-2'],
      travelpayouts: async () => ['travel-1'],
    },
  });

  assert.equal(attempts, 2);
  assert.equal(result.degraded, false);
  assert.deepEqual(result.results.ticketmaster, ['ticket-1']);
  assert.equal(result.failures.ticketmaster, null);
});
