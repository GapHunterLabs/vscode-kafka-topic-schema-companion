import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaFileNameFor, validate } from '../schemaValidator';

test('schemaFileNameFor derives the schema name from .sample.json', () => {
  assert.equal(schemaFileNameFor('orders-created.sample.json'), 'orders-created.schema.json');
});

test('schemaFileNameFor derives the schema name from .message.json', () => {
  assert.equal(schemaFileNameFor('orders-created.message.json'), 'orders-created.schema.json');
});

test('schemaFileNameFor returns null for an unrelated file name', () => {
  assert.equal(schemaFileNameFor('orders-created.json'), null);
});

test('validate accepts a matching object', () => {
  const schema = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
  const value = { id: 'abc' };
  assert.deepEqual(validate(schema, value), []);
});

test('validate flags a missing required property', () => {
  const schema = { type: 'object', required: ['id'], properties: {} };
  const value = {};
  const violations = validate(schema, value);
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /missing required property "id"/);
});

test('validate flags a type mismatch', () => {
  const schema = { type: 'object', properties: { id: { type: 'string' } } };
  const value = { id: 123 };
  const violations = validate(schema, value);
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /expected type "string" but found "number"/);
  assert.equal(violations[0].path, '$.id');
});

test('validate accepts "integer" for a whole number', () => {
  const schema = { type: 'integer' };
  assert.deepEqual(validate(schema, 3), []);
});

test('validate rejects "integer" for a non-integer number', () => {
  const violations = validate({ type: 'integer' }, 3.5);
  assert.equal(violations.length, 1);
});

test('validate flags an enum violation', () => {
  const schema = { enum: ['a', 'b', 'c'] };
  const violations = validate(schema, 'z');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /not one of the allowed enum values/);
});

test('validate recurses into array items', () => {
  const schema = { type: 'array', items: { type: 'string' } };
  const value = ['a', 2, 'c'];
  const violations = validate(schema, value);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].path, '$[1]');
});

test('validate recurses into nested object properties', () => {
  const schema = {
    type: 'object',
    properties: { order: { type: 'object', required: ['total'], properties: { total: { type: 'number' } } } },
  };
  const value = { order: {} };
  const violations = validate(schema, value);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].path, '$.order');
});
