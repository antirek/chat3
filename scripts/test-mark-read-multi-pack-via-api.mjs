#!/usr/bin/env node
/**
 * Сценарий «диалог в нескольких паках»: один и тот же диалог добавлен в несколько паков.
 * При добавлении сообщения счётчик unread (fromType=contact) должен расти у пользователя
 * во всех паках, где есть этот диалог. При прочтении — уменьшаться во всех этих паках.
 *
 * Структура:
 *   - 3 пака: P0, P1, P2
 *   - 2 диалога: D0 (user1, user2, contact1), D1 (user2, user3, contact2)
 *   - D0 добавлен в P0 и P1; D1 добавлен в P1 и P2 → P1 содержит оба диалога
 *
 * Сообщений: по 3 от contact в каждом диалоге (всего 6). Users читают по очереди;
 * после каждого шага проверяются счётчики во всех паках.
 *
 * Переменные окружения: TENANT_API_URL, API_KEY, TENANT_ID
 * Запуск: node scripts/test-mark-read-multi-pack-via-api.mjs
 *         npm run test:mark-read-api:multi-pack
 */

const MESSAGES_PER_DIALOG = 3;

const BASE_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const TENANT_ID = (process.env.TENANT_ID || 'tnt_default').trim().toLowerCase();

const USER_IDS = ['usr_mp1', 'usr_mp2', 'usr_mp3'];
const CONTACT_IDS = ['cnt_mp1', 'cnt_mp2'];

// Диалог 0: user1, user2, contact1. Будет добавлен в паки с индексами 0 и 1.
// Диалог 1: user2, user3, contact2. Будет добавлен в паки с индексами 1 и 2.
const DIALOGS = [
  { contact: CONTACT_IDS[0], users: [USER_IDS[0], USER_IDS[1]], packIndexes: [0, 1] },
  { contact: CONTACT_IDS[1], users: [USER_IDS[1], USER_IDS[2]], packIndexes: [1, 2] }
];

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

async function getPacksByUser(userId) {
  const res = await request('GET', `/api/users/${userId}/packs`);
  return (res?.data ?? []).reduce((acc, p) => {
    acc[p.packId] = p;
    return acc;
  }, {});
}

function checkCounts(userId, packIdToExpected, packsByUser, phase) {
  const errors = [];
  for (const [packId, expected] of Object.entries(packIdToExpected)) {
    const pack = packsByUser[packId];
    if (!pack) {
      errors.push(`[${phase}] ${userId} / ${packId}: пак не найден`);
      continue;
    }
    const actual = getContactUnread(pack);
    if (actual !== expected) {
      errors.push(`[${phase}] ${userId} / ${packId}: ожидалось ${expected}, получено ${actual}`);
    }
  }
  return errors;
}

async function main() {
  if (!API_KEY) {
    console.error('Укажите API_KEY');
    process.exit(1);
  }

  console.log('TENANT_API_URL:', BASE_URL);
  console.log('TENANT_ID:', TENANT_ID);
  console.log(`Сценарий: диалог в нескольких паках (3 пака, 2 диалога, по ${MESSAGES_PER_DIALOG} сообщений в диалоге, 3 user, 2 contact)`);
  console.log('');

  const packIds = [];
  const dialogIds = [];
  /** messageIds[di][k] = messageId k-го сообщения в диалоге di */
  const messageIds = [[], []];

  const allErrors = [];

  try {
    // 1. Создаём 3 пака
    console.log('1. Создание паков');
    for (let i = 0; i < 3; i++) {
      const res = await request('POST', `/api/packs?_req=mp${i}`, {});
      const id = res?.data?.packId;
      if (!id) throw new Error('Нет packId: ' + JSON.stringify(res));
      packIds.push(id);
    }
    console.log('   packIds:', packIds.join(', '));

    // 2. Создаём 2 диалога и добавляем каждый в несколько паков
    console.log('2. Создание диалогов и привязка к пакам');
    for (let i = 0; i < DIALOGS.length; i++) {
      const d = DIALOGS[i];
      const members = [
        { userId: d.contact, type: 'contact' },
        ...d.users.map((uid) => ({ userId: uid, type: 'user' }))
      ];
      const res = await request('POST', '/api/dialogs', { members });
      const dialogId = res?.data?.dialogId;
      if (!dialogId) throw new Error('Нет dialogId: ' + JSON.stringify(res));
      dialogIds.push(dialogId);
      for (const packIdx of d.packIndexes) {
        await request('POST', `/api/packs/${packIds[packIdx]}/dialogs`, { dialogId });
      }
      console.log(`   Диалог ${i} (${dialogId}) → паки ${d.packIndexes.map((idx) => packIds[idx]).join(', ')}`);
    }

    // 3. По MESSAGES_PER_DIALOG сообщений в каждом диалоге от contact
    console.log(`3. Отправка по ${MESSAGES_PER_DIALOG} сообщений в каждом диалоге`);
    const N = MESSAGES_PER_DIALOG;
    for (let di = 0; di < DIALOGS.length; di++) {
      const d = DIALOGS[di];
      for (let k = 0; k < N; k++) {
        const res = await request('POST', `/api/dialogs/${dialogIds[di]}/messages`, {
          senderId: d.contact,
          content: `Message ${k + 1}/${N} from ${d.contact} in dialog ${di}`,
          type: 'internal.text'
        });
        const msgId = res?.data?.messageId;
        if (!msgId) throw new Error('Нет messageId: ' + JSON.stringify(res));
        messageIds[di].push(msgId);
      }
    }

    await new Promise((r) => setTimeout(r, 600));

    // Проверка после всех сообщений: каждый новый message увеличивает счётчик во всех паках с этим диалогом
    console.log(`   Проверка: счётчики после ${N * 2} сообщений (по ${N} в каждом диалоге)`);
    const expectedAfterAllMessages = {
      [USER_IDS[0]]: { [packIds[0]]: N, [packIds[1]]: N },
      [USER_IDS[1]]: { [packIds[0]]: N, [packIds[1]]: N * 2, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [uid, expected] of Object.entries(expectedAfterAllMessages)) {
      const byPack = await getPacksByUser(uid);
      allErrors.push(...checkCounts(uid, expected, byPack, 'после всех сообщений'));
    }

    // 4. user1 читает все сообщения в D0 → у user1 в P0 и P1 по 0
    console.log('4. user1 mark read все сообщения в диалоге 0');
    for (const msgId of messageIds[0]) {
      await request('POST', `/api/users/${USER_IDS[0]}/dialogs/${dialogIds[0]}/messages/${msgId}/status/read`);
    }
    await new Promise((r) => setTimeout(r, 500));

    const expectedAfterU1ReadAllD0 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: N, [packIds[1]]: N * 2, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [uid, expected] of Object.entries(expectedAfterU1ReadAllD0)) {
      const byPack = await getPacksByUser(uid);
      allErrors.push(...checkCounts(uid, expected, byPack, 'после user1 прочитал все в D0'));
    }

    // 5. user2 читает все сообщения в D0 → у user2 P0=0, P1=N, P2=N
    console.log('5. user2 mark read все сообщения в диалоге 0');
    for (const msgId of messageIds[0]) {
      await request('POST', `/api/users/${USER_IDS[1]}/dialogs/${dialogIds[0]}/messages/${msgId}/status/read`);
    }
    await new Promise((r) => setTimeout(r, 500));

    const expectedAfterU2ReadAllD0 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: N, [packIds[2]]: N },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [uid, expected] of Object.entries(expectedAfterU2ReadAllD0)) {
      const byPack = await getPacksByUser(uid);
      allErrors.push(...checkCounts(uid, expected, byPack, 'после user2 прочитал все в D0'));
    }

    // 6. user2 читает все сообщения в D1 → у user2 P0=0, P1=0, P2=0
    console.log('6. user2 mark read все сообщения в диалоге 1');
    for (const msgId of messageIds[1]) {
      await request('POST', `/api/users/${USER_IDS[1]}/dialogs/${dialogIds[1]}/messages/${msgId}/status/read`);
    }
    await new Promise((r) => setTimeout(r, 500));

    const expectedAfterU2ReadAllD1 = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: 0, [packIds[2]]: 0 },
      [USER_IDS[2]]: { [packIds[1]]: N, [packIds[2]]: N }
    };
    for (const [uid, expected] of Object.entries(expectedAfterU2ReadAllD1)) {
      const byPack = await getPacksByUser(uid);
      allErrors.push(...checkCounts(uid, expected, byPack, 'после user2 прочитал все в D1'));
    }

    // 7. user3 читает все сообщения в D1 → у user3 в P1 и P2 по 0
    console.log('7. user3 mark read все сообщения в диалоге 1');
    for (const msgId of messageIds[1]) {
      await request('POST', `/api/users/${USER_IDS[2]}/dialogs/${dialogIds[1]}/messages/${msgId}/status/read`);
    }
    await new Promise((r) => setTimeout(r, 500));

    const expectedFinal = {
      [USER_IDS[0]]: { [packIds[0]]: 0, [packIds[1]]: 0 },
      [USER_IDS[1]]: { [packIds[0]]: 0, [packIds[1]]: 0, [packIds[2]]: 0 },
      [USER_IDS[2]]: { [packIds[1]]: 0, [packIds[2]]: 0 }
    };
    for (const [uid, expected] of Object.entries(expectedFinal)) {
      const byPack = await getPacksByUser(uid);
      allErrors.push(...checkCounts(uid, expected, byPack, 'финал'));
    }

    if (allErrors.length) {
      console.error('');
      allErrors.forEach((e) => console.error('  ', e));
      process.exit(1);
    }

    console.log('');
    console.log('OK: счётчики растут во всех паках с диалогом и уменьшаются при прочтении во всех паках.');
  } catch (err) {
    console.error('');
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

main();
