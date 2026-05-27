import { ref, watch } from 'vue';
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
  mode: 'unique' | 'required';
  createdAt?: number;
}

export function useMetaIndexRegistry() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const entityType = ref<MetaEntityTypeOption>('pack');
  const definitions = ref<MetaIndexDefinitionRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastApiError = ref<Record<string, unknown> | null>(null);

  const formMode = ref<'unique' | 'required'>('unique');
  const formKeys = ref('key');
  const formId = ref('');
  const formDryRun = ref(false);
  const submitting = ref(false);

  const selectedDefinition = ref<MetaIndexDefinitionRow | null>(null);

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
    lastApiError.value = null;
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

  async function createDefinition() {
    submitting.value = true;
    error.value = null;
    lastApiError.value = null;
    try {
      const keys = parseKeysInput(formKeys.value);
      if (keys.length < 1 || keys.length > 3) {
        throw new Error('Укажите от 1 до 3 ключей через запятую');
      }
      const payload: Record<string, unknown> = {
        keys,
        mode: formMode.value
      };
      if (formId.value.trim()) {
        payload.id = formId.value.trim();
      }
      const qs = formDryRun.value ? '?dryRun=true' : '';
      const response = await fetch(
        `${baseUrl()}/api/meta/index/${entityType.value}${qs}`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(payload)
        }
      );
      const body = await response.json();
      if (!response.ok) {
        lastApiError.value = body;
        throw new Error(body.message || 'Failed to register index');
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
    formMode,
    formKeys,
    formId,
    formDryRun,
    submitting,
    selectedDefinition,
    loadDefinitions,
    loadDefinition,
    createDefinition,
    deleteDefinition
  };
}
