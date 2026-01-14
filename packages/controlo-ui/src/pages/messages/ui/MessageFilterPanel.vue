<template>
  <div class="filter-panel">
    <div class="form-section">
      <label for="messageFilterInput">
        🔍 Фильтр сообщений (формат: <code>(поле,оператор,значение)</code>)
      </label>
      <select
        id="messageFilterExample"
        v-model="selectedExample"
        @change="selectExample"
        style="margin-bottom: 8px;"
      >
        <option value="">Выберите пример фильтра</option>
        <option value="(content,regex,встретимся)">📝 Содержит "встретимся"</option>
        <option value="(content,regex,спасибо)">📝 Содержит "спасибо"</option>
        <option value="(content,regex,привет)">📝 Содержит "привет"</option>
        <option value="(content,regex,хорошо)">📝 Содержит "хорошо"</option>
        <option value="(content,regex,интересно)">📝 Содержит "интересно"</option>
        <option value="(content,regex,отлично)">📝 Содержит "отлично"</option>
        <option value="(type,eq,internal.text)">📝 Тип = internal.text</option>
        <option value="(type,eq,system)">📝 Тип = system</option>
        <option value="(type,in,[text,system])">📝 Тип в [text,system]</option>
        <option value="(senderId,eq,carl)">👤 Отправитель = carl</option>
        <option value="(senderId,eq,sara)">👤 Отправитель = sara</option>
        <option value="(senderId,in,[carl,marta])">👥 Отправитель в [carl,marta]</option>
        <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)">💬 Диалог = Общий чат</option>
        <option value="(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)">💬 Диалог = Проектные обсуждения</option>
        <option value="(dialogId,eq,dlg_1qdl3ymr68r2ebve4tqt)">💬 Диалог = Техподдержка</option>
        <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])">💬 Диалог в [Общий чат,Проектные обсуждения]</option>
        <option value="(meta.channelType,eq,whatsapp)">📱 WhatsApp сообщения</option>
        <option value="(meta.channelType,eq,telegram)">📱 Telegram сообщения</option>
        <option value="(meta.channelId,eq,W0000)">📱 Канал W0000</option>
        <option value="(meta.channelId,eq,TG0000)">📱 Канал TG0000</option>
        <option value="(meta.channelType,in,[whatsapp,telegram])">📱 WhatsApp или Telegram</option>
        <option value="(createdAt,gte,2025-10-24)">📅 Создано ≥ 24.10.2025</option>
        <option value="(createdAt,gte,2025-10-22)">📅 Создано ≥ 22.10.2025</option>
        <option value="(createdAt,lt,2025-10-21)">📅 Создано < 21.10.2025</option>
        <option value="(content,regex,встретимся)&(type,eq,system)">📝 "встретимся" + system</option>
        <option value="(senderId,eq,carl)&(type,eq,system)">👤 Carl + system</option>
        <option value="(content,regex,спасибо)&(createdAt,gte,2025-10-24)">📝 "спасибо" + ≥24.10</option>
        <option value="(senderId,in,[carl,sara])&(type,eq,internal.text)&(content,regex,привет)">👥 Carl/Sara + internal.text + "привет"</option>
        <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(senderId,eq,carl)">💬 Общий чат + Carl</option>
        <option value="(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)&(type,eq,internal.text)">💬 Проектные обсуждения + internal.text</option>
        <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,eq,marta)">💬 Общий чат/Проектные + Marta</option>
        <option value="(meta.channelType,eq,whatsapp)&(senderId,eq,carl)">📱 WhatsApp + Carl</option>
        <option value="(meta.channelType,eq,telegram)&(type,eq,internal.text)">📱 Telegram + internal.text</option>
        <option value="(meta.channelId,eq,W0000)&(content,regex,привет)">📱 W0000 + "привет"</option>
        <option value="(meta.channelType,in,[whatsapp,telegram])&(senderId,in,[carl,sara])">📱 WhatsApp/Telegram + Carl/Sara</option>
        <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(meta.channelType,eq,telegram)">💬 Общий чат + Telegram</option>
        <option value="(meta.channelId,eq,TG0000)&(type,eq,system)">📱 TG0000 + system</option>
        <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,in,[carl,marta])&(meta.channelType,eq,telegram)">💬 2 диалога + 2 отправителя + Telegram</option>
        <option value="custom">✏️ Пользовательский фильтр</option>
      </select>
      <div class="input-with-clear" style="margin-bottom: 8px;">
        <input
          type="text"
          id="messageFilterInput"
          v-model="filterInput"
          placeholder="Введите или выберите фильтр сообщений"
          @keydown.enter="apply"
        />
        <button
          class="clear-field"
          type="button"
          @click="clear"
          title="Очистить поле"
        >
          ✕
        </button>
      </div>
      <small style="display: block; color: #6c757d;">
        Поддерживаются поля `content`, `type`, `senderId`, `dialogId`, `meta.*`, `createdAt`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
      </small>
    </div>
    <div class="form-actions">
      <button class="btn-primary" type="button" @click="apply">Применить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  filterInput: string;
  selectedFilterExample: string;
}

interface Emits {
  (e: 'update:filterInput', value: string): void;
  (e: 'update:selectedFilterExample', value: string): void;
  (e: 'select-example'): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const filterInput = ref(props.filterInput);
const selectedExample = ref(props.selectedFilterExample);

watch(() => props.filterInput, (val) => {
  filterInput.value = val;
});

watch(() => props.selectedFilterExample, (val) => {
  selectedExample.value = val;
});

watch(filterInput, (val) => {
  emit('update:filterInput', val);
});

watch(selectedExample, (val) => {
  emit('update:selectedFilterExample', val);
});

function selectExample() {
  emit('select-example');
}

function clear() {
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>

<style scoped>
.filter-panel {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #ffffff;
}

.filter-panel .form-section {
  margin-bottom: 12px;
}

.filter-panel label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.filter-panel select,
.filter-panel input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.filter-panel .input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-panel .input-with-clear input {
  padding-right: 30px;
}

.filter-panel .clear-field {
  position: absolute;
  right: 5px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
}

.filter-panel .clear-field:hover {
  background: #e9ecef;
  color: #333;
}

.filter-panel .form-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}
</style>
