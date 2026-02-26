#!/usr/bin/env node
/**
 * Продвинутый тест: диалог с 3 участниками (2 user, 1 contact). Контакт отправляет сообщение,
 * один user отмечает прочитанным — проверяем, что у него contact=0, у второго user — contact=1.
 *
 * Все действия только через HTTP API tenant-api. Для локальной инсталляции.
 *
 * Переменные окружения:
 *   TENANT_API_URL  - базовый URL API (по умолчанию http://localhost:3000)
 *   API_KEY        - X-API-Key (обязательно)
 *   TENANT_ID      - X-TENANT-ID (по умолчанию tnt_default)
 *
 * Запуск: node scripts/test-mark-read-two-users-via-api.mjs
 *        npm run test:mark-read-api:two-users
 */

const BASE_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = (process.env.TENANT_ID || 'tnt_default').trim().toLowerCase();

const USER_READER = 'usr_test_reader';   // этот user отметит сообщение прочитанным → у него 0
const USER_OTHER = 'usr_test_other';     // этот user не читает → у него 1
const CONTACT_ID = 'cnt_test_sender';

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

function getContactUnread(pack) {
  const arr = pack?.stats?.unreadBySenderType ?? [];
  const e = arr.find((x) => x.fromType === 'contact');
  return e?.countUnread ?? null;
}

async function main() {
  if (!API_KEY) {
    console.error('Укажите API_KEY (и при необходимости TENANT_API_URL, TENANT_ID)');
    process.exit(1);
  }

  console.log('TENANT_API_URL:', BASE_URL);
  console.log('TENANT_ID:', TENANT_ID);
  console.log('Участники: reader=', USER_READER, ', other=', USER_OTHER, ', contact=', CONTACT_ID);
  console.log('');

  let dialogId, packId, messageId;

  try {
    // 1. Диалог с 3 участниками: 2 user, 1 contact
    console.log('1. POST /api/dialogs (2 user + 1 contact)');
    const dialogRes = await request('POST', '/api/dialogs', {
      members: [
        { userId: USER_READER, type: 'user' },
        { userId: USER_OTHER, type: 'user' },
        { userId: CONTACT_ID, type: 'contact' }
      ]
    });
    dialogId = dialogRes?.data?.dialogId;
    if (!dialogId) throw new Error('Нет dialogId: ' + JSON.stringify(dialogRes));
    console.log('   dialogId:', dialogId);

    // 2. Пак и привязка диалога
    console.log('2. POST /api/packs');
    const packRes = await request('POST', '/api/packs', {});
    packId = packRes?.data?.packId;
    if (!packId) throw new Error('Нет packId: ' + JSON.stringify(packRes));
    console.log('   packId:', packId);

    console.log('3. POST /api/packs/:packId/dialogs');
    await request('POST', `/api/packs/${packId}/dialogs`, { dialogId });
    console.log('   OK');

    // 4. Контакт отправляет сообщение → у обоих user по 1 непрочитанному от contact
    console.log('4. POST /api/dialogs/:dialogId/messages (senderId = contact)');
    const msgRes = await request('POST', `/api/dialogs/${dialogId}/messages`, {
      senderId: CONTACT_ID,
      content: 'Message from contact for two-users test',
      type: 'internal.text'
    });
    messageId = msgRes?.data?.messageId;
    if (!messageId) throw new Error('Нет messageId: ' + JSON.stringify(msgRes));
    console.log('   messageId:', messageId);

    await new Promise((r) => setTimeout(r, 300));

    // 5. Только user_reader отмечает сообщение прочитанным
    console.log('5. POST .../status/read (только для', USER_READER + ')');
    await request('POST', `/api/users/${USER_READER}/dialogs/${dialogId}/messages/${messageId}/status/read`);
    console.log('   OK');

    await new Promise((r) => setTimeout(r, 600));

    // 6. Счётчики у reader: contact должен быть 0
    console.log('6. GET /api/users/:userId/packs (reader)');
    const packsReader = (await request('GET', `/api/users/${USER_READER}/packs`)).data ?? [];
    const packReader = packsReader.find((p) => p.packId === packId);
    if (!packReader) throw new Error(`Пак ${packId} не найден у reader. Паков: ${packsReader.length}`);
    const readerContact = getContactUnread(packReader);
    console.log('   reader unreadBySenderType(contact):', readerContact);

    // 7. Счётчики у other: contact должен остаться 1
    console.log('7. GET /api/users/:userId/packs (other)');
    const packsOther = (await request('GET', `/api/users/${USER_OTHER}/packs`)).data ?? [];
    const packOther = packsOther.find((p) => p.packId === packId);
    if (!packOther) throw new Error(`Пак ${packId} не найден у other. Паков: ${packsOther.length}`);
    const otherContact = getContactUnread(packOther);
    console.log('   other unreadBySenderType(contact):', otherContact);

    let failed = false;
    if (readerContact !== 0) {
      console.error('');
      console.error('ОЖИДАЛОСЬ у reader: fromType=contact countUnread = 0, получено:', readerContact);
      failed = true;
    }
    if (otherContact !== 1) {
      console.error('');
      console.error('ОЖИДАЛОСЬ у other: fromType=contact countUnread = 1, получено:', otherContact);
      failed = true;
    }
    if (failed) process.exit(1);

    console.log('');
    console.log('OK: у reader contact=0, у other contact=1');
  } catch (err) {
    console.error('');
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

main();
