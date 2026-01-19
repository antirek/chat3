<template>
  <div class="api-key-input">
    <label for="api-key">API Key:</label>
    <input
      id="api-key"
      v-model="localApiKey"
      type="text"
      placeholder="Enter API Key"
      @input="handleInput"
      @keyup.enter="handleSubmit"
    />
    <button @click="handleSubmit">Save</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  apiKey: string;
}>();

const emit = defineEmits<{
  (e: 'update:apiKey', value: string): void;
}>();

const localApiKey = ref(props.apiKey);

watch(() => props.apiKey, (newValue) => {
  localApiKey.value = newValue;
});

const handleInput = () => {
  emit('update:apiKey', localApiKey.value);
};

const handleSubmit = () => {
  emit('update:apiKey', localApiKey.value);
};
</script>

<style scoped>
.api-key-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: white;
  border-bottom: 1px solid #ddd;
}

.api-key-input label {
  font-weight: 600;
  min-width: 80px;
}

.api-key-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.api-key-input button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.api-key-input button:hover {
  background: #0056b3;
}
</style>
