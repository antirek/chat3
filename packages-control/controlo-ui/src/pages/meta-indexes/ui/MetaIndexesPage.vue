<template>
  <div class="meta-indexes-page">
    <div class="page-header">
      <h1>Meta индексы</h1>
      <p class="subtitle">
        Registry: unique / required / allowed для tenant-api
        <span class="ui-build-tag" title="Признак сборки с кнопкой очистки дубликатов">· clear-dup v2</span>
      </p>
    </div>

    <div class="toolbar">
      <label>
        entityType
        <select v-model="entityType" class="select">
          <option v-for="t in ENTITY_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <button type="button" class="btn-secondary" :disabled="loading" @click="loadDefinitions">
        Обновить
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>

    <div v-if="lastApiError" class="alert alert-warn">
      <strong>{{ lastApiError.code || 'API error' }}</strong>
      <p v-if="lastApiError.message" class="api-message">{{ lastApiError.message }}</p>

      <div v-if="showClearDuplicatesButton" class="clear-duplicates-block">
        <p class="conflict-summary">
          Дубликаты unique по ключам
          <code>{{ effectiveConflictKeys.join(', ') }}</code>
          <span v-if="duplicateUniqueViolations.length">
            : {{ duplicateUniqueViolations.length }} в ответе
          </span>
          <span v-if="indexConflictDetails?.totalViolations">
            (всего {{ indexConflictDetails.totalViolations
            }}<span v-if="indexConflictDetails.truncated">, список обрезан</span>)
          </span>
        </p>
        <button
          type="button"
          class="btn-warning"
          :disabled="submitting || clearingDuplicates"
          @click="clearDuplicateMetaValues"
        >
          {{
            clearingDuplicates
              ? 'Очистка…'
              : 'Удалить значения в дублирующихся сущностях'
          }}
        </button>
        <p class="hint conflict-hint">
          Снимает meta-ключи у дубликатов (не у «оригинала»). Цикл dryRun + bulk DELETE, пока
          конфликт не исчезнет.
        </p>
        <table v-if="duplicateUniqueViolations.length" class="violations-table">
          <thead>
            <tr>
              <th>сущность (дубликат)</th>
              <th>оригинал</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in duplicateUniqueViolations" :key="row.entityId">
              <td><code>{{ row.entityId }}</code></td>
              <td><code>{{ row.duplicateWith }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="showClearExtraKeysButton" class="clear-duplicates-block">
        <p class="conflict-summary">
          Лишние meta-ключи вне allowlist
          <span v-if="schemaExtraViolations.length">
            : {{ schemaExtraViolations.length }} сущностей в ответе
          </span>
        </p>
        <button
          type="button"
          class="btn-warning"
          :disabled="submitting || clearingDuplicates"
          @click="clearExtraMetaKeys"
        >
          {{ clearingDuplicates ? 'Очистка…' : 'Удалить лишние meta-ключи' }}
        </button>
        <p class="hint conflict-hint">
          Удаляет ключи, не входящие в новый allowlist (цикл dryRun + bulk DELETE).
        </p>
      </div>

      <p
        v-else-if="hasIndexDataConflict"
        class="conflict-summary conflict-summary-muted"
      >
        Конфликт данных: для очистки дубликатов — mode <code>unique</code>; для allowlist —
        mode <code>allowed</code> и keys в форме.
      </p>

      <details class="error-details">
        <summary>Полный ответ API</summary>
        <pre class="error-json">{{ JSON.stringify(lastApiError, null, 2) }}</pre>
      </details>
    </div>

    <div class="layout">
      <section class="panel">
        <h2>Правила ({{ entityType }})</h2>
        <div v-if="loading" class="muted">Загрузка…</div>
        <table v-else-if="definitions.length" class="table">
          <thead>
            <tr>
              <th>indexId</th>
              <th>mode</th>
              <th>keys</th>
              <th>when</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in definitions"
              :key="row.indexId"
              :class="{ selected: selectedDefinition?.indexId === row.indexId }"
            >
              <td>
                <button type="button" class="link-btn" @click="loadDefinition(row.indexId)">
                  {{ row.indexId }}
                </button>
              </td>
              <td>{{ row.mode }}</td>
              <td>{{ row.keys.join(', ') }}</td>
              <td>
                <code v-if="row.when">{{ row.when.key }} {{ row.when.op }} {{ JSON.stringify(row.when.value) }}</code>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <button
                  type="button"
                  class="btn-danger-sm"
                  :disabled="submitting"
                  @click="deleteDefinition(row.indexId)"
                >
                  Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">Нет зарегистрированных индексов</p>

        <div v-if="selectedDefinition" class="detail">
          <h3>Детали</h3>
          <pre>{{ JSON.stringify(selectedDefinition, null, 2) }}</pre>
        </div>
      </section>

      <section class="panel">
        <h2>Создать правило</h2>
        <div class="form">
          <label>
            mode
            <select v-model="formMode" class="select">
              <option value="unique">unique</option>
              <option value="required">required</option>
              <option value="allowed">allowed (allowlist)</option>
            </select>
          </label>
          <label>
            keys ({{ formMode === 'allowed' ? '1–50' : '1–3' }}, через запятую)
            <input
              v-model="formKeys"
              type="text"
              class="input"
              :placeholder="formMode === 'allowed' ? 'key, channel, label' : 'channel, externalId'"
            />
          </label>
          <label v-if="formMode !== 'allowed'">
            id (опционально)
            <input v-model="formId" type="text" class="input" placeholder="crm_external_ref" />
          </label>
          <label v-if="formMode !== 'allowed'" class="checkbox-row">
            <input v-model="formWhenEnabled" type="checkbox" />
            when (условие)
          </label>
          <template v-if="formMode !== 'allowed' && formWhenEnabled">
            <label>
              when.key
              <input v-model="formWhenKey" type="text" class="input" placeholder="type" />
            </label>
            <label>
              when.op
              <select v-model="formWhenOp" class="select">
                <option value="eq">eq</option>
                <option value="in">in</option>
                <option value="ne">ne</option>
                <option value="exists">exists</option>
              </select>
            </label>
            <label>
              when.value
              <input
                v-model="formWhenValue"
                type="text"
                class="input"
                :placeholder="formWhenOp === 'exists' ? 'true | false' : formWhenOp === 'in' ? 'phone, telegram' : 'telegram'"
              />
            </label>
          </template>
          <label class="checkbox-row">
            <input v-model="formDryRun" type="checkbox" />
            dryRun (только проверка данных)
          </label>
          <button
            type="button"
            class="btn-primary"
            :disabled="submitting"
            @click="createDefinition"
          >
            {{ submitting ? '…' : 'POST registry' }}
          </button>
        </div>
        <p class="hint">
          При конфликте с данными вернётся <code>INDEX_CONFLICT_EXISTING_DATA</code> с violations.
          Слоты смотрите в DB Explorer → MetaIndex.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMetaIndexRegistry } from '../model/useMetaIndexRegistry';

const {
  ENTITY_TYPES,
  entityType,
  definitions,
  loading,
  error,
  successMessage,
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
  formWhenEnabled,
  formWhenKey,
  formWhenOp,
  formWhenValue,
  formDryRun,
  submitting,
  clearingDuplicates,
  selectedDefinition,
  loadDefinitions,
  loadDefinition,
  createDefinition,
  clearDuplicateMetaValues,
  clearExtraMetaKeys,
  deleteDefinition
} = useMetaIndexRegistry();
</script>

<style scoped>
.meta-indexes-page {
  padding: 24px;
  max-width: 1200px;
}

.page-header h1 {
  margin: 0 0 4px;
}

.subtitle {
  color: #6c757d;
  margin: 0 0 20px;
}

.ui-build-tag {
  font-size: 11px;
  color: #198754;
  font-weight: 600;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
}

.panel h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  border-bottom: 1px solid #eee;
  padding: 8px;
  text-align: left;
}

tr.selected {
  background: #f0f7ff;
}

.link-btn {
  background: none;
  border: none;
  color: #0d6efd;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.input,
.select {
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.checkbox-row {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}

.btn-primary,
.btn-secondary,
.btn-danger-sm {
  padding: 8px 14px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary {
  background: #0d6efd;
  color: #fff;
}

.btn-secondary {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
}

.btn-danger-sm {
  background: #dc3545;
  color: #fff;
  padding: 4px 8px;
  font-size: 12px;
}

.alert {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.alert-error {
  background: #f8d7da;
  color: #842029;
}

.alert-warn {
  background: #fff3cd;
  color: #664d03;
}

.alert-success {
  background: #d1e7dd;
  color: #0f5132;
}

.api-message {
  margin: 8px 0 0;
  font-size: 13px;
}

.conflict-summary {
  margin: 12px 0 8px;
  font-size: 13px;
}

.conflict-summary-muted {
  color: #856404;
}

.clear-duplicates-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ffe69c;
}

.violations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 12px;
}

.violations-table th,
.violations-table td {
  border-bottom: 1px solid #ffe69c;
  padding: 6px 8px;
  text-align: left;
}

.btn-warning {
  padding: 8px 14px;
  border-radius: 4px;
  border: 1px solid #ffc107;
  background: #ffc107;
  color: #212529;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.btn-warning:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.conflict-hint {
  margin-top: 8px;
}

.error-details {
  margin-top: 12px;
  font-size: 12px;
}

.error-details summary {
  cursor: pointer;
  color: #664d03;
}

.error-json {
  font-size: 11px;
  overflow: auto;
  max-height: 200px;
  margin: 8px 0 0;
}

.detail pre {
  font-size: 12px;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
}

.muted {
  color: #6c757d;
}

.hint {
  font-size: 12px;
  color: #6c757d;
  margin-top: 12px;
}
</style>
