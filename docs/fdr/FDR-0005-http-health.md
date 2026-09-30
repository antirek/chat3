# FDR-0005: HTTP health — liveness `/health` и readiness `/ready`

- Status: draft
- Date: 2026-09-30
- Scope: mms3 / chat3
- Affects:
  - tenant-api `GET /health`, `GET /livez`, `GET /ready`, `GET /readyz`
  - controlo-backend те же пути
  - ApiJournal (skip проб)
  - OpenAPI обоих API
  - HEALTHCHECK локального `docker-compose.yml` и `amo-max-mms3`
- Related ADR: —
- Related issue: #16029
- Related: C-09 `architecture-docs/patterns/concepts/http-api-health.md`

## Context

C-09: liveness не пингует deps, потому что ошибка liveness рестартит контейнер. Readiness отвечает «можно ли слать трафик» и при отказе deps отдаёт 503, не убивая процесс.

Сейчас tenant-api `GET /health` смотрит флаг RabbitMQ и отвечает 200 или 503. Поле `services.mongodb` всегда `connected`. В теле есть url и user брокера и зашитая `version: "1.0.0"`. Локальный HEALTHCHECK считает здоровым только 200, то есть обрыв Rabbit рестартит API.

controlo-backend `GET /health` уже всегда 200 и deps не пингует, но маршрут объявлен после SPA `GET *` и держится на `next()`. В OpenAPI пути нет. В продовом compose `amo-max-mms3` HEALTHCHECK нет.

Задача #16029. Verify 2026-09-30: Ready, FDR нужен, ADR не нужен.

## Decision

### 1. Liveness

`GET /health` и `GET /livez` — один handler.

- Всегда **200**.
- Тело: `{ "status": "ok", "version": "<package.json>" }`. Регистр `ok`, как в текущем коде. Версия из корневого `package.json` chat3.
- Без ping Mongo и RabbitMQ. Без url, user, exchanges и списка бизнес-эндпоинтов.

### 2. Readiness

`GET /ready` и `GET /readyz` — один handler.

- tenant-api: `mongoose` ping с timeout 1s и флаг уже открытого соединения RabbitMQ (`isRabbitMQConnected`). Новое AMQP-соединение на каждый probe не открывать.
- controlo-backend: только Mongo. Этот процесс RabbitMQ не держит; поле `rabbitmq` в его `/ready` не отдаётся, иначе probe был бы всегда 503.
- Оба dep (или единственный Mongo у controlo) в порядке — **200** и `status: "ok"`. Иначе **503** и `status: "degraded"`. В обоих случаях блок `services` со значениями `connected` / `disconnected`.
- Compose `HEALTHCHECK` и `restart` на `/ready` не вешаются.

### 3. Журнал и OpenAPI

Пути `/health`, `/livez`, `/ready`, `/readyz` не пишутся в ApiJournal. В OpenAPI у всех четырёх `security: []`. Ключ API на них не требуется.

### 4. Порядок маршрутов и probe

В controlo-backend liveness и readiness регистрируются до SPA catch-all. Локальный HEALTHCHECK chat3 остаётся на `/health`. В `amo-max-mms3` HEALTHCHECK добавляется на контейнеры tenant-api (порт 3000) и controlo (порт 3001), тоже на `/health`.

### 5. Вне объёма

- `/startupz`, graceful SIGTERM и `@godaddy/terminus`.
- HTTP health воркеров и `user-grpc-server`.
- Prod-стеки MMS3 кроме `amo-max-mms3`.
- Смена тега образа и выкладка. HEALTHCHECK на проде начнёт проходить после образа, в котором `/health` уже liveness.

## Alternatives

| Вариант | Почему не выбран |
|---------|------------------|
| Оставить deps на `/health` | Обрыв Rabbit рестартит контейнер. Это запрещено C-09. |
| Только `/ready`, без `/readyz` и `/livez` | Текущий C-09 требует `/livez` рядом с `/health` и рекомендует `/readyz`. Алиасы не меняют имена из задачи. |
| Ping Rabbit с controlo | Соединения нет, `/ready` всегда 503. |
| Проверять Rabbit новым соединением на каждый `/ready` | Лишняя нагрузка на брокер. Достаточно флага рабочего соединения. |

## Consequences

- Монитор, который ждал 503 на `/health` при мёртвом Rabbit, перестаёт это видеть. Готовность deps — `GET /ready`.
- amax FDR-0013 бьёт controlo `/health` с ожиданием 200. Это совпадает с liveness. Отдельный amend не нужен.
- До выкладки нового образа HEALTHCHECK в `amo-max-mms3` будет смотреть старый `/health` (503 при обрыве Rabbit). Файл compose можно положить раньше образа; включать рестарт по этому probe на старом образе не стоит.
