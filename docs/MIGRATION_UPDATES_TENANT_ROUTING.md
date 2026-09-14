# Миграция: `tenantId` в routing key Updates

**Breaking change** для интеграторов, которые подписываются на exchange `chat3_updates` **напрямую через RabbitMQ**.

Ось изоляции пользователя в Chat3 — **`(tenantId, userId)`** (не глобальный `userId`). Routing key Updates приведён к той же оси.

## Кого это касается

| Способ интеграции | Нужно менять bind? |
|-------------------|--------------------|
| Прямая подписка AMQP к `chat3_updates` | **Да** |
| gRPC `SubscribeUpdates` (user-grpc-server) | Нет — bind уже внутри Chat3 |
| Только REST / unary gRPC без realtime | Нет |

Если приложение **не** обновят bind, после деплоя Chat3 с новым publish **сообщения перестанут приходить** (старый pattern больше не матчится).

## Было → стало

| | Формат |
|--|--------|
| **Publish (было)** | `update.{category}.{userType}.{userId}.{segment}` |
| **Publish (стало)** | `update.{category}.{tenantId}.{userType}.{userId}.{segment}` |
| **Bind personal (было)** | `update.*.{userType}.{userId}.*` |
| **Bind personal (стало)** | `update.*.{tenantId}.{userType}.{userId}.*` |
| **Bind firehose tenant** | `update.*.{tenantId}.*.*.*` |

Пример:

```
# было
update.dialog.user.carl.message
update.*.user.carl.*

# стало
update.dialog.tnt_acme.user.carl.message
update.*.tnt_acme.user.carl.*
```

В payload Update поле `tenantId` было и раньше; теперь оно ещё и в routing key.

## Что сделать в приложении

1. **Обновить bind** — вставить `tenantId` сразу после `category` / wildcard категории.
2. **Имя очереди** (рекомендуется): `user_{tenantId}_{userId}_updates` вместо `user_{userId}_updates`, чтобы не смешивать tenant на одной durable queue.
3. **Перебиндить** после деплоя Chat3: старые binding на exchange сами не обновятся — assert queue + `bindQueue` с новым pattern (при смене имени очереди — новая очередь; старую можно удалить, когда пуста).
4. **Coordinated deploy**: сначала (или одновременно) выкатить интегратор с новым bind, иначе будет окно без delivery. Если сначала только Chat3 — realtime у старых AMQP-клиентов молчит до обновления bind.

### Минимальный пример

```javascript
const tenantId = 'tnt_acme';
const userId = 'carl';
const userType = 'user';

const queueName = `user_${tenantId}_${userId}_updates`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 }
});

await channel.bindQueue(
  queueName,
  'chat3_updates',
  `update.*.${tenantId}.${userType}.${userId}.*`
);
```

## Проверка

1. Опубликовать / дождаться Update для известного `(tenantId, userId)`.
2. В RabbitMQ Management: у очереди binding = `update.*.{tenantId}.{userType}.{userId}.*`.
3. Убедиться, что сообщение с **другим** `tenantId` и тем же `userId` **не** попадает в очередь.

## См. также

- [UPDATES.md](./UPDATES.md) — формат Updates и routing keys
- [INTEGRATION.md](./INTEGRATION.md) — пошаговая подписка
- [CHANGELOG.md](../CHANGELOG.md) — Unreleased: AMQP updates tenant в routing key
