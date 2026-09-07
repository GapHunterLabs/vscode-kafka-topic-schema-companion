/**
 * Pure logic -- no `vscode` dependency. Ported from the IntelliJ-
 * family kafka-topic-schema-companion (SchemaFilePairing +
 * JsonSchemaValidator). The IntelliJ version validates against real
 * JSON PSI nodes (to preserve exact source-text distinctions like
 * "3.0" vs "3"); this version validates against `JSON.parse()`'s
 * plain JS values, which is simpler here (no PSI, no custom parser
 * needed) but has one honestly-noted behavioral difference: JSON.parse
 * cannot tell "3.0" from "3" in the source text (both become the JS
 * number 3), so a schema declaring `"type": "integer"` accepts a
 * sample value written as "3.0" here, where the IntelliJ version
 * (reading the literal source text) correctly flags it. A minor,
 * documented gap, not a silent behavior change.
 */

export interface Violation {
  path: string;
  message: string;
}

const SAMPLE_SUFFIXES = ['.sample.json', '.message.json'];

/** Derives the schema file name a sample/message file should be
 * validated against, by naming convention: `orders-created.sample.json`
 * or `orders-created.message.json` pairs with a sibling
 * `orders-created.schema.json` in the same directory. Returns null if
 * the file name doesn't match a recognized sample-file convention. */
export function schemaFileNameFor(sampleFileName: string): string | null {
  for (const suffix of SAMPLE_SUFFIXES) {
    if (sampleFileName.endsWith(suffix) && sampleFileName.length > suffix.length) {
      const baseName = sampleFileName.slice(0, -suffix.length);
      return `${baseName}.schema.json`;
    }
  }
  return null;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function actualTypeName(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'object' | 'string' | 'number' | 'boolean'
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Hand-rolled validator for the common JSON Schema subset (`type`,
 * `required`, `properties`, `items`, `enum`). No external JSON Schema
 * library, no network call, no $ref/remote schema resolution.
 *
 * v0.1 scope, honestly noted (same as the IntelliJ-family original):
 * $ref, additionalProperties, pattern, minimum/maximum/minLength/
 * maxLength, oneOf/anyOf/allOf, and format are not evaluated -- a
 * schema using only these keywords produces zero violations even if
 * the sample genuinely doesn't satisfy them. */
export function validate(schema: JsonValue, value: JsonValue, path = '$'): Violation[] {
  const violations: Violation[] = [];
  validateNode(schema, value, path, violations);
  return violations;
}

function validateNode(schema: JsonValue, value: JsonValue, path: string, violations: Violation[]): void {
  if (!isRecord(schema)) return;

  validateType(schema, value, path, violations);
  validateEnum(schema, value, path, violations);
  if (isRecord(value)) validateObject(schema, value, path, violations);
  if (Array.isArray(value)) validateArray(schema, value, path, violations);
}

function validateType(schema: Record<string, JsonValue>, value: JsonValue, path: string, violations: Violation[]): void {
  const expected = schema.type;
  if (typeof expected !== 'string') return;
  const actual = actualTypeName(value);
  const matches = expected === 'integer' ? typeof value === 'number' && Number.isInteger(value) : expected === actual;
  if (!matches) {
    violations.push({ path, message: `expected type "${expected}" but found "${actual}"` });
  }
}

function validateEnum(schema: Record<string, JsonValue>, value: JsonValue, path: string, violations: Violation[]): void {
  if (!Array.isArray(schema.enum)) return;
  const allowed = schema.enum.map((entry) => JSON.stringify(entry));
  if (!allowed.includes(JSON.stringify(value))) {
    violations.push({ path, message: `value ${JSON.stringify(value)} is not one of the allowed enum values` });
  }
}

function validateObject(
  schema: Record<string, JsonValue>,
  value: Record<string, JsonValue>,
  path: string,
  violations: Violation[],
): void {
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const name of required) {
    if (typeof name === 'string' && !(name in value)) {
      violations.push({ path, message: `missing required property "${name}"` });
    }
  }

  const propertiesSchema = schema.properties;
  if (!isRecord(propertiesSchema)) return;
  for (const [key, propertyValue] of Object.entries(value)) {
    const propertySchema = propertiesSchema[key];
    if (!isRecord(propertySchema)) continue;
    validateNode(propertySchema, propertyValue, `${path}.${key}`, violations);
  }
}

function validateArray(schema: Record<string, JsonValue>, value: JsonValue[], path: string, violations: Violation[]): void {
  const itemsSchema = schema.items;
  if (!isRecord(itemsSchema)) return;
  value.forEach((item, index) => validateNode(itemsSchema, item, `${path}[${index}]`, violations));
}
