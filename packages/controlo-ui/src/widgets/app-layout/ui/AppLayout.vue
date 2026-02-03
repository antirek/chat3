<template>
  <div class="app-layout">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>🧪 Chat3 API Test Suite</h1>
        <p>Интерактивные интерфейсы для тестирования REST API</p>
        <div class="header-meta">
          <span>Проект: {{ configStore.config.PROJECT_NAME }}</span>
          <span>Версия: {{ configStore.config.APP_VERSION }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="header-links">
          <a
            :href="tenantApiDocsUrl"
            target="_blank"
            class="header-link"
          >
            OpenAPI Tenant-api
          </a>
          <a
            :href="controlApiDocsUrl"
            target="_blank"
            class="header-link"
          >
            OpenAPI Control-api
          </a>
          <a
            :href="configStore.config.RABBITMQ_MANAGEMENT_URL"
            target="_blank"
            class="header-link"
          >
            RabbitMQ Manage UI
          </a>
        </div>
        <div class="header-inputs">
          <div class="header-input-group">
            <label for="headerApiKey">API Key:</label>
            <input
              type="text"
              id="headerApiKey"
              v-model="apiKey"
              placeholder="Введите API Key"
              @input="checkForChanges"
              @change="checkForChanges"
            />
          </div>
          <div class="header-input-group">
            <label for="headerTenantId">Tenant ID:</label>
            <select
              id="headerTenantId"
              v-model="tenantId"
              @change="checkForChanges"
            >
              <template v-if="tenantsList.length === 0">
                <option v-if="!hasApiKey" value="tnt_default">tnt_default</option>
                <option v-else value="tnt_default">Загрузка...</option>
              </template>
              <option
                v-for="tenant in tenantsList"
                :key="tenant.tenantId"
                :value="tenant.tenantId"
              >
                {{ tenant.tenantId }}
              </option>
            </select>
            <button
              id="headerApplyButton"
              class="header-apply-btn"
              :class="{ applied: credentialsApplied || storeCredentialsApplied }"
              @click="applyCredentials"
              title="Применить API Key и Tenant ID"
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Container with Sidebar and Content -->
    <div class="container">
      <!-- Sidebar с навигацией -->
      <div class="sidebar">
        <div class="nav-links">
          <router-link
            to="/user-dialogs"
            class="nav-link"
            title="Пользователи + Диалоги + Сообщения"
          >
            <span class="nav-link-icon">👥</span>
          </router-link>

          <router-link
            to="/dialogs-messages"
            class="nav-link"
            title="Диалоги + Сообщения"
          >
            <span class="nav-link-icon">💬</span>
          </router-link>

          <router-link
            to="/topics-messages"
            class="nav-link"
            title="Топики + Сообщения"
          >
            <span class="nav-link-icon">📌</span>
          </router-link>

          <router-link
            to="/messages"
            class="nav-link"
            title="Сообщения"
          >
            <span class="nav-link-icon">📝</span>
          </router-link>

          <router-link
            to="/users"
            class="nav-link"
            title="Пользователи"
          >
            <span class="nav-link-icon">👤</span>
          </router-link>

          <router-link
            to="/tenants"
            class="nav-link"
            title="Тенанты"
          >
            <span class="nav-link-icon">🏢</span>
          </router-link>

          <router-link
            to="/packs"
            class="nav-link"
            title="Паки"
          >
            <span class="nav-link-icon">📦</span>
          </router-link>

          <router-link
            to="/chat"
            class="nav-link"
            title="Чат пользователя"
          >
            <span class="nav-link-icon">💬</span>
          </router-link>

          <div style="border-top: 1px solid #e9ecef; margin: 10px 0;"></div>

          <router-link
            to="/init"
            class="nav-link"
            title="Инициализация"
          >
            <span class="nav-link-icon">🚀</span>
          </router-link>

          <router-link
            to="/db-explorer"
            class="nav-link"
            title="DB Explorer"
          >
            <span class="nav-link-icon">🗄️</span>
          </router-link>

          <router-link
            to="/events-updates"
            class="nav-link"
            title="События и Updates"
          >
            <span class="nav-link-icon">📊</span>
          </router-link>

          <router-link
            to="/activity"
            class="nav-link"
            title="Активность"
          >
            <span class="nav-link-icon">📈</span>
          </router-link>

          <a
            class="nav-link"
            href="/health"
            target="_blank"
            title="Health Check"
          >
            <span class="nav-link-icon">💚</span>
          </a>
        </div>
      </div>

      <!-- Контент область -->
      <div class="content" :class="{ 'content-no-scroll': $route.name === 'chat' }">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

// Состояние
const tenantsList = ref<any[]>([]);
const credentialsApplied = ref(false);
// Сохраняем исходные примененные значения для сравнения
const appliedApiKey = ref('');
const appliedTenantId = ref('tnt_default');

// Используем credentials из store (toRef для правильной типизации)
const apiKey = toRef(credentialsStore, 'apiKey');
const tenantId = toRef(credentialsStore, 'tenantId');
const storeCredentialsApplied = toRef(credentialsStore, 'credentialsApplied');

// Computed
const tenantApiDocsUrl = computed(() => {
  return `${configStore.config.TENANT_API_URL}/api-docs`;
});

const controlApiDocsUrl = computed(() => {
  return `${configStore.config.CONTROL_APP_URL}/api-docs`;
});

const hasApiKey = computed(() => {
  return apiKey.value.trim().length > 0;
});

// Функции
async function loadTenants() {
  const key = apiKey.value.trim();

  if (!key) {
    tenantsList.value = [];
    return;
  }

  // Проверяем, что конфигурация загружена
  if (!configStore.config.TENANT_API_URL) {
    console.warn('Конфигурация еще не загружена, ждем...');
    setTimeout(loadTenants, 100);
    return;
  }

  try {
    const tenantApiUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    let allTenants: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${tenantApiUrl}/api/tenants?page=${page}&limit=100`, {
        headers: {
          'X-API-Key': key,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const pageTenants = result.data || [];
      allTenants = allTenants.concat(pageTenants);

      const totalPages = result.pagination?.pages || 1;
      hasMore = page < totalPages && pageTenants.length > 0;
      page++;
    }

    tenantsList.value = allTenants;
  } catch (error) {
    console.error('Error loading tenants:', error);
    tenantsList.value = [];
  }
}

function checkForChanges() {
  // Сравниваем текущие значения с примененными (которые были сохранены при нажатии на галочку)
  const currentApiKey = apiKey.value.trim();
  const currentTenantId = tenantId.value || 'tnt_default';

  // Если значения изменились относительно примененных, сбрасываем флаг applied
  if (currentApiKey !== appliedApiKey.value || currentTenantId !== appliedTenantId.value) {
    credentialsApplied.value = false;
    storeCredentialsApplied.value = false;
  } else if (currentApiKey && currentApiKey === appliedApiKey.value && currentTenantId === appliedTenantId.value) {
    // Если значения совпадают с примененными и API Key не пустой, устанавливаем флаг applied
    credentialsApplied.value = true;
    storeCredentialsApplied.value = true;
  }
}

async function applyCredentials() {
  // Сохраняем текущие значения как примененные
  appliedApiKey.value = apiKey.value.trim();
  appliedTenantId.value = tenantId.value || 'tnt_default';

  // Используем метод из store, который установит флаг и отправит событие
  credentialsStore.applyCredentials();
  credentialsApplied.value = true;
  storeCredentialsApplied.value = true;

  // Загружаем список тенантов после применения API Key
  await loadTenants();

  // Устанавливаем сохраненный tenantId после загрузки списка
  const savedTenantId = localStorage.getItem('tenantId') || 'tnt_default';
  if (tenantsList.value.find((t) => t.tenantId === savedTenantId)) {
    tenantId.value = savedTenantId;
    appliedTenantId.value = savedTenantId;
  }
}

// Watch для автоматической загрузки тенантов при изменении API Key
watch(apiKey, async (newValue) => {
  if (newValue.trim()) {
    await loadTenants();
    // Устанавливаем сохраненный tenantId после загрузки списка
    const savedTenantId = localStorage.getItem('tenantId') || 'tnt_default';
    if (tenantsList.value.length > 0) {
      if (tenantsList.value.find((t) => t.tenantId === savedTenantId)) {
        tenantId.value = savedTenantId;
      }
    }
  } else {
    tenantsList.value = [];
  }
});

onMounted(async () => {
  // Загружаем credentials из localStorage
  credentialsStore.loadFromStorage();

  // Если есть API Key, загружаем тенантов
  if (apiKey.value.trim()) {
    await loadTenants();

    // Устанавливаем сохраненный tenantId после загрузки списка
    const savedTenantId = localStorage.getItem('tenantId') || 'tnt_default';
    if (tenantsList.value.length > 0) {
      // Если сохраненный tenantId есть в списке, устанавливаем его
      if (tenantsList.value.find((t) => t.tenantId === savedTenantId)) {
        tenantId.value = savedTenantId;
      } else {
        // Если тенанта нет в списке, но он был сохранен, добавляем его в начало
        tenantId.value = savedTenantId;
      }
    } else {
      // Если список пустой, устанавливаем дефолт
      tenantId.value = savedTenantId;
    }
  } else {
    // Если нет API Key, устанавливаем дефолт
    tenantId.value = 'tnt_default';
  }

  // Инициализируем примененные значения из localStorage
  const savedApiKey = localStorage.getItem('apiKey') || '';
  const savedTenantId = localStorage.getItem('tenantId') || 'tnt_default';
  appliedApiKey.value = savedApiKey;
  appliedTenantId.value = savedTenantId;

  // Проверяем, применены ли текущие значения (при загрузке страницы)
  // Выполняется после загрузки тенантов, чтобы tenantId был правильно установлен
  // Используем checkForChanges для единообразной логики
  checkForChanges();
});
</script>

<style scoped>
.app-layout {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 40px;
}

/* .header-left {
  flex: 1;
} */

.header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 5px;
}

.header p {
  font-size: 14px;
  opacity: 0.9;
}

.header-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.header-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.header-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.header-links {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.header-link {
  color: white;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 6px;
  transition: background 0.2s;
  opacity: 0.95;
}

.header-link:hover {
  background: rgba(255, 255, 255, 0.2);
  opacity: 1;
}

.header-inputs {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.header-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px;
}

.header-input-group label {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.95;
}

.header-input-group input,
.header-input-group select {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 13px;
  min-width: 200px;
  transition: background 0.2s, border-color 0.2s;
}

.header-input-group input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.header-input-group input:focus,
.header-input-group select:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
}

.header-input-group select option {
  background: #2c3e50;
  color: white;
}

.header-apply-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(158, 158, 158, 0.6);
  color: white;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 36px;
  height: 29px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-apply-btn:hover {
  background: rgba(158, 158, 158, 0.8);
  border-color: rgba(255, 255, 255, 0.5);
  transform: scale(1.05);
}

.header-apply-btn:active {
  transform: scale(0.95);
}

.header-apply-btn.applied {
  background: rgba(76, 175, 80, 0.8);
}

.header-apply-btn.applied:hover {
  background: rgba(76, 175, 80, 1);
}

.container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  background: white;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.nav-links {
  flex: 1;
  overflow-y: auto;
  width: 80px;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15px;
  color: #333;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
  user-select: none;
}

.nav-link:hover {
  background: #f8f9fa;
  border-left-color: #667eea;
}

.nav-link.router-link-active {
  background: #e3f2fd;
  border-left-color: #667eea;
  color: #667eea;
  font-weight: 500;
}

.nav-link-icon {
  font-size: 28px;
  display: block;
  line-height: 1;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.content-no-scroll {
  overflow: hidden;
}

/* Скроллбар для sidebar */
.nav-links::-webkit-scrollbar {
  width: 6px;
}

.nav-links::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.nav-links::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.nav-links::-webkit-scrollbar-thumb:hover {
  background: #999;
}

/* Адаптивные стили */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 15px;
  }

  .header-right {
    align-items: flex-start;
    width: 100%;
  }

  .header-links {
    width: 100%;
    justify-content: flex-start;
  }

  .header-inputs {
    flex-direction: column;
    width: 100%;
    align-items: stretch;
  }

  .header-input-group {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }

  .header-input-group input {
    width: 100%;
    min-width: unset;
  }
}
</style>
