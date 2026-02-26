#!/usr/bin/env node
/**
 * Сложный сценарий: 5 паков, 10 user, 5 contact (не более 1 contact в диалоге),
 * несколько диалогов, contact'ы пишут сообщения, часть user отмечает прочитанным.
 * Проверка: целевые счётчики unreadBySenderType (fromType=contact) по пользователям и пакам.
 *
 * Все действия только через HTTP API tenant-api.
 *
 * Переменные окружения:
 *   TENANT_API_URL  - базовый URL API (по умолчанию http://localhost:3000)
 *   API_KEY        - X-API-Key (обязательно)
 *   TENANT_ID      - X-TENANT-ID (по умолчанию tnt_default)
 *
 * Запуск: node scripts/test-mark-read-complex-via-api.mjs
 *         npm run test:mark-read-api:complex
 */

const BASE_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = (process.env.TENANT_ID || 'tnt_default').trim().toLowerCase();

// --- Сценарий: 5 паков, 5 диалогов (в каждом 1 contact + несколько user) ---
const USER_IDS = ['usr_cx1', 'usr_cx2', 'usr_cx3', 'usr_cx4', 'usr_cx5', 'usr_cx6', 'usr_cx7', 'usr_cx8', 'usr_cx9', 'usr_cx10'];
const CONTACT_IDS = ['cnt_cx1', 'cnt_cx2', 'cnt_cx3', 'cnt_cx4', 'cnt_cx5'];

// Диалог i: один contact, несколько user. packIndex — индекс в массиве созданных паков.
const DIALOGS = [
  { packIndex: 0, contact: CONTACT_IDS[0], users: [USER_IDS[0], USER_IDS[1], USER_IDS[2]] },
  { packIndex: 1, contact: CONTACT_IDS[1], users: [USER_IDS[1], USER_IDS[3], USER_IDS[4]] },
  { packIndex: 2, contact: CONTACT_IDS[2], users: [USER_IDS[0], USER_IDS[4], USER_IDS[5]] },
  { packIndex: 3, contact: CONTACT_IDS[3], users: [USER_IDS[2], USER_IDS[5], USER_IDS[6]] },
  { packIndex: 4, contact: CONTACT_IDS[4], users: [USER_IDS[3], USER_IDS[6], USER_IDS[7], USER_IDS[8], USER_IDS[9]] },
];

// Кто отмечает прочитанным в диалоге i (тот, у кого в паке должно стать 0)
const MARK_READ_BY = [USER_IDS[0], USER_IDS[1], USER_IDS[4], USER_IDS[5], USER_IDS[7]];

// Построить целевые счётчики после получения реальных packIds от API
function buildExpected(packIds) {
  const expected = {};
  for (let di = 0; di < DIALOGS.length; di++) {
    const d = DIALOGS[di];
    const packId = packIds[d.packIndex];
    const reader = MARK_READ_BY[di];
    for (const uid of d.users) {
      if (!expected[uid]) expected[uid] = {};
      expected[uid][packId] = uid === reader ? 0 : 1;
    }
  }
  return expected;
}

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
  return e?.countUnread ?? 0;
}

async function main() {
  if (!API_KEY) {
    console.error('Укажите API_KEY');
    process.exit(1);
  }

  console.log('TENANT_API_URL:', BASE_URL);
  console.log('TENANT_ID:', TENANT_ID);
  console.log('Паков: 5, пользователей (user):', USER_IDS.length, ', контактов:', CONTACT_IDS.length);
  console.log('Диалогов:', DIALOGS.length);
  console.log('');

  const dialogIds = [];
  const packIds = [];
  const messageIds = [];
  let EXPECTED_CONTACT_UNREAD;

  try {
    // 1. Создаём 5 паков (уникальный query _req чтобы обойти идемпотентность при одинаковом body)
    console.log('1. Создание паков');
    for (let i = 0; i < 5; i++) {
      const res = await request('POST', `/api/packs?_req=${i}`, {});
      const id = res?.data?.packId;
      if (!id) throw new Error('Нет packId: ' + JSON.stringify(res));
      packIds.push(id);
    }
    console.log('   packIds:', packIds.join(', '));
    EXPECTED_CONTACT_UNREAD = buildExpected(packIds);

    // 2. Создаём 5 диалогов (в каждом 1 contact + несколько user)
    console.log('2. Создание диалогов');
    for (let i = 0; i < DIALOGS.length; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const d = DIALOGS[i];
      const members = [
        { userId: d.contact, type: 'contact' },
        ...d.users.map((uid) => ({ userId: uid, type: 'user' }))
      ];
      const res = await request('POST', '/api/dialogs', { members });
      const dialogId = res?.data?.dialogId;
      if (!dialogId) throw new Error('Нет dialogId: ' + JSON.stringify(res));
      dialogIds.push(dialogId);
      await request('POST', `/api/packs/${packIds[d.packIndex]}/dialogs`, { dialogId });
    }
    console.log('   dialogIds:', dialogIds.join(', '));

    // 3. В каждом диалоге contact отправляет сообщение
    console.log('3. Отправка сообщений от contact в каждый диалог');
    for (let i = 0; i < DIALOGS.length; i++) {
      const d = DIALOGS[i];
      const res = await request('POST', `/api/dialogs/${dialogIds[i]}/messages`, {
        senderId: d.contact,
        content: `Message from ${d.contact} in dialog ${i}`,
        type: 'internal.text'
      });
      const messageId = res?.data?.messageId;
      if (!messageId) throw new Error('Нет messageId: ' + JSON.stringify(res));
      messageIds.push(messageId);
    }
    console.log('   OK');

    await new Promise((r) => setTimeout(r, 400));

    // 4. Выборочно user отмечают прочитанным (по одному на диалог)
    console.log('4. Mark read (по одному user на диалог)');
    for (let i = 0; i < DIALOGS.length; i++) {
      const reader = MARK_READ_BY[i];
      await request('POST', `/api/users/${reader}/dialogs/${dialogIds[i]}/messages/${messageIds[i]}/status/read`);
    }
    console.log('   OK');

    await new Promise((r) => setTimeout(r, 800));

    // 5. Проверка: для каждого (userId, packId) из EXPECTED — запросить паки user и сверить contact count
    console.log('5. Проверка счётчиков');
    const errors = [];
    const checked = new Set(); // (userId, packId)

    for (const [userId, perPack] of Object.entries(EXPECTED_CONTACT_UNREAD)) {
      const packsRes = (await request('GET', `/api/users/${userId}/packs`)).data ?? [];
      for (const [packId, expectedCount] of Object.entries(perPack)) {
        const pack = packsRes.find((p) => p.packId === packId);
        if (!pack) {
          errors.push(`${userId} / ${packId}: пак не найден в списке пользователя`);
          continue;
        }
        const actual = getContactUnread(pack);
        if (actual !== expectedCount) {
          errors.push(`${userId} / ${packId}: ожидалось contact=${expectedCount}, получено ${actual}`);
        }
        checked.add(`${userId}:${packId}`);
      }
    }

    if (errors.length) {
      console.error('');
      errors.forEach((e) => console.error('  ', e));
      process.exit(1);
    }

    console.log(`   Проверено пар (user, pack): ${checked.size}`);
    console.log('');
    console.log('OK: все счётчики contact соответствуют сценарию.');
  } catch (err) {
    console.error('');
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

main();
