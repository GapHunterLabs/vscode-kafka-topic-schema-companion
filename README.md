# Kafka Topic Schema Companion (VS Code)

Validates a Kafka sample/message JSON file against its sibling schema
file — inline in the editor, no broker connection, no schema
registry. No data leaves your editor.

**v0.1, pilot.** Part of the Gap Hunter Labs VS Code workstream,
ported from the IntelliJ-family `kafka-topic-schema-companion`.

## What it does

Open a file named `<topic>.sample.json` or `<topic>.message.json` and
it's validated live against a sibling `<topic>.schema.json` in the
**same directory** — a real, common way teams organize per-topic
Kafka contracts. Checks the common JSON Schema subset: `type`,
`required`, `properties`, `items`, `enum`.

**v0.1 scope, honestly noted (same as the IntelliJ-family original):**
`$ref`, `additionalProperties`, `pattern`,
`minimum`/`maximum`/`minLength`/`maxLength`, `oneOf`/`anyOf`/`allOf`,
and `format` are not evaluated. Only same-directory pairing is
checked — a schema living in a different directory isn't found.
Violations point at the top of the file rather than the exact
property (this version parses with `JSON.parse`, which discards
source positions — a real, documented gap versus the IntelliJ-family
version's PSI-based precise highlighting) — but each message names
the exact JSON path (e.g. `$.order.total`) so the violation is still
easy to find. One more difference worth knowing: `JSON.parse` can't
distinguish `3.0` from `3` in the source text, so a schema declaring
`"type": "integer"` accepts a sample value written as `3.0` here.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already open in your editor.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
