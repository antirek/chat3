#!/usr/bin/env node
/**
 * Скрипт проверки сценария: контакт отправляет сообщение, user отмечает прочитанным,
 * в списке паков у user в stats.unreadBySenderType для fromType=contact должно быть 0.
 *
 * Все действия выполняются только через HTTP API tenant-api (ручная проверка против
 * запущенного сервера). Для CI/локальных тестов без сервера используйте интеграционный
 * тест: npm run test:mark-read
 *
 * Переменные окружения:
 *   TENANT_API_URL  - базовый URL API (например https://api.example.com)
 *   API_KEY        - X-API-Key
 *   TENANT_ID      - X-TENANT-ID (опционально, по умолчанию tnt_default)
 *
 * Запуск: node scripts/test-mark-read-via-api.mjs  или  npm run test:mark-read-api
 */

const BASE_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = (process.env.TENANT_ID || 'tnt_default').trim().toLowerCase();

const USER_ID = 'usr_test_mark_read';
const CONTACT_ID = 'cnt_test_mark_read';

function headers() {
  const h = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-TENANT-ID': TENANT_ID
  };
  return h;
}

async function request(method, path, body = null) {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const opts = { method, headers: headers() };
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { _raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  if (!API_KEY) {
    console.error('Укажите API_KEY (и при необходимости TENANT_API_URL, TENANT_ID)');
    process.exit(1);
  }

  console.log('TENANT_API_URL:', BASE_URL);
  console.log('TENANT_ID:', TENANT_ID);
  console.log('');

  let dialogId, packId, messageId;

  try {
    // 1. Создаём диалог с двумя участниками: user и contact
    console.log('1. POST /api/dialogs (с участниками user + contact)');
    const dialogRes = await request('POST', '/api/dialogs', {
      members: [
        { userId: USER_ID, type: 'user' },
        { userId: CONTACT_ID, type: 'contact' }
      ]
    });
    dialogId = dialogRes?.data?.dialogId;
    if (!dialogId) {
      throw new Error('Нет dialogId в ответе: ' + JSON.stringify(dialogRes));
    }
    console.log('   dialogId:', dialogId);

    // 2. Создаём пак
    console.log('2. POST /api/packs');
    const packRes = await request('POST', '/api/packs', {});
    packId = packRes?.data?.packId;
    if (!packId) {
      throw new Error('Нет packId в ответе: ' + JSON.stringify(packRes));
    }
    console.log('   packId:', packId);

    // 3. Добавляем диалог в пак
    console.log('3. POST /api/packs/:packId/dialogs');
    await request('POST', `/api/packs/${packId}/dialogs`, { dialogId });
    console.log('   OK');

    // 4. Контакт отправляет сообщение в диалог
    console.log('4. POST /api/dialogs/:dialogId/messages (senderId = contact)');
    const msgRes = await request('POST', `/api/dialogs/${dialogId}/messages`, {
      senderId: CONTACT_ID,
      content: 'Test message from contact',
      type: 'internal.text'
    });
    messageId = msgRes?.data?.messageId;
    if (!messageId) {
      throw new Error('Нет messageId в ответе: ' + JSON.stringify(msgRes));
    }
    console.log('   messageId:', messageId);

    // 5. User отмечает сообщение как прочитанное
    console.log('5. POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/read');
    await request('POST', `/api/users/${USER_ID}/dialogs/${dialogId}/messages/${messageId}/status/read`);
    console.log('   OK');

    // Небольшая пауза на случай асинхронной обработки воркером
    await new Promise((r) => setTimeout(r, 500));

    // 6. Запрашиваем список паков пользователя (user)
    console.log('6. GET /api/users/:userId/packs');
    const packsRes = await request('GET', `/api/users/${USER_ID}/packs`);
    const packs = packsRes?.data ?? [];
    const pack = packs.find((p) => p.packId === packId);

    if (!pack) {
      throw new Error(`Пак ${packId} не найден в списке паков пользователя. data.length=${packs.length}`);
    }

    const unreadBySenderType = pack?.stats?.unreadBySenderType ?? [];
    const contactEntry = unreadBySenderType.find((e) => e.fromType === 'contact');
    const countContact = contactEntry?.countUnread ?? null;

    console.log('   pack.stats.unreadBySenderType:', JSON.stringify(unreadBySenderType, null, 2));

    if (countContact !== 0) {
      console.error('');
      console.error('ОЖИДАЛОСЬ: stats.unreadBySenderType для fromType=contact = 0');
      console.error('ПОЛУЧЕНО: countUnread(contact) =', countContact);
      process.exit(1);
    }

    console.log('');
    console.log('OK: для fromType=contact countUnread = 0');
  } catch (err) {
    console.error('');
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

main();
