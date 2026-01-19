<template>
  <div class="user-selector">
    <div class="selector-item">
      <label for="user1">User 1:</label>
      <select id="user1" v-model="localUser1" @change="handleUser1Change">
        <option value="">Select User 1</option>
        <option v-for="user in availableUsers" :key="user.userId" :value="user.userId">
          {{ user.name }}
        </option>
      </select>
    </div>
    <div class="selector-item">
      <label for="user2">User 2:</label>
      <select id="user2" v-model="localUser2" @change="handleUser2Change">
        <option value="">Select User 2</option>
        <option v-for="user in availableUsers" :key="user.userId" :value="user.userId">
          {{ user.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { User } from '../types/index.js';
import { DEMO_USERS } from '../types/index.js';

const props = defineProps<{
  user1: string;
  user2: string;
}>();

const emit = defineEmits<{
  (e: 'update:user1', value: string): void;
  (e: 'update:user2', value: string): void;
}>();

const localUser1 = ref(props.user1);
const localUser2 = ref(props.user2);

watch(() => props.user1, (newValue) => {
  localUser1.value = newValue;
});

watch(() => props.user2, (newValue) => {
  localUser2.value = newValue;
});

const availableUsers = computed<User[]>(() => DEMO_USERS);

const handleUser1Change = () => {
  if (localUser1.value === localUser2.value) {
    localUser1.value = '';
    alert('User 1 and User 2 must be different');
    return;
  }
  emit('update:user1', localUser1.value);
};

const handleUser2Change = () => {
  if (localUser2.value === localUser1.value) {
    localUser2.value = '';
    alert('User 1 and User 2 must be different');
    return;
  }
  emit('update:user2', localUser2.value);
};
</script>

<style scoped>
.user-selector {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: white;
  border-bottom: 1px solid #ddd;
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.selector-item label {
  font-weight: 600;
  min-width: 70px;
}

.selector-item select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}
</style>
