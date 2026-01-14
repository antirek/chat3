<template>
  <div class="init-page">
    <div class="container">
      <div class="header">
        <h1>🚀 Инициализация Chat3</h1>
        <p>Настройка системы и заполнение тестовыми данными</p>
      </div>

      <div class="content">
        <div class="info-box">
          <h3>⚠️ Внимание!</h3>
          <ul>
            <li><strong>Инициализация удалит все данные</strong> из базы данных (пользователи, диалоги, сообщения, ключи и т.д.)</li>
            <li>После удаления будет создан базовый tenant (<code>tnt_default</code>) и сгенерирован новый API ключ</li>
            <li><strong>Важно:</strong> Сохраните API ключ после инициализации - он понадобится для работы с системой</li>
            <li><strong>Заполнение данными:</strong> После инициализации запустите seed для создания тестовых данных</li>
          </ul>
        </div>

        <!-- Секция 1: Инициализация системы -->
        <div class="section">
          <h2>1. Инициализация системы</h2>
          <p>
            <strong>Удаляет все данные</strong>, создает базовый tenant (<code>tnt_default</code>) и генерирует новый API ключ.
            После инициализации обязательно скопируйте и сохраните API ключ!
          </p>
          <div class="button-group">
            <button 
              id="initBtn" 
              class="btn-primary" 
              :disabled="initLoading"
              @click="initialize"
            >
              <span v-if="initLoading" class="loading"></span>
              <span v-else>⚙️</span>
              <span>{{ initLoading ? 'Инициализация...' : 'Провести инициализацию' }}</span>
            </button>
          </div>
          <div 
            v-if="initResult.show" 
            :class="['result', initResult.type]"
          >
            <div v-html="initResult.content"></div>
          </div>
        </div>

        <!-- Секция 2: Заполнение тестовыми данными -->
        <div class="section">
          <h2>2. Заполнение тестовыми данными</h2>
          <p>
            Запускает скрипт seed, который создает тестовых пользователей, диалоги, сообщения и другие данные.
            <strong>Внимание:</strong> Скрипт очищает существующие данные перед заполнением.
          </p>
          <div class="button-group">
            <button 
              id="seedBtn" 
              class="btn-success" 
              :disabled="seedLoading"
              @click="runSeed"
            >
              <span v-if="seedLoading" class="loading"></span>
              <span v-else>🌱</span>
              <span>{{ seedLoading ? 'Заполнение базы...' : 'Заполнить базу тестовыми данными' }}</span>
            </button>
          </div>
          <div 
            v-if="seedResult.show" 
            :class="['result', seedResult.type]"
          >
            <div v-html="seedResult.content"></div>
          </div>
        </div>

        <!-- Секция 3: Пересчет счетчиков пользователей -->
        <div class="section">
          <h2>3. Пересчет счетчиков пользователей</h2>
          <p>
            Пересчитывает все счетчики пользователей (dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount)
            для всех пользователей во всех тенантах на основе текущих данных в базе.
            <strong>Полезно:</strong> После миграций, исправления рассинхронизации или восстановления после ошибок.
          </p>
          <div class="button-group">
            <button 
              id="recalculateStatsBtn" 
              class="btn-primary" 
              :disabled="recalculateLoading"
              @click="recalculateUserStats"
            >
              <span v-if="recalculateLoading" class="loading"></span>
              <span v-else>🔄</span>
              <span>{{ recalculateLoading ? 'Пересчет счетчиков...' : 'Пересчитать счетчики для всех пользователей' }}</span>
            </button>
          </div>
          <div 
            v-if="recalculateResult.show" 
            :class="['result', recalculateResult.type]"
          >
            <div v-html="recalculateResult.content"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useInitPage } from '../model/useInitPage';

const {
  initLoading,
  initResult,
  seedLoading,
  seedResult,
  recalculateLoading,
  recalculateResult,
  initialize,
  runSeed,
  recalculateUserStats,
} = useInitPage();
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.init-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 10px;
}

.header p {
  font-size: 14px;
  opacity: 0.9;
}

.content {
  padding: 30px;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #667eea;
}

.section h2 {
  font-size: 18px;
  color: #333;
  margin-bottom: 10px;
}

.section p {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 15px;
  line-height: 1.6;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(72, 187, 120, 0.3);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.result.success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.result.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.result.info {
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  color: #0c5460;
}

.result :deep(pre) {
  margin-top: 10px;
  padding: 10px;
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.loading {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.info-box {
  background: #e7f3ff;
  border-left: 4px solid #2196F3;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.info-box h3 {
  font-size: 14px;
  color: #1976D2;
  margin-bottom: 8px;
}

.info-box ul {
  margin-left: 20px;
  font-size: 13px;
  color: #424242;
}

.info-box li {
  margin-bottom: 5px;
}
</style>

<style>
/* Глобальные стили для элементов, вставляемых через v-html */
.api-key-display {
  margin-top: 15px;
  padding: 20px;
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 6px;
}

.api-key-display h3 {
  font-size: 16px;
  color: #856404;
  margin-bottom: 15px;
}

.api-key-value {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  word-break: break-all;
  margin-bottom: 10px;
}

.api-key-value code {
  flex: 1;
  color: #333;
}

.copy-btn {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #5a6fd8;
}

.copy-btn:active {
  background: #4a5fc8;
}

.copy-btn.copy-success {
  background: #48bb78 !important;
}
</style>
