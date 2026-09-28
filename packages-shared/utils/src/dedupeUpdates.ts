import { Update } from '@chat3/models';
import type { Types } from 'mongoose';

const UNIQUE_INDEX_NAME = 'tenantId_1_eventId_1_userId_1_updateType_1_entityId_1';
const DELETE_BATCH = 500;

interface Candidate {
  id: Types.ObjectId;
  published?: boolean;
  createdAt?: number;
}

export interface DedupeUpdatesResult {
  duplicateGroups: number;
  deleted: number;
  indexCreated: boolean;
  indexError: string | null;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const publishedDelta = Number(Boolean(b.published)) - Number(Boolean(a.published));
  if (publishedDelta !== 0) {
    return publishedDelta;
  }
  const createdDelta = (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER);
  if (createdDelta !== 0) {
    return createdDelta;
  }
  return String(a.id).localeCompare(String(b.id));
}

export async function dedupeUpdates(): Promise<DedupeUpdatesResult> {
  const cursor = Update.aggregate([
    {
      $group: {
        _id: {
          tenantId: '$tenantId',
          eventId: '$eventId',
          userId: '$userId',
          updateType: '$updateType',
          entityId: '$entityId',
        },
        count: { $sum: 1 },
        docs: {
          $push: {
            id: '$_id',
            published: '$published',
            createdAt: '$createdAt',
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).allowDiskUse(true).cursor();

  const toDelete: Types.ObjectId[] = [];
  let duplicateGroups = 0;

  for await (const group of cursor) {
    duplicateGroups += 1;
    const docs = ([...(group.docs as Candidate[])]).sort(compareCandidates);
    for (const extra of docs.slice(1)) {
      toDelete.push(extra.id);
    }
  }

  let deleted = 0;
  for (let offset = 0; offset < toDelete.length; offset += DELETE_BATCH) {
    const batch = toDelete.slice(offset, offset + DELETE_BATCH);
    const result = await Update.deleteMany({ _id: { $in: batch } });
    deleted += result.deletedCount ?? 0;
  }

  let indexCreated = false;
  let indexError: string | null = null;
  try {
    await Update.collection.createIndex(
      { tenantId: 1, eventId: 1, userId: 1, updateType: 1, entityId: 1 },
      { unique: true, name: UNIQUE_INDEX_NAME }
    );
    indexCreated = true;
  } catch (error) {
    indexError = error instanceof Error ? error.message : String(error);
  }

  return { duplicateGroups, deleted, indexCreated, indexError };
}
