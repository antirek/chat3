<template>
  <div class="dialog-selector">
    <label for="dialog-select">Dialog:</label>
    <select 
      id="dialog-select" 
      v-model="selectedDialogId" 
      @change="handleDialogChange"
      :disabled="!user1 || !user2 || loading"
    >
      <option value="">Select Dialog</option>
      <option v-for="dialog in dialogs" :key="dialog.dialog_id" :value="dialog.dialog_id">
        {{ dialog.name || `Dialog ${dialog.dialog_id.substring(0, 10)}...` }}
      </option>
    </select>
    <button v-if="!loading" @click="loadDialogs" :disabled="!user1">
      Refresh
    </button>
    <span v-if="loading" class="loading">Loading...</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useGrpcApi } from '../composables/useGrpcApi.js';
import type { Dialog } from '../types/index.js';

const props = defineProps<{
  user1: string;
  user2: string;
}>();

const emit = defineEmits<{
  (e: 'update:dialogId', value: string): void;
}>();

const { getUserDialogs } = useGrpcApi();
const dialogs = ref<Dialog[]>([]);
const selectedDialogId = ref<string>('');
const loading = ref(false);

const loadDialogs = async () => {
  if (!props.user1 || loading.value) return;
  
  loading.value = true;
  try {
    // Получаем диалоги для user1
    const response1 = await getUserDialogs(props.user1);
    const dialogs1 = response1.dialogs || [];
    
    // Получаем диалоги для user2
    const response2 = await getUserDialogs(props.user2);
    const dialogs2 = response2.dialogs || [];
    
    // Находим общие диалоги (диалоги, в которых состоят оба пользователя)
    const dialogIds1 = new Set(dialogs1.map((d: Dialog) => d.dialog_id));
    const commonDialogs = dialogs1.filter((d: Dialog) => 
      dialogIds1.has(d.dialog_id) && dialogs2.some((d2: Dialog) => d2.dialog_id === d.dialog_id)
    );
    
    dialogs.value = commonDialogs;
    console.log(`[DialogSelector] Found ${commonDialogs.length} common dialogs`);
  } catch (error) {
    console.error('[DialogSelector] Error loading dialogs:', error);
  } finally {
    loading.value = false;
  }
};

const handleDialogChange = () => {
  emit('update:dialogId', selectedDialogId.value);
};

watch(() => props.user1, () => {
  dialogs.value = [];
  selectedDialogId.value = '';
  if (props.user1 && props.user2) {
    loadDialogs();
  }
});

watch(() => props.user2, () => {
  dialogs.value = [];
  selectedDialogId.value = '';
  if (props.user1 && props.user2) {
    loadDialogs();
  }
});

onMounted(() => {
  if (props.user1 && props.user2) {
    loadDialogs();
  }
});
</script>

<style scoped>
.dialog-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: white;
  border-bottom: 1px solid #ddd;
}

.dialog-selector label {
  font-weight: 600;
  min-width: 70px;
}

.dialog-selector select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.dialog-selector select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.dialog-selector button {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.dialog-selector button:hover:not(:disabled) {
  background: #218838;
}

.dialog-selector button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.loading {
  color: #666;
  font-size: 12px;
}
</style>
