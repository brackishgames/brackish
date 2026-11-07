import test from 'node:test';
import assert from 'node:assert/strict';
import { mph, knots } from '../../src/lib/units.js';

test('a knot is one nautical mile an hour, and about 1.15 miles an hour', () => {
  assert.ok(Math.abs(knots(1852 / 3600) - 1) < 1e-12);
  assert.ok(Math.abs(mph(1609.344 / 3600) - 1) < 1e-12);
  assert.ok(Math.abs(mph(1) / knots(1) - 1.15078) < 1e-4);
});
