import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { getOperationAST, parse, validate } from 'graphql';

const directory = new URL('./operations/', import.meta.url);

export function createOperationRegistry(schema) {
  const documents = new Map();
  const descriptors = [];
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.graphql')).sort()) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    const document = parse(source);
    const operation = getOperationAST(document);
    const errors = validate(schema, document);
    if (!operation?.name || operation.operation !== 'query' || errors.length) {
      throw new Error(`Trusted operation ${file} must contain one valid named read: ${errors.map((error) => error.message).join('; ')}`);
    }
    const hash = createHash('sha256').update(source).digest('hex');
    documents.set(hash, document);
    descriptors.push(Object.freeze({ name: operation.name.value, sha256Hash: hash }));
  }
  return Object.freeze({
    operations: Object.freeze(descriptors),
    get: (hash) => documents.get(hash) ?? null,
  });
}
