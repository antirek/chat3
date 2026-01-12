import { useConfigStore } from '@/app/stores/config';

export async function loadConfig(): Promise<void> {
  return new Promise((resolve) => {
    // Проверяем, загружен ли config.js
    if (window.CHAT3_CONFIG) {
      const store = useConfigStore();
      store.setConfig({
        TENANT_API_URL: window.CHAT3_CONFIG.TENANT_API_URL,
        CONTROL_APP_URL: window.CHAT3_CONFIG.CONTROL_APP_URL,
        RABBITMQ_MANAGEMENT_URL: window.CHAT3_CONFIG.RABBITMQ_MANAGEMENT_URL,
        PROJECT_NAME: window.CHAT3_CONFIG.PROJECT_NAME,
        APP_VERSION: window.CHAT3_CONFIG.APP_VERSION,
      });
      resolve();
    } else {
      // Если config.js еще не загружен, ждем
      const checkInterval = setInterval(() => {
        if (window.CHAT3_CONFIG) {
          const store = useConfigStore();
          store.setConfig({
            TENANT_API_URL: window.CHAT3_CONFIG.TENANT_API_URL,
            CONTROL_APP_URL: window.CHAT3_CONFIG.CONTROL_APP_URL,
            RABBITMQ_MANAGEMENT_URL: window.CHAT3_CONFIG.RABBITMQ_MANAGEMENT_URL,
            PROJECT_NAME: window.CHAT3_CONFIG.PROJECT_NAME,
            APP_VERSION: window.CHAT3_CONFIG.APP_VERSION,
          });
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    }
  });
}

export function getConfig() {
  const store = useConfigStore();
  return store.config;
}
