const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const nonMvpRoutes = [
  'app/(chat)/api/document/route.ts',
  'app/(chat)/api/suggestions/route.ts',
  'app/(chat)/api/files/upload/route.ts',
];

test('non-MVP route surfaces are removed', () => {
  for (const routeFile of nonMvpRoutes) {
    assert.equal(
      fs.existsSync(routeFile),
      false,
      `Expected ${routeFile} to be removed for MVP scope`
    );
  }
});
