import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { loadConfig } from '@/shared/config';

// Создаем приложение и Pinia сначала
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Загружаем конфигурацию после инициализации Pinia
loadConfig().then(() => {
  app.mount('#app');
});
