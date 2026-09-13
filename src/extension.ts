import * as vscode from 'vscode';
import { schemaFileNameFor, validate } from './schemaValidator';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

function basename(uri: vscode.Uri): string {
  const path = uri.path;
  return path.slice(path.lastIndexOf('/') + 1);
}

function dirOf(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(uri, '..');
}

async function refresh(context: vscode.ExtensionContext, document: vscode.TextDocument): Promise<void> {
  const name = basename(document.uri);
  const schemaFileName = schemaFileNameFor(name);
  if (!schemaFileName) {
    diagnostics.delete(document.uri);
    return;
  }

  const schemaUri = vscode.Uri.joinPath(dirOf(document.uri), schemaFileName);
  let schemaText: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(schemaUri);
    schemaText = Buffer.from(bytes).toString('utf8');
  } catch {
    // No sibling schema file next to this sample -- nothing to validate against yet.
    diagnostics.delete(document.uri);
    return;
  }

  let schema: unknown;
  let sample: unknown;
  try {
    schema = JSON.parse(schemaText);
  } catch (error) {
    diagnostics.set(document.uri, [
      makeDiagnostic(`${schemaFileName} is not valid JSON: ${(error as Error).message}`),
    ]);
    return;
  }
  try {
    sample = JSON.parse(document.getText());
  } catch (error) {
    diagnostics.set(document.uri, [makeDiagnostic(`This file is not valid JSON: ${(error as Error).message}`)]);
    return;
  }

  const violations = validate(schema as never, sample as never);
  if (violations.length === 0) {
    diagnostics.delete(document.uri);
    return;
  }

  // v0.1 scope, honestly noted: violations point at the top of the
  // file, not the exact property location -- JSON.parse() discards
  // source positions, and adding a position-tracking JSON parser is a
  // real follow-up, not done here. The message still names the exact
  // JSON path (e.g. "$.order.total") so the violation is easy to find.
  diagnostics.set(
    document.uri,
    violations.map((violation) => makeDiagnostic(`[${violation.path}] ${violation.message} (against ${schemaFileName})`)),
  );
  for (const violation of violations) {
    recordHit(context, `${document.uri.toString()}:${violation.path}`);
  }
}

function makeDiagnostic(message: string): vscode.Diagnostic {
  const range = new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER);
  const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
  diagnostic.source = 'Kafka Topic Schema Companion';
  return diagnostic;
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('kafkaTopicSchemaCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((doc) => void refresh(context, doc));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => void refresh(context, doc)),
    vscode.workspace.onDidChangeTextDocument((event) => void refresh(context, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
