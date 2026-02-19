const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('template baseline files exist', () => {
  assert.equal(fs.existsSync('app'), true);
  assert.equal(fs.existsSync('lib'), true);
});
