import { Pack, PackLink, Message } from '@chat3/models';
import { parseFilters, buildFilterQuery } from '../utils/queryParser.js';

const CURSOR_SEPARATOR = '|';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface PackMessagesQueryOptions {
  tenantId: string;
  packId: string;
  limit?: number;
  cursor?: string | null;
  filter?: string | null;
}

export interface PackMessagesResult {
  messages: any[];
  pageInfo: {
    hasMore: boolean;
    cursor: {
      next: string | null;
      prev: string | null;
    };
  };
}

interface DecodedCursor {
  createdAt: number;
  messageId: string;
}

export function encodePackMessagesCursor(createdAt: number, messageId: string): string {
  return Buffer.from(`${createdAt}${CURSOR_SEPARATOR}${messageId}`).toString('base64url');
}

export function decodePackMessagesCursor(cursor?: string | null): DecodedCursor | null {
  if (!cursor) {
    return null;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [createdAtStr, messageId] = decoded.split(CURSOR_SEPARATOR);
    const createdAt = Number(createdAtStr);
    if (!Number.isFinite(createdAt) || !messageId) {
      return null;
    }
    return { createdAt, messageId };
  } catch (error) {
    console.error('Failed to decode pack messages cursor', error);
    return null;
  }
}

export async function loadPackMessages({
  tenantId,
  packId,
  limit = DEFAULT_LIMIT,
  cursor,
  filter
}: PackMessagesQueryOptions): Promise<PackMessagesResult> {
  const normalizedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const pack = await Pack.findOne({ tenantId, packId }).select('_id').lean();
  if (!pack) {
    throw new Error('PACK_NOT_FOUND');
  }

  const links = await PackLink.find({ tenantId, packId })
    .select('dialogId')
    .lean();

  if (links.length === 0) {
    return {
      messages: [],
      pageInfo: {
        hasMore: false,
        cursor: {
          next: null,
          prev: cursor ?? null
        }
      }
    };
  }

  const dialogIds = links.map((link) => link.dialogId);

  const query: Record<string, unknown> = {
    tenantId,
    dialogId: { $in: dialogIds }
  };

  if (filter) {
    try {
      const parsedFilters = parseFilters(filter);
      const filterQuery = await buildFilterQuery(tenantId, 'message', parsedFilters);
      Object.assign(query, filterQuery);
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      err.name = 'FILTER_ERROR';
      throw err;
    }
  }

  const decodedCursor = decodePackMessagesCursor(cursor);
  if (decodedCursor) {
    query.$or = [
      { createdAt: { $lt: decodedCursor.createdAt } },
      {
        createdAt: decodedCursor.createdAt,
        messageId: { $lt: decodedCursor.messageId }
      }
    ];
  }

  const sort = { createdAt: -1, messageId: -1 };

  const documents = await Message.find(query)
    .sort(sort as any)
    .limit(normalizedLimit + 1)
    .lean();

  const hasMore = documents.length > normalizedLimit;
  const items = hasMore ? documents.slice(0, normalizedLimit) : documents;

  const nextCursor = hasMore
    ? encodePackMessagesCursor(items[items.length - 1].createdAt, items[items.length - 1].messageId)
    : null;

  const prevCursor = cursor && items.length > 0
    ? encodePackMessagesCursor(items[0].createdAt, items[0].messageId)
    : (cursor ?? null);

  return {
    messages: items,
    pageInfo: {
      hasMore,
      cursor: {
        next: nextCursor,
        prev: prevCursor
      }
    }
  };
}
