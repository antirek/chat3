import mongoose, { type ClientSession } from 'mongoose';
import {
  Meta,
  MetaIndex,
  MetaIndexDefinition,
  type MetaEntityType,
  type MetaIndexMode
} from '@chat3/models';
import { MetaIndexError } from './metaIndexErrors.js';

const COMPOSITE_SEP = '\u001f';
const VIOLATIONS_CAP = 20;
const CLIENT_ID_PATTERN = /^[a-z0-9._-]{1,64}$/;

/** Фиксированный indexId для allowlist (один на tenant + entityType). */
export const ALLOWLIST_INDEX_ID = 'allowed:keys';
export const ALLOWLIST_KEYS_MAX = 50;

export interface IndexDefinitionSpec {
  keys: string[];
  mode: MetaIndexMode;
  id?: string;
  when?: WhenSpec;
}

export type WhenOp = 'eq' | 'in' | 'ne' | 'exists';
export interface WhenSpec {
  key: string;
  op: WhenOp;
  value?: unknown;
}

export interface MetaIndexDefinitionLean {
  tenantId: string;
  entityType: MetaEntityType;
  indexId: string;
  keys: string[];
  mode: MetaIndexMode;
  when?: WhenSpec;
}

type MetaMap = Record<string, { value: unknown; dataType?: string }>;

export function sortIndexKeys(keys: string[]): string[] {
  return [...keys].sort();
}

export function buildIndexId(mode: MetaIndexMode, keys: string[], clientId?: string, when?: WhenSpec): string {
  if (clientId) {
    return clientId;
  }
  const sorted = sortIndexKeys(keys);
  const base = `${mode}:${sorted.join('+')}`;
  if (!when) {
    return base;
  }
  const normalizedWhen = JSON.stringify({
    key: when.key,
    op: when.op,
    value: when.value
  });
  // Stable compact suffix: readable key/op + short deterministic hash.
  let hash = 2166136261;
  for (let i = 0; i < normalizedWhen.length; i++) {
    hash ^= normalizedWhen.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${base}@w:${when.key}:${when.op}:${hashHex}`;
}

function serializeWhen(when?: WhenSpec): string {
  return JSON.stringify(when ?? null);
}

export function validateWhenSpec(when?: WhenSpec): WhenSpec | undefined {
  if (!when) {
    return undefined;
  }
  if (!when.key || typeof when.key !== 'string') {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'when.key must be non-empty string');
  }
  if (!['eq', 'in', 'ne', 'exists'].includes(when.op)) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'when.op must be one of eq|in|ne|exists');
  }
  if (when.op === 'in') {
    if (!Array.isArray(when.value) || when.value.length === 0) {
      throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'when.value must be non-empty array for op=in');
    }
  } else if (when.op === 'exists') {
    if (typeof when.value !== 'boolean') {
      throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'when.value must be boolean for op=exists');
    }
  } else if (when.value === undefined) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'when.value is required for op=eq|ne');
  }
  return when;
}

export function findAllowlistDefinition(
  definitions: MetaIndexDefinitionLean[]
): MetaIndexDefinitionLean | null {
  return definitions.find((d) => d.mode === 'allowed') ?? null;
}

export function getIndexDefinitions(
  definitions: MetaIndexDefinitionLean[]
): MetaIndexDefinitionLean[] {
  return definitions.filter((d) => d.mode !== 'allowed');
}

export function assertMetaKeysAllowed(
  keys: string[],
  allowlist: MetaIndexDefinitionLean | null,
  entityType: MetaEntityType
): void {
  if (!allowlist) {
    return;
  }
  const allowedSet = new Set(allowlist.keys);
  for (const key of keys) {
    if (!allowedSet.has(key)) {
      throw new MetaIndexError(400, 'META_KEY_NOT_ALLOWED', `Meta key ${key} is not in allowlist for ${entityType}`, {
        entityType,
        key,
        allowedKeys: sortIndexKeys([...allowlist.keys])
      });
    }
  }
}

export function assertIndexKeysInAllowlist(
  indexKeys: string[],
  allowlist: MetaIndexDefinitionLean,
  entityType: MetaEntityType,
  when?: WhenSpec
): void {
  const missing = indexKeys.filter((k) => !allowlist.keys.includes(k));
  if (when?.key && !allowlist.keys.includes(when.key)) {
    missing.push(when.key);
  }
  if (missing.length > 0) {
    throw new MetaIndexError(400, 'INDEX_KEYS_NOT_IN_ALLOWLIST', `Index keys must be included in allowlist for ${entityType}`, {
      entityType,
      keys: [...new Set(missing)],
      allowedKeys: sortIndexKeys([...allowlist.keys])
    });
  }
}

function assertRegisteredIndexesFitAllowlist(
  indexDefs: MetaIndexDefinitionLean[],
  allowedKeys: string[],
  entityType: MetaEntityType
): void {
  const allowedSet = new Set(allowedKeys);
  const orphanKeys: string[] = [];
  for (const def of indexDefs) {
    if (def.when?.key && !allowedSet.has(def.when.key)) {
      orphanKeys.push(def.when.key);
    }
    for (const key of def.keys) {
      if (!allowedSet.has(key)) {
        orphanKeys.push(key);
      }
    }
  }
  if (orphanKeys.length > 0) {
    throw new MetaIndexError(
      400,
      'INDEX_KEYS_NOT_IN_ALLOWLIST',
      `Existing index definitions reference keys not in allowlist for ${entityType}`,
      {
        entityType,
        keys: [...new Set(orphanKeys)],
        allowedKeys: sortIndexKeys(allowedKeys)
      }
    );
  }
}

export function validateAllowlistSpec(spec: IndexDefinitionSpec): string[] {
  const keys = spec.keys;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > ALLOWLIST_KEYS_MAX) {
    throw new MetaIndexError(
      400,
      'INVALID_INDEX_SPEC',
      `keys must be an array of 1 to ${ALLOWLIST_KEYS_MAX} items for allowlist`
    );
  }
  const sorted = sortIndexKeys(keys);
  if (new Set(sorted).size !== sorted.length) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'keys must not contain duplicates');
  }
  if (spec.mode !== 'allowed') {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'mode must be allowed');
  }
  if (spec.id && spec.id !== ALLOWLIST_INDEX_ID) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', `allowlist id must be ${ALLOWLIST_INDEX_ID}`);
  }
  if (spec.when) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'allowlist does not support when');
  }
  return sorted;
}

export function validateIndexSpec(spec: IndexDefinitionSpec): string[] {
  const keys = spec.keys;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 3) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'keys must be an array of 1 to 3 items');
  }
  const sorted = sortIndexKeys(keys);
  if (new Set(sorted).size !== sorted.length) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'keys must not contain duplicates');
  }
  if (spec.mode !== 'unique' && spec.mode !== 'required') {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'mode must be unique or required');
  }
  if (spec.id && !CLIENT_ID_PATTERN.test(spec.id)) {
    throw new MetaIndexError(400, 'INVALID_INDEX_SPEC', 'id must match [a-z0-9._-]{1,64}');
  }
  validateWhenSpec(spec.when);
  return sorted;
}

export function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length > 0;
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeIndexValue(
  value: unknown,
  dataType?: string
): string | null {
  if (isPlainObject(value) && !Array.isArray(value)) {
    if (!isNonEmpty(value)) {
      return null;
    }
    throw new MetaIndexError(400, 'INDEX_VALUE_TYPE_NOT_ALLOWED', 'Object values are not allowed for indexed meta keys', {
      valueType: 'object'
    });
  }

  let v = value;
  if (dataType === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    v = Number(v);
  }
  if (dataType === 'boolean' && typeof v === 'string') {
    if (v === 'true') v = true;
    if (v === 'false') v = false;
  }

  if (!isNonEmpty(v)) {
    return null;
  }

  if (typeof v === 'number' && !Number.isNaN(v)) {
    return `n:${v}`;
  }
  if (typeof v === 'boolean') {
    return v ? 'b:1' : 'b:0';
  }
  if (typeof v === 'string') {
    return `s:${v.trim().toLowerCase()}`;
  }
  if (Array.isArray(v)) {
    return `a:${JSON.stringify(v)}`;
  }

  throw new MetaIndexError(400, 'INDEX_VALUE_TYPE_NOT_ALLOWED', 'Unsupported value type for indexed meta key');
}

export function buildCompositeValue(
  metaMap: Record<string, unknown>,
  keys: string[],
  dataTypes?: Record<string, string>
): string | null {
  const sorted = sortIndexKeys(keys);
  const parts: string[] = [];
  for (const key of sorted) {
    if (!(key in metaMap)) {
      return null;
    }
    const canonical = normalizeIndexValue(metaMap[key], dataTypes?.[key]);
    if (canonical === null) {
      return null;
    }
    parts.push(canonical);
  }
  return parts.join(COMPOSITE_SEP);
}

function normalizeWhenOperand(value: unknown, dataType?: string): string | null {
  return normalizeIndexValue(value, dataType);
}

export function matchWhen(
  values: Record<string, unknown>,
  dataTypes: Record<string, string>,
  when?: WhenSpec
): boolean {
  if (!when) {
    return true;
  }
  const hasKey = when.key in values;
  if (when.op === 'exists') {
    return when.value === true ? hasKey : !hasKey;
  }
  if (!hasKey) {
    // Для op=ne отсутствие ключа не трактуем как match.
    return false;
  }
  const left = normalizeWhenOperand(values[when.key], dataTypes[when.key]);
  if (left === null) {
    return false;
  }
  if (when.op === 'in') {
    const list = (when.value as unknown[])
      .map((v) => normalizeWhenOperand(v, dataTypes[when.key]))
      .filter((v): v is string => Boolean(v));
    return list.includes(left);
  }
  const right = normalizeWhenOperand(when.value, dataTypes[when.key]);
  if (!right) {
    return false;
  }
  if (when.op === 'eq') {
    return left === right;
  }
  if (when.op === 'ne') {
    return left !== right;
  }
  return false;
}

export async function loadDefinitions(
  tenantId: string,
  entityType: MetaEntityType,
  session?: ClientSession | null
): Promise<MetaIndexDefinitionLean[]> {
  const q = MetaIndexDefinition.find({ tenantId, entityType }).lean();
  if (session) {
    q.session(session);
  }
  return q as Promise<MetaIndexDefinitionLean[]>;
}

export async function metaMapFromDb(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  session?: ClientSession | null
): Promise<{ values: Record<string, unknown>; dataTypes: Record<string, string> }> {
  const q = Meta.find({ tenantId, entityType, entityId }).lean();
  if (session) {
    q.session(session);
  }
  const records = await q;
  const values: Record<string, unknown> = {};
  const dataTypes: Record<string, string> = {};
  for (const r of records) {
    values[r.key] = r.value;
    dataTypes[r.key] = r.dataType;
  }
  return { values, dataTypes };
}

function definitionsForKey(definitions: MetaIndexDefinitionLean[], key: string): MetaIndexDefinitionLean[] {
  return definitions.filter(
    (d) => d.mode !== 'allowed' && (d.keys.includes(key) || d.when?.key === key)
  );
}

export function validateRequiredBundle(
  metaValues: Record<string, unknown>,
  dataTypes: Record<string, string>,
  definition: MetaIndexDefinitionLean
): void {
  if (!matchWhen(metaValues, dataTypes, definition.when)) {
    return;
  }
  const missingKeys: string[] = [];
  const emptyKeys: string[] = [];
  for (const key of definition.keys) {
    if (!(key in metaValues)) {
      missingKeys.push(key);
      continue;
    }
    try {
      if (normalizeIndexValue(metaValues[key], dataTypes[key]) === null) {
        emptyKeys.push(key);
      }
    } catch (e) {
      if (e instanceof MetaIndexError && e.code === 'INDEX_VALUE_TYPE_NOT_ALLOWED') {
        throw new MetaIndexError(400, 'INDEX_KEYS_REQUIRED', e.message, {
          indexId: definition.indexId,
          keys: definition.keys,
          emptyKeys: [key]
        });
      }
      throw e;
    }
  }
  if (missingKeys.length > 0 || emptyKeys.length > 0) {
    throw new MetaIndexError(400, 'INDEX_KEYS_REQUIRED', `Meta index ${definition.indexId} requires all keys to be present and non-empty`, {
      indexId: definition.indexId,
      keys: definition.keys,
      when: definition.when,
      whenMatched: true,
      missingKeys,
      emptyKeys
    });
  }
}

/** Partial bundle: some but not all keys of a multi-key required definition */
export function assertNoPartialRequiredBundle(
  metaValues: Record<string, unknown>,
  dataTypes: Record<string, string>,
  definition: MetaIndexDefinitionLean
): void {
  if (definition.mode !== 'required' || definition.keys.length <= 1) {
    return;
  }
  if (!matchWhen(metaValues, dataTypes, definition.when)) {
    return;
  }
  const present = definition.keys.filter((k) => k in metaValues);
  if (present.length > 0 && present.length < definition.keys.length) {
    throw new MetaIndexError(409, 'INDEX_KEYS_REQUIRED', 'Partial meta bundle is not allowed for required index', {
      indexId: definition.indexId,
      keys: definition.keys,
      when: definition.when,
      whenMatched: true,
      missingKeys: definition.keys.filter((k) => !present.includes(k))
    });
  }
}

export async function checkUniqueNotTaken(
  tenantId: string,
  entityType: MetaEntityType,
  indexId: string,
  canonicalValue: string,
  entityId: string,
  session?: ClientSession | null
): Promise<void> {
  const q = MetaIndex.findOne({
    tenantId,
    entityType,
    indexId,
    value: canonicalValue,
    entityId: { $ne: entityId }
  }).lean();
  if (session) {
    q.session(session);
  }
  const existing = await q;
  if (existing) {
    throw new MetaIndexError(409, 'DUPLICATE_INDEX', `Index ${indexId} value already exists`, {
      indexId,
      value: canonicalValue,
      existingEntityType: entityType,
      existingEntityId: existing.entityId
    });
  }
}

export async function releaseUniqueSlotsForEntity(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  indexId?: string,
  session?: ClientSession | null
): Promise<void> {
  const filter: Record<string, unknown> = { tenantId, entityType, entityId };
  if (indexId) {
    filter.indexId = indexId;
  }
  const op = MetaIndex.deleteMany(filter);
  if (session) {
    op.session(session);
  }
  await op;
}

export async function reserveUniqueSlot(
  tenantId: string,
  entityType: MetaEntityType,
  indexId: string,
  canonicalValue: string,
  entityId: string,
  session?: ClientSession | null
): Promise<void> {
  try {
    const doc = new MetaIndex({
      tenantId,
      entityType,
      indexId,
      value: canonicalValue,
      entityId
    });
    if (session) {
      await doc.save({ session });
    } else {
      await doc.save();
    }
  } catch (error: unknown) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      const q = MetaIndex.findOne({ tenantId, entityType, indexId, value: canonicalValue }).lean();
      if (session) {
        q.session(session);
      }
      const existing = await q;
      throw new MetaIndexError(409, 'DUPLICATE_INDEX', `Index ${indexId} value already exists`, {
        indexId,
        value: canonicalValue,
        existingEntityType: entityType,
        existingEntityId: existing?.entityId ?? 'unknown'
      });
    }
    throw error;
  }
}

export function parseMetaPayload(
  meta: Record<string, unknown> = {}
): { values: Record<string, unknown>; dataTypes: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const dataTypes: Record<string, string> = {};

  for (const [key, raw] of Object.entries(meta)) {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as object)) {
      const entry = raw as { value?: unknown; dataType?: string };
      values[key] = entry.value;
      dataTypes[key] =
        entry.dataType ??
        (typeof entry.value === 'number'
          ? 'number'
          : typeof entry.value === 'boolean'
            ? 'boolean'
            : Array.isArray(entry.value)
              ? 'array'
              : typeof entry.value === 'object' && entry.value !== null
                ? 'object'
                : 'string');
    } else {
      values[key] = raw;
      dataTypes[key] =
        typeof raw === 'number'
          ? 'number'
          : typeof raw === 'boolean'
            ? 'boolean'
            : Array.isArray(raw)
              ? 'array'
              : typeof raw === 'object' && raw !== null
                ? 'object'
                : 'string';
    }
  }

  return { values, dataTypes };
}

/** Проверка meta из тела create до создания сущности (все active required definitions). */
export async function validateRequiredMetaForCreate(
  tenantId: string,
  entityType: MetaEntityType,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const definitions = await loadDefinitions(tenantId, entityType);
  const { values, dataTypes } = parseMetaPayload(meta);
  assertMetaKeysAllowed(Object.keys(values), findAllowlistDefinition(definitions), entityType);

  const requiredDefs = getIndexDefinitions(definitions).filter((d) => d.mode === 'required');
  if (requiredDefs.length === 0) {
    return;
  }

  for (const def of requiredDefs) {
    validateRequiredBundle(values, dataTypes, def);
  }
}

export async function syncUniqueForDefinition(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  definition: MetaIndexDefinitionLean,
  metaValues: Record<string, unknown>,
  dataTypes: Record<string, string>,
  session?: ClientSession | null
): Promise<void> {
  await releaseUniqueSlotsForEntity(tenantId, entityType, entityId, definition.indexId, session);
  if (!matchWhen(metaValues, dataTypes, definition.when)) {
    return;
  }
  const canonical = buildCompositeValue(metaValues, definition.keys, dataTypes);
  if (canonical === null) {
    return;
  }
  await checkUniqueNotTaken(tenantId, entityType, definition.indexId, canonical, entityId, session);
  await reserveUniqueSlot(tenantId, entityType, definition.indexId, canonical, entityId, session);
}

export async function enforceMetaState(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  metaValues: Record<string, unknown>,
  dataTypes: Record<string, string>,
  definitions: MetaIndexDefinitionLean[],
  session?: ClientSession | null
): Promise<void> {
  const indexDefs = getIndexDefinitions(definitions);
  for (const def of indexDefs) {
    if (def.mode === 'required') {
      validateRequiredBundle(metaValues, dataTypes, def);
    } else {
      assertNoPartialRequiredBundle(metaValues, dataTypes, def);
    }
  }

  for (const def of indexDefs) {
    if (def.mode === 'unique') {
      await syncUniqueForDefinition(tenantId, entityType, entityId, def, metaValues, dataTypes, session);
    }
  }
}

export async function validateBeforeSingleKeyWrite(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  key: string,
  newValue: unknown,
  dataType: string,
  definitions: MetaIndexDefinitionLean[],
  session?: ClientSession | null
): Promise<void> {
  const affected = definitionsForKey(definitions, key);
  if (affected.length === 0) {
    return;
  }

  const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId, session);
  const nextValues = { ...values, [key]: newValue };
  const nextDataTypes = { ...dataTypes, [key]: dataType };

  for (const def of affected) {
    const whenMatched = matchWhen(nextValues, nextDataTypes, def.when);
    if (def.mode === 'required' && def.keys.length > 1 && whenMatched) {
      throw new MetaIndexError(409, 'INDEX_KEYS_REQUIRED', 'Use bulk meta API to write multiple required keys at once', {
        indexId: def.indexId,
        keys: def.keys,
        when: def.when,
        whenMatched
      });
    }
    assertNoPartialRequiredBundle(nextValues, nextDataTypes, def);
  }

  try {
    if (normalizeIndexValue(newValue, dataType) === null) {
      for (const def of affected) {
        if (def.mode === 'required') {
          const whenMatched = matchWhen(nextValues, nextDataTypes, def.when);
          if (!whenMatched) {
            continue;
          }
          throw new MetaIndexError(400, 'INDEX_KEYS_REQUIRED', 'Required meta key cannot be empty', {
            indexId: def.indexId,
            keys: def.keys,
            when: def.when,
            whenMatched,
            emptyKeys: [key]
          });
        }
      }
    }
  } catch (e) {
    if (e instanceof MetaIndexError) {
      throw e;
    }
    throw e;
  }

  const requiredDefs = affected.filter((d) => d.mode === 'required');
  for (const def of requiredDefs) {
    validateRequiredBundle(nextValues, nextDataTypes, def);
  }

  const uniqueDefs = affected.filter((d) => d.mode === 'unique');
  for (const def of uniqueDefs) {
    if (!matchWhen(nextValues, nextDataTypes, def.when)) {
      await releaseUniqueSlotsForEntity(tenantId, entityType, entityId, def.indexId, session);
      continue;
    }
    const canonical = buildCompositeValue(nextValues, def.keys, nextDataTypes);
    if (canonical === null) {
      await releaseUniqueSlotsForEntity(tenantId, entityType, entityId, def.indexId, session);
      continue;
    }
    await checkUniqueNotTaken(tenantId, entityType, def.indexId, canonical, entityId, session);
  }
}

export async function validateBeforeSingleKeyDelete(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  key: string,
  definitions: MetaIndexDefinitionLean[]
): Promise<void> {
  const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId);
  for (const def of definitions) {
    if (def.mode === 'required' && def.keys.includes(key) && matchWhen(values, dataTypes, def.when)) {
      throw new MetaIndexError(409, 'INDEX_KEYS_REQUIRED', 'Cannot delete required meta key', {
        indexId: def.indexId,
        keys: def.keys,
        when: def.when,
        whenMatched: true
      });
    }
  }
}

export async function validateBeforeBulkDelete(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  keysToDelete: string[],
  definitions: MetaIndexDefinitionLean[]
): Promise<void> {
  const { values, dataTypes } = await metaMapFromDb(tenantId, entityType, entityId);
  const deleteSet = new Set(keysToDelete);
  for (const def of definitions) {
    if (def.mode !== 'required' || def.keys.length <= 1) {
      continue;
    }
    if (!matchWhen(values, dataTypes, def.when)) {
      continue;
    }
    const inBundle = def.keys.filter((k) => deleteSet.has(k));
    if (inBundle.length > 0 && inBundle.length < def.keys.length) {
      throw new MetaIndexError(409, 'INDEX_KEYS_REQUIRED', 'Must delete all keys of a required bundle at once', {
        indexId: def.indexId,
        keys: def.keys
      });
    }
  }
}

export interface ScanViolation {
  entityId: string;
  reason: 'missingKeys' | 'emptyKeys' | 'duplicateUnique' | 'objectType';
  missingKeys?: string[];
  emptyKeys?: string[];
  duplicateWith?: string;
}

export interface ScanAllowlistViolation {
  entityId: string;
  reason: 'extraKeys';
  extraKeys: string[];
}

export async function scanExistingDataForDefinition(
  tenantId: string,
  entityType: MetaEntityType,
  definition: MetaIndexDefinitionLean
): Promise<{ violations: ScanViolation[]; totalViolations: number }> {
  const records = await Meta.find({ tenantId, entityType }).lean();
  const byEntity = new Map<string, { values: Record<string, unknown>; dataTypes: Record<string, string> }>();

  for (const r of records) {
    if (!byEntity.has(r.entityId)) {
      byEntity.set(r.entityId, { values: {}, dataTypes: {} });
    }
    const entry = byEntity.get(r.entityId)!;
    entry.values[r.key] = r.value;
    entry.dataTypes[r.key] = r.dataType;
  }

  const violations: ScanViolation[] = [];
  let totalViolations = 0;

  if (definition.mode === 'required') {
    for (const [entityId, { values, dataTypes }] of byEntity) {
      if (!matchWhen(values, dataTypes, definition.when)) {
        continue;
      }
      const missingKeys: string[] = [];
      const emptyKeys: string[] = [];
      for (const key of definition.keys) {
        if (!(key in values)) {
          missingKeys.push(key);
          continue;
        }
        try {
          if (normalizeIndexValue(values[key], dataTypes[key]) === null) {
            emptyKeys.push(key);
          }
        } catch (e) {
          if (e instanceof MetaIndexError) {
            totalViolations++;
            if (violations.length < VIOLATIONS_CAP) {
              violations.push({ entityId, reason: 'objectType', emptyKeys: [key] });
            }
            continue;
          }
          throw e;
        }
      }
      if (definition.keys.length > 1) {
        const present = definition.keys.filter((k) => k in values);
        if (present.length > 0 && present.length < definition.keys.length) {
          totalViolations++;
          if (violations.length < VIOLATIONS_CAP) {
            violations.push({
              entityId,
              reason: 'missingKeys',
              missingKeys: definition.keys.filter((k) => !present.includes(k))
            });
          }
          continue;
        }
      }
      if (missingKeys.length > 0 || emptyKeys.length > 0) {
        totalViolations++;
        if (violations.length < VIOLATIONS_CAP) {
          violations.push({ entityId, reason: missingKeys.length ? 'missingKeys' : 'emptyKeys', missingKeys, emptyKeys });
        }
      }
    }
    return { violations, totalViolations };
  }

  const valueToEntity = new Map<string, string>();
  for (const [entityId, { values, dataTypes }] of byEntity) {
    if (!matchWhen(values, dataTypes, definition.when)) {
      continue;
    }
    let canonical: string | null;
    try {
      canonical = buildCompositeValue(values, definition.keys, dataTypes);
    } catch (e) {
      if (e instanceof MetaIndexError) {
        totalViolations++;
        if (violations.length < VIOLATIONS_CAP) {
          violations.push({ entityId, reason: 'objectType' });
        }
        continue;
      }
      throw e;
    }
    if (canonical === null) {
      continue;
    }
    const other = valueToEntity.get(canonical);
    if (other && other !== entityId) {
      totalViolations++;
      if (violations.length < VIOLATIONS_CAP) {
        violations.push({ entityId, reason: 'duplicateUnique', duplicateWith: other });
      }
    } else {
      valueToEntity.set(canonical, entityId);
    }
  }

  return { violations, totalViolations };
}

export async function scanExistingDataForAllowlist(
  tenantId: string,
  entityType: MetaEntityType,
  allowedKeys: string[]
): Promise<{
  violations: ScanAllowlistViolation[];
  totalViolations: number;
  extraKeys: string[];
}> {
  const allowedSet = new Set(allowedKeys);
  const records = await Meta.find({ tenantId, entityType }).lean();
  const byEntity = new Map<string, Set<string>>();

  for (const r of records) {
    if (!byEntity.has(r.entityId)) {
      byEntity.set(r.entityId, new Set());
    }
    byEntity.get(r.entityId)!.add(r.key);
  }

  const globalExtra = new Set<string>();
  const violations: ScanAllowlistViolation[] = [];
  let totalViolations = 0;

  for (const [entityId, keys] of byEntity) {
    const extraKeys = [...keys].filter((k) => !allowedSet.has(k));
    if (extraKeys.length === 0) {
      continue;
    }
    totalViolations++;
    for (const k of extraKeys) {
      globalExtra.add(k);
    }
    if (violations.length < VIOLATIONS_CAP) {
      violations.push({ entityId, reason: 'extraKeys', extraKeys: sortIndexKeys(extraKeys) });
    }
  }

  return {
    violations,
    totalViolations,
    extraKeys: sortIndexKeys([...globalExtra])
  };
}

async function registerAllowlistDefinition(
  tenantId: string,
  entityType: MetaEntityType,
  spec: IndexDefinitionSpec,
  options: { dryRun?: boolean; createdBy?: string } = {}
): Promise<MetaIndexDefinitionLean> {
  const sortedKeys = validateAllowlistSpec(spec);
  const indexId = ALLOWLIST_INDEX_ID;
  const definition: MetaIndexDefinitionLean = {
    tenantId,
    entityType,
    indexId,
    keys: sortedKeys,
    mode: 'allowed'
  };

  const allDefs = await loadDefinitions(tenantId, entityType);
  const existingAllowed = findAllowlistDefinition(allDefs);
  if (existingAllowed && existingAllowed.indexId !== indexId) {
    throw new MetaIndexError(409, 'INDEX_DEFINITION_CONFLICT', 'Only one allowlist per entity type is allowed', {
      indexId: existingAllowed.indexId
    });
  }

  assertRegisteredIndexesFitAllowlist(getIndexDefinitions(allDefs), sortedKeys, entityType);

  const { violations, totalViolations, extraKeys } = await scanExistingDataForAllowlist(
    tenantId,
    entityType,
    sortedKeys
  );
  if (totalViolations > 0) {
    throw new MetaIndexError(
      409,
      'SCHEMA_CONFLICT_EXISTING_DATA',
      `Cannot register allowlist ${indexId}: existing meta uses keys outside the list`,
      {
        indexId,
        mode: 'allowed',
        keys: sortedKeys,
        extraKeys,
        violations,
        totalViolations,
        truncated: totalViolations > violations.length
      }
    );
  }

  if (options.dryRun) {
    return definition;
  }

  if (existingAllowed) {
    const same =
      existingAllowed.keys.length === sortedKeys.length &&
      sortIndexKeys([...existingAllowed.keys]).join(',') === sortedKeys.join(',');
    if (same) {
      return existingAllowed;
    }
    await MetaIndexDefinition.updateOne(
      { tenantId, entityType, indexId },
      { $set: { keys: sortedKeys } }
    );
    return { ...existingAllowed, keys: sortedKeys };
  }

  const created = await MetaIndexDefinition.create({
    tenantId,
    entityType,
    indexId,
    keys: sortedKeys,
    mode: 'allowed',
    createdBy: options.createdBy
  });
  return created.toObject() as MetaIndexDefinitionLean;
}

export async function registerDefinition(
  tenantId: string,
  entityType: MetaEntityType,
  spec: IndexDefinitionSpec,
  options: { dryRun?: boolean; createdBy?: string } = {}
): Promise<MetaIndexDefinitionLean> {
  if (spec.mode === 'allowed') {
    return registerAllowlistDefinition(tenantId, entityType, spec, options);
  }

  const sortedKeys = validateIndexSpec(spec);
  const indexId = buildIndexId(spec.mode, sortedKeys, spec.id, spec.when);
  const definition: MetaIndexDefinitionLean = {
    tenantId,
    entityType,
    indexId,
    keys: sortedKeys,
    mode: spec.mode,
    ...(spec.when ? { when: validateWhenSpec(spec.when) } : {})
  };

  const allDefs = await loadDefinitions(tenantId, entityType);
  const allowlist = findAllowlistDefinition(allDefs);
  if (allowlist) {
    assertIndexKeysInAllowlist(sortedKeys, allowlist, entityType, spec.when);
  }

  const { violations, totalViolations } = await scanExistingDataForDefinition(tenantId, entityType, definition);
  if (totalViolations > 0) {
    throw new MetaIndexError(409, 'INDEX_CONFLICT_EXISTING_DATA', `Cannot register index ${indexId}: existing data violates the rule`, {
      indexId,
      mode: spec.mode,
      keys: sortedKeys,
      ...(spec.when ? { when: spec.when } : {}),
      violations,
      totalViolations,
      truncated: totalViolations > violations.length
    });
  }

  if (options.dryRun) {
    return definition;
  }

  const existing = await MetaIndexDefinition.findOne({ tenantId, entityType, indexId }).lean();
  if (existing) {
    const same =
      existing.mode === spec.mode &&
      existing.keys.length === sortedKeys.length &&
      sortIndexKeys([...existing.keys]).join(',') === sortedKeys.join(',') &&
      serializeWhen((existing as MetaIndexDefinitionLean).when) === serializeWhen(spec.when);
    if (!same) {
      throw new MetaIndexError(409, 'INDEX_DEFINITION_CONFLICT', `Index ${indexId} already exists with different spec`, {
        indexId,
        existingKeys: existing.keys,
        existingMode: existing.mode,
        existingWhen: (existing as MetaIndexDefinitionLean).when
      });
    }
    return existing as MetaIndexDefinitionLean;
  }

  const created = await MetaIndexDefinition.create({
    tenantId,
    entityType,
    indexId,
    keys: sortedKeys,
    mode: spec.mode,
    ...(spec.when ? { when: spec.when } : {}),
    createdBy: options.createdBy
  });

  if (spec.mode === 'unique') {
    await backfillUniqueSlots(tenantId, entityType, definition);
  }

  return created.toObject() as MetaIndexDefinitionLean;
}

async function backfillUniqueSlots(
  tenantId: string,
  entityType: MetaEntityType,
  definition: MetaIndexDefinitionLean
): Promise<void> {
  const records = await Meta.find({ tenantId, entityType }).lean();
  const byEntity = new Map<string, { values: Record<string, unknown>; dataTypes: Record<string, string> }>();
  for (const r of records) {
    if (!byEntity.has(r.entityId)) {
      byEntity.set(r.entityId, { values: {}, dataTypes: {} });
    }
    const entry = byEntity.get(r.entityId)!;
    entry.values[r.key] = r.value;
    entry.dataTypes[r.key] = r.dataType;
  }
  for (const [entityId, { values, dataTypes }] of byEntity) {
    if (!matchWhen(values, dataTypes, definition.when)) {
      continue;
    }
    const canonical = buildCompositeValue(values, definition.keys, dataTypes);
    if (canonical === null) {
      continue;
    }
    await reserveUniqueSlot(tenantId, entityType, definition.indexId, canonical, entityId, null);
  }
}

export async function deleteDefinition(
  tenantId: string,
  entityType: MetaEntityType,
  indexId: string
): Promise<boolean> {
  await MetaIndex.deleteMany({ tenantId, entityType, indexId });
  const result = await MetaIndexDefinition.deleteOne({ tenantId, entityType, indexId });
  return result.deletedCount > 0;
}

export async function releaseAllMetaIndexForEntity(
  tenantId: string,
  entityType: MetaEntityType,
  entityId: string,
  session?: ClientSession | null
): Promise<void> {
  await releaseUniqueSlotsForEntity(tenantId, entityType, entityId, undefined, session);
}

export async function runWithOptionalTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } catch (error: unknown) {
    if (error instanceof MetaIndexError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('replica set') ||
      msg.includes('not supported')
    ) {
      return fn(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
