/* eslint-env browser */
import { useConfigStore } from '@/app/stores/config';

export async function loadConfig(): Promise<void> {
  return new Promise((resolve) => {
    // Проверяем, что мы в браузерном окружении
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Проверяем, загружен ли config.js
    if (window.CHAT3_CONFIG) {
      const store = useConfigStore();
      const config = window.CHAT3_CONFIG;
      store.setConfig({
        TENANT_API_URL: config.TENANT_API_URL || 'http://localhost:3000',
        CONTROL_APP_URL: config.CONTROL_APP_URL || 'http://localhost:3003',
        RABBITMQ_MANAGEMENT_URL: config.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672',
        PROJECT_NAME: config.PROJECT_NAME || 'chat3',
        APP_VERSION: config.APP_VERSION || '0.0.0',
      });
      resolve();
    } else {
      // Если config.js еще не загружен, ждем
      const checkInterval = setInterval(() => {
        if (window.CHAT3_CONFIG) {
          const store = useConfigStore();
          const config = window.CHAT3_CONFIG;
          store.setConfig({
            TENANT_API_URL: config.TENANT_API_URL || 'http://localhost:3000',
            CONTROL_APP_URL: config.CONTROL_APP_URL || 'http://localhost:3003',
            RABBITMQ_MANAGEMENT_URL: config.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672',
            PROJECT_NAME: config.PROJECT_NAME || 'chat3',
            APP_VERSION: config.APP_VERSION || '0.0.0',
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
