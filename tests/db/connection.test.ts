import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePostgresUrl } from '../../lib/db/connection';

test('resolvePostgresUrl returns POSTGRES_URL when present', () => {
  const url = resolvePostgresUrl({
    POSTGRES_URL: 'postgres://u:p@db.supabase.co:5432/postgres',
  });

  assert.equal(url, 'postgres://u:p@db.supabase.co:5432/postgres');
});

test('resolvePostgresUrl returns null when missing and required is false', () => {
  const url = resolvePostgresUrl({}, { required: false });

  assert.equal(url, null);
});

test('resolvePostgresUrl throws when missing and required is true', () => {
  assert.throws(
    () => resolvePostgresUrl({}, { required: true }),
    /POSTGRES_URL is required/
  );
});
