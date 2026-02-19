import assert from 'node:assert/strict';
import test from 'node:test';

import { buildIntentGateResult } from '../../app/(chat)/api/chat/intent';

test('buildIntentGateResult returns follow-up for incomplete user intent', async () => {
  const result = await buildIntentGateResult({
    message: {
      role: 'user',
      parts: [{ type: 'text', text: 'Going to Tomorrowland from Sofia' }],
    },
    model: {} as never,
    generateObjectFn: (async () => ({
      object: {
        event: 'Tomorrowland',
        originCity: 'Sofia',
      },
    })) as never,
  });

  assert.equal(result.shouldInterrupt, true);
  assert.match(result.followUpQuestion ?? '', /(travelers|max budget)/i);
});

test('buildIntentGateResult does not interrupt when intent is complete', async () => {
  const result = await buildIntentGateResult({
    message: {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Tomorrowland from Sofia for 2 travelers max budget 1200',
        },
      ],
    },
    model: {} as never,
    generateObjectFn: (async () => ({
      object: {
        event: 'Tomorrowland',
        originCity: 'Sofia',
        travelers: 2,
        maxBudgetPerPerson: 1200,
      },
    })) as never,
  });

  assert.equal(result.shouldInterrupt, false);
  assert.equal(result.followUpQuestion, null);
});
