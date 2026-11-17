import { GraphQLError } from 'graphql';

export const PAGE_SIZE = Object.freeze({ default: 20, maximum: 50 });
const MAX_ID_LENGTH = 160;
const MAX_CURSOR_LENGTH = 512;

function invalid(message) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

export function readId(value) {
  if (!value || value.length > MAX_ID_LENGTH) throw invalid('ID must contain 1–160 characters.');
  return value;
}

export function connection(records, scope, { first = PAGE_SIZE.default, after } = {}, signal) {
  signal?.throwIfAborted();
  if (!Number.isInteger(first) || first < 1 || first > PAGE_SIZE.maximum) {
    throw invalid(`first must be between 1 and ${PAGE_SIZE.maximum}.`);
  }
  const encode = (id) => Buffer.from(JSON.stringify([scope, id])).toString('base64url');
  let start = 0;
  if (after != null) {
    let decoded;
    try {
      if (after.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(after)) throw new Error();
      decoded = JSON.parse(Buffer.from(after, 'base64url').toString('utf8'));
    } catch {
      throw invalid('Cursor is invalid for this collection.');
    }
    if (!Array.isArray(decoded) || decoded.length !== 2 || decoded[0] !== scope || encode(decoded[1]) !== after) {
      throw invalid('Cursor is invalid for this collection.');
    }
    const index = records.findIndex((record) => record.id === decoded[1]);
    if (index === -1) throw invalid('Cursor is invalid for this collection.');
    start = index + 1;
  }
  const edges = records.slice(start, start + first).map((node) => ({ node, cursor: encode(node.id) }));
  return {
    edges,
    totalCount: records.length,
    pageInfo: {
      endCursor: edges.at(-1)?.cursor ?? null,
      hasNextPage: start + first < records.length,
    },
  };
}
