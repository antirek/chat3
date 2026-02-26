#!/usr/bin/env node
/**
 * Проверка mark-read на существующих данных (продакшн/стейджинг).
 * Шаги: контакт отправляет сообщение → user отмечает прочитанным → проверяем,
 * что в паках пользователя для fromType=contact countUnread = 0.
 *
 * Все данные задаются переменными окружения.
 *
 * Переменные окружения (обязательные):
 *   API_KEY        - X-API-Key
 *   DIALOG_ID      - ID диалога (dlg_...)
 *   CONTACT_ID     - userId отправителя (тип contact), например cnt_ym356mq
 *   USER_ID        - userId читателя (тип user), который отмечает прочитанным, например usr_bqrsneq
 *
 * Переменные окружения (опциональные):
 *   TENANT_API_URL - базовый URL API (по умолчанию http://localhost:3000)
 *   TENANT_ID      - X-TENANT-ID (по умолчанию tnt_default)
 *   PACK_ID        - ID пака для проверки; если не задан, берётся первый пак диалога из GET .../dialogs/:dialogId/packs
 *
 * Пример (продакшн):
 *   TENANT_API_URL=https://api.example.com \
 *   TENANT_ID=bch_fzxf3yw \
 *   API_KEY=... \
 *   DIALOG_ID=dlg_pbm8mlikrr9uvtqm800 \
 *   CONTACT_ID=cnt_ym356mq \
 *   USER_ID=usr_bqrsneq \
 *   node scripts/test-mark-read-via-api-prod.mjs
 */

const BASE_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = (process.env.TENANT_ID || 'tnt_default').trim().toLowerCase();

const DIALOG_ID = process.env.DIALOG_ID || '';
const CONTACT_ID = process.env.CONTACT_ID || '';
const USER_ID = process.env.USER_ID || '';
const PACK_ID = process.env.PACK_ID || null;

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-TENANT-ID': TENANT_ID
  };
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
  const missing = [];
  if (!API_KEY) missing.push('API_KEY');
  if (!DIALOG_ID) missing.push('DIALOG_ID');
  if (!CONTACT_ID) missing.push('CONTACT_ID');
  if (!USER_ID) missing.push('USER_ID');
  if (missing.length) {
    console.error('Задайте переменные окружения:', missing.join(', '));
    process.exit(1);
  }

  console.log('TENANT_API_URL:', BASE_URL);
  console.log('TENANT_ID:', TENANT_ID);
  console.log('DIALOG_ID:', DIALOG_ID);
  console.log('CONTACT_ID (отправитель):', CONTACT_ID);
  console.log('USER_ID (читатель):', USER_ID);
  console.log('PACK_ID (опционально):', PACK_ID || '(будет взят первый пак диалога)');
  console.log('');

  try {
    // 1. Контакт отправляет сообщение в диалог
    console.log('1. POST /api/dialogs/:dialogId/messages (senderId = CONTACT_ID)');
    const msgRes = await request('POST', `/api/dialogs/${DIALOG_ID}/messages`, {
      senderId: CONTACT_ID,
      content: `Test mark-read prod ${Date.now()}`,
      type: 'internal.text'
    });
    const messageId = msgRes?.data?.messageId;
    if (!messageId) {
      throw new Error('Нет messageId в ответе: ' + JSON.stringify(msgRes));
    }
    console.log('   messageId:', messageId);

    // 2. User отмечает сообщение как прочитанное
    console.log('2. POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/read');
    await request('POST', `/api/users/${USER_ID}/dialogs/${DIALOG_ID}/messages/${messageId}/status/read`);
    console.log('   OK');

    await new Promise((r) => setTimeout(r, 800));

    // 3. Определяем packId для проверки
    let checkPackId = PACK_ID;
    if (!checkPackId) {
      console.log('3. GET /api/users/:userId/dialogs/:dialogId/packs (получить пак диалога)');
      const dialogPacksRes = await request('GET', `/api/users/${USER_ID}/dialogs/${DIALOG_ID}/packs`);
      const dialogPacks = dialogPacksRes?.data ?? [];
      if (dialogPacks.length === 0) {
        throw new Error('У диалога нет паков в контексте пользователя. Задайте PACK_ID вручную.');
      }
      checkPackId = dialogPacks[0]?.packId ?? dialogPacks[0]?.pack_id;
      if (!checkPackId) {
        throw new Error('Не удалось получить packId из ответа: ' + JSON.stringify(dialogPacks[0]));
      }
      console.log('   packId:', checkPackId);
    } else {
      console.log('3. Используем PACK_ID из окружения:', checkPackId);
    }

    // 4. Запрашиваем список паков пользователя и проверяем счётчик
    console.log('4. GET /api/users/:userId/packs');
    const packsRes = await request('GET', `/api/users/${USER_ID}/packs`);
    const packs = packsRes?.data ?? [];
    const pack = packs.find((p) => p.packId === checkPackId);

    if (!pack) {
      throw new Error(`Пак ${checkPackId} не найден в списке паков пользователя. Всего паков: ${packs.length}`);
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
