import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface AppConfig {
  TENANT_API_URL: string;
  CONTROL_APP_URL: string;
  RABBITMQ_MANAGEMENT_URL: string;
  PROJECT_NAME: string;
  APP_VERSION: string;
}

declare global {
  interface Window {
    CHAT3_CONFIG?: AppConfig & {
      getTenantApiUrl: (path?: string) => string;
      getControlApiUrl: (path?: string) => string;
    };
  }
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig>({
    TENANT_API_URL: 'http://localhost:3000',
    CONTROL_APP_URL: 'http://localhost:3003',
    RABBITMQ_MANAGEMENT_URL: 'http://localhost:15672',
    PROJECT_NAME: 'chat3',
    APP_VERSION: '0.0.0',
  });

  function setConfig(newConfig: AppConfig) {
    config.value = newConfig;
  }

  function getTenantApiUrl(path = ''): string {
    return config.value.TENANT_API_URL + path;
  }

  function getControlApiUrl(path = ''): string {
    return config.value.CONTROL_APP_URL + path;
  }

  return {
    config,
    setConfig,
    getTenantApiUrl,
    getControlApiUrl,
  };
});
