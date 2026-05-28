import { computed, ref, watch } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

const ENTITY_TYPES = [
  'pack',
  'dialog',
  'message',
  'user',
  'topic',
  'dialogMember',
  'tenant',
  'system'
] as const;

export type MetaEntityTypeOption = (typeof ENTITY_TYPES)[number];

export interface MetaIndexDefinitionRow {
  indexId: string;
  keys: string[];
  mode: 'unique' | 'required' | 'allowed';
  createdAt?: number;
}

export interface SchemaConflictViolation {
  entityId: string;
  reason: string;
  extraKeys?: string[];
}

export interface IndexConflictViolation {
  entityId: string;
  reason: string;
  duplicateWith?: string;
}

export interface IndexConflictDetails {
  indexId?: string;
  mode?: string;
  keys?: string[];
  violations?: IndexConflictViolation[];
  totalViolations?: number;
  truncated?: boolean;
}

const MAX_CLEAR_DUPLICATE_ITERATIONS = 100;

function parseConflictDetails(err: Record<string, unknown> | null): IndexConflictDetails | null {
  if (
    !err ||
    (err.code !== 'INDEX_CONFLICT_EXISTING_DATA' && err.code !== 'SCHEMA_CONFLICT_EXISTING_DATA')
  ) {
    return null;
  }

  let raw: unknown = err.details;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = undefined;
    }
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as IndexConflictDetails;
  }

  if (Array.isArray(err.violations)) {
    return {
      indexId: typeof err.indexId === 'string' ? err.indexId : undefined,
      mode: typeof err.mode === 'string' ? err.mode : undefined,
      keys: Array.isArray(err.keys) ? (err.keys as string[]) : undefined,
      violations: err.violations as IndexConflictViolation[],
      totalViolations: typeof err.totalViolations === 'number' ? err.totalViolations : undefined,
      truncated: typeof err.truncated === 'boolean' ? err.truncated : undefined
    };
  }

  return null;
}

function findDuplicateUniqueViolations(err: Record<string, unknown> | null): IndexConflictViolation[] {
  const details = parseConflictDetails(err);
  if (details?.violations?.length) {
    return details.violations.filter((v) => v.reason === 'duplicateUnique');
  }

  const stack: unknown[] = [err];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (Array.isArray((current as { violations?: unknown }).violations)) {
      return ((current as { violations: IndexConflictViolation[] }).violations).filter(
        (v) => v.reason === 'duplicateUnique'
      );
    }
    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return [];
}

function errorLooksLikeIndexConflict(err: Record<string, unknown> | null): boolean {
  if (!err) {
    return false;
  }
  if (err.code === 'INDEX_CONFLICT_EXISTING_DATA' || err.code === 'SCHEMA_CONFLICT_EXISTING_DATA') {
    return true;
  }
  try {
    const s = JSON.stringify(err);
    return s.includes('INDEX_CONFLICT_EXISTING_DATA') || s.includes('SCHEMA_CONFLICT_EXISTING_DATA');
  } catch {
    return false;
  }
}

function findSchemaExtraKeyViolations(err: Record<string, unknown> | null): SchemaConflictViolation[] {
  if (!err || err.code !== 'SCHEMA_CONFLICT_EXISTING_DATA') {
    return [];
  }
  const details = parseConflictDetails(err);
  if (details?.violations?.length) {
    return details.violations.filter((v) => v.reason === 'extraKeys') as SchemaConflictViolation[];
  }
  return [];
}

export function useMetaIndexRegistry() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const entityType = ref<MetaEntityTypeOption>('pack');
  const definitions = ref<MetaIndexDefinitionRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastApiError = ref<Record<string, unknown> | null>(null);

  const formMode = ref<'unique' | 'required' | 'allowed'>('unique');
  const formKeys = ref('key');
  const formId = ref('');
  const formDryRun = ref(false);
  const submitting = ref(false);
  const clearingDuplicates = ref(false);
  const successMessage = ref<string | null>(null);

  const selectedDefinition = ref<MetaIndexDefinitionRow | null>(null);

  const indexConflictDetails = computed((): IndexConflictDetails | null =>
    parseConflictDetails(lastApiError.value)
  );

  const duplicateUniqueViolations = computed(() =>
    findDuplicateUniqueViolations(lastApiError.value)
  );

  const effectiveConflictKeys = computed((): string[] => {
    const fromDetails = indexConflictDetails.value?.keys;
    if (fromDetails?.length) {
      return fromDetails;
    }
    try {
      return parseKeysInput(formKeys.value);
    } catch {
      return [];
    }
  });

  const hasIndexDataConflict = computed(() => errorLooksLikeIndexConflict(lastApiError.value));

  const isUniqueConflictRegistration = computed(() => {
    if (lastApiError.value?.code === 'SCHEMA_CONFLICT_EXISTING_DATA') {
      return false;
    }
    if (formMode.value === 'unique') {
      return true;
    }
    const mode = indexConflictDetails.value?.mode;
    if (mode === 'unique') {
      return true;
    }
    const indexId = indexConflictDetails.value?.indexId;
    return typeof indexId === 'string' && indexId.startsWith('unique:');
  });

  const schemaExtraViolations = computed(() => findSchemaExtraKeyViolations(lastApiError.value));

  const isAllowlistConflict = computed(
    () =>
      lastApiError.value?.code === 'SCHEMA_CONFLICT_EXISTING_DATA' ||
      formMode.value === 'allowed' ||
      indexConflictDetails.value?.mode === 'allowed'
  );

  /** Кнопка очистки дубликатов unique. */
  const showClearDuplicatesButton = computed(
    () =>
      hasIndexDataConflict.value &&
      isUniqueConflictRegistration.value &&
      effectiveConflictKeys.value.length > 0
  );

  /** Кнопка удаления лишних meta-ключей при конфликте allowlist. */
  const showClearExtraKeysButton = computed(() => {
    if (!hasIndexDataConflict.value || !isAllowlistConflict.value) {
      return false;
    }
    if (schemaExtraViolations.value.length > 0) {
      return true;
    }
    return formMode.value === 'allowed' && parseKeysInputSafe(formKeys.value).length > 0;
  });

  function parseKeysInputSafe(raw: string): string[] {
    try {
      return parseKeysInput(raw);
    } catch {
      return [];
    }
  }

  function baseUrl(): string {
    return configStore.config.TENANT_API_URL || 'http://localhost:3000';
  }

  function headers(): Record<string, string> {
    return {
      ...credentialsStore.getHeaders(),
      'Content-Type': 'application/json'
    };
  }

  async function loadDefinitions() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(
        `${baseUrl()}/api/meta/index/${entityType.value}`,
        { headers: credentialsStore.getHeaders() }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Failed to load definitions');
      }
      definitions.value = Array.isArray(body.data) ? body.data : [];
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      definitions.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadDefinition(indexId: string) {
    const response = await fetch(
      `${baseUrl()}/api/meta/index/${entityType.value}/${encodeURIComponent(indexId)}`,
      { headers: credentialsStore.getHeaders() }
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message || 'Failed to load definition');
    }
    selectedDefinition.value = body.data;
  }

  function parseKeysInput(raw: string): string[] {
    return raw
      .split(/[,+\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  function buildRegisterPayload(): Record<string, unknown> {
    const keys = parseKeysInput(formKeys.value);
    const maxKeys = formMode.value === 'allowed' ? 50 : 3;
    if (keys.length < 1 || keys.length > maxKeys) {
      throw new Error(`Укажите от 1 до ${maxKeys} ключей через запятую`);
    }
    const payload: Record<string, unknown> = {
      keys,
      mode: formMode.value
    };
    if (formMode.value !== 'allowed' && formId.value.trim()) {
      payload.id = formId.value.trim();
    }
    return payload;
  }

  async function postRegisterDefinition(
    dryRun: boolean
  ): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; body: Record<string, unknown> }> {
    const payload = buildRegisterPayload();
    const qs = dryRun ? '?dryRun=true' : '';
    const response = await fetch(
      `${baseUrl()}/api/meta/index/${entityType.value}${qs}`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      }
    );
    const body = (await response.json()) as Record<string, unknown>;
    if (response.ok) {
      return { ok: true, body };
    }
    return { ok: false, body };
  }

  async function deleteMetaKeysForEntity(entityId: string, keys: string[]): Promise<void> {
    const response = await fetch(
      `${baseUrl()}/api/meta/${entityType.value}/${encodeURIComponent(entityId)}`,
      {
        method: 'DELETE',
        headers: headers(),
        body: JSON.stringify({ keys })
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof body.message === 'string' ? body.message : `HTTP ${response.status}`;
      throw new Error(`${entityId}: ${message}`);
    }
  }

  async function clearDuplicateMetaValues(): Promise<void> {
    const details = indexConflictDetails.value;
    const keys = effectiveConflictKeys.value;
    if (!keys.length || !showClearDuplicatesButton.value) {
      return;
    }

    const previewIds = [
      ...new Set(duplicateUniqueViolations.value.map((v) => v.entityId))
    ];
    const totalHint =
      details?.totalViolations != null
        ? ` (всего нарушений: ${details.totalViolations}${details.truncated ? ', в ответе показана часть' : ''})`
        : '';
    const countLabel =
      previewIds.length > 0
        ? `${previewIds.length} сущностей-дубликатов из ответа`
        : 'дубликатов (список уточнится при dryRun)';

    if (
      !confirm(
        `Удалить ключи [${keys.join(', ')}] у ${countLabel}${totalHint}? ` +
          'У каждой пары останется сущность-«оригинал» (duplicateWith), значение у дубликата будет снято.'
      )
    ) {
      return;
    }

    clearingDuplicates.value = true;
    error.value = null;
    successMessage.value = null;

    let clearedEntities = 0;

    try {
      for (let iteration = 0; iteration < MAX_CLEAR_DUPLICATE_ITERATIONS; iteration++) {
        const reg = await postRegisterDefinition(true);
        if (reg.ok) {
          lastApiError.value = null;
          successMessage.value =
            clearedEntities > 0
              ? `Очищены meta у ${clearedEntities} сущностей. Конфликтов unique больше нет — можно нажать POST registry.`
              : 'Конфликтов unique больше нет — можно нажать POST registry.';
          return;
        }

        if (reg.body.code !== 'INDEX_CONFLICT_EXISTING_DATA') {
          lastApiError.value = reg.body;
          throw new Error(
            typeof reg.body.message === 'string' ? reg.body.message : 'Не удалось проверить данные'
          );
        }

        lastApiError.value = reg.body;
        const scan = parseConflictDetails(reg.body);
        if (scan?.mode && scan.mode !== 'unique') {
          throw new Error('Автоочистка доступна только для unique-индексов с дубликатами');
        }

        const keys =
          scan?.keys?.length ? scan.keys : effectiveConflictKeys.value;
        const entityIds = [
          ...new Set(
            (scan.violations ?? [])
              .filter((v) => v.reason === 'duplicateUnique')
              .map((v) => v.entityId)
          )
        ];

        if (entityIds.length === 0) {
          throw new Error(
            'Конфликт данных остался, но автоматически устранить его нельзя (не duplicateUnique)'
          );
        }

        const failures: string[] = [];
        for (const entityId of entityIds) {
          try {
            await deleteMetaKeysForEntity(entityId, keys);
            clearedEntities += 1;
          } catch (e: unknown) {
            failures.push(e instanceof Error ? e.message : String(e));
          }
        }

        if (failures.length > 0) {
          throw new Error(failures.join('\n'));
        }
      }

      throw new Error('Слишком много итераций очистки — обратитесь к администратору');
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      clearingDuplicates.value = false;
    }
  }

  async function clearExtraMetaKeys(): Promise<void> {
    if (!showClearExtraKeysButton.value) {
      return;
    }

    const allowedKeys = parseKeysInputSafe(formKeys.value);
    if (!allowedKeys.length) {
      return;
    }

    if (
      !confirm(
        `Удалить у сущностей meta-ключи, не входящие в allowlist [${allowedKeys.join(', ')}]?`
      )
    ) {
      return;
    }

    clearingDuplicates.value = true;
    error.value = null;
    successMessage.value = null;
    let clearedEntities = 0;

    try {
      for (let iteration = 0; iteration < MAX_CLEAR_DUPLICATE_ITERATIONS; iteration++) {
        const reg = await postRegisterDefinition(true);
        if (reg.ok) {
          lastApiError.value = null;
          successMessage.value =
            clearedEntities > 0
              ? `Удалены лишние ключи у ${clearedEntities} сущностей. Можно нажать POST registry.`
              : 'Лишних meta-ключей нет — можно нажать POST registry.';
          return;
        }

        if (reg.body.code !== 'SCHEMA_CONFLICT_EXISTING_DATA') {
          lastApiError.value = reg.body;
          throw new Error(
            typeof reg.body.message === 'string' ? reg.body.message : 'Не удалось проверить данные'
          );
        }

        lastApiError.value = reg.body;
        const rows = findSchemaExtraKeyViolations(reg.body);
        if (rows.length === 0) {
          throw new Error('Конфликт allowlist остался, но нет extraKeys в ответе API');
        }

        const failures: string[] = [];
        for (const row of rows) {
          const keys = row.extraKeys?.length ? row.extraKeys : [];
          if (keys.length === 0) {
            continue;
          }
          try {
            await deleteMetaKeysForEntity(row.entityId, keys);
            clearedEntities += 1;
          } catch (e: unknown) {
            failures.push(e instanceof Error ? e.message : String(e));
          }
        }

        if (failures.length > 0) {
          throw new Error(failures.join('\n'));
        }
      }

      throw new Error('Слишком много итераций очистки allowlist');
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      clearingDuplicates.value = false;
    }
  }

  async function createDefinition() {
    submitting.value = true;
    error.value = null;
    successMessage.value = null;
    lastApiError.value = null;
    try {
      const reg = await postRegisterDefinition(formDryRun.value);
      if (!reg.ok) {
        lastApiError.value = reg.body;
        throw new Error(
          typeof reg.body.message === 'string' ? reg.body.message : 'Failed to register index'
        );
      }
      if (formDryRun.value) {
        successMessage.value = 'Проверка пройдена — конфликтов с данными нет.';
        return;
      }
      await loadDefinitions();
      formKeys.value = 'key';
      formId.value = '';
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      submitting.value = false;
    }
  }

  async function deleteDefinition(indexId: string) {
    if (!confirm(`Удалить индекс ${indexId}? Слоты unique будут сняты.`)) {
      return;
    }
    submitting.value = true;
    error.value = null;
    try {
      const response = await fetch(
        `${baseUrl()}/api/meta/index/${entityType.value}/${encodeURIComponent(indexId)}`,
        { method: 'DELETE', headers: credentialsStore.getHeaders() }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Failed to delete definition');
      }
      if (selectedDefinition.value?.indexId === indexId) {
        selectedDefinition.value = null;
      }
      await loadDefinitions();
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      submitting.value = false;
    }
  }

  watch(entityType, () => {
    selectedDefinition.value = null;
    lastApiError.value = null;
    successMessage.value = null;
    loadDefinitions();
  });

  loadDefinitions();

  return {
    ENTITY_TYPES,
    entityType,
    definitions,
    loading,
    error,
    lastApiError,
    indexConflictDetails,
    duplicateUniqueViolations,
    effectiveConflictKeys,
    hasIndexDataConflict,
    showClearDuplicatesButton,
    showClearExtraKeysButton,
    schemaExtraViolations,
    formMode,
    formKeys,
    formId,
    formDryRun,
    submitting,
    clearingDuplicates,
    successMessage,
    selectedDefinition,
    loadDefinitions,
    loadDefinition,
    createDefinition,
    clearDuplicateMetaValues,
    clearExtraMetaKeys,
    deleteDefinition
  };
}
