# FDR-0003: Controlo public base path (CONTROLO_PUBLIC_PATH) для path-gateway

- Status: draft
- Date: 2026-08-31
- Scope: mms3 / chat3
- Affects:
  - env-контракт `CONTROLO_PUBLIC_PATH` + согласованность с `CONTROL_APP_URL`
  - `packages-control/controlo-ui` — публичные пути ассетов и `index.html` (`/config.js`, `/assets/*`, favicon)
  - `packages-control/controlo-backend` — `GET /config.js`, Swagger `servers[0].url`
  - UI API-вызовы через `CHAT3_CONFIG.getControlApiUrl` / `getControlApiUrl`
  - деплой path-gateway (`mone-red-mms3` и будущие): удаление Caddy workaround на корне хоста
- Related ADR: —
- Related issue: #15601
- Related: #15518 (mone-red-mms3 deploy); mone `ADMIN_WEB_PUBLIC_PATH` (wiki: `architecture-docs/wiki/syntheses/mone-red-green-bx24.md`, `deployments/mone-red/docs/interfaces.md`)

## Context

Образ `antirek/mms3` (chat3) должен работать в **двух** схемах публикации controlo без отдельных сборок:

| Режим | Пример | Публичный entry |
|-------|--------|-----------------|
| **Classic FQDN** | `mone-mms3-control-app.cs.mobilon.ru` | корень хоста = приложение |
| **Path-gateway** | `mone-red-mms3.cs.mobilon.ru/control-app/` | Caddy `handle_path /control-app*` → backend :3001 |

На path-gateway (`mone-red-mms3`, #15518) браузер открывает `https://mone-red-mms3.cs.mobilon.ru/control-app/`, но UI запрашивает `/config.js`, `/assets/*` с **корня хоста** → 404 Caddy. Backend после `handle_path` видит пути **без** префикса `/control-app` (аналог admin-web за `ADMIN_WEB_PUBLIC_PATH=/admin`).

Задача #15601. Verify 2026-08-31 (Ready): цель, AC, среда, симптом и scope зафиксированы; открытые детали имени env и runtime/build — предмет этого FDR.

Прецедент в space: mone `ADMIN_WEB_PUBLIC_PATH` — клиентские URL с префиксом, backend без mount-префикса, Caddy strip. ADR не требуется: изменения внутри одного репо chat3 (controlo-ui + controlo-backend), без новых межсервисных контрактов.

## Decision

### 1. Имя и формат env

1. Вводится переменная **`CONTROLO_PUBLIC_PATH`** (не `MMS3_CONTROLO_PUBLIC_PATH`) — по аналогии с `ADMIN_WEB_PUBLIC_PATH` в mone: короткое имя в scope компонента controlo.
2. Формат: **leading slash, без trailing slash**; пустая строка `''` (или не задана) = classic FQDN (корень хоста).
   - Пример path-gateway: `CONTROLO_PUBLIC_PATH=/control-app`
   - Пример classic: `CONTROLO_PUBLIC_PATH=` (unset / `''`)
3. **`CONTROL_APP_URL`** остаётся полным публичным URL controlo **с path**, если приложение за gateway:
   - classic: `https://mone-mms3-control-app.cs.mobilon.ru`
   - path-gateway: `https://mone-red-mms3.cs.mobilon.ru/control-app`
4. Инвариант публичного URL для браузера:
   ```
   {origin}{publicPath}{resource}
   ```
   где `publicPath` = нормализованный `CONTROLO_PUBLIC_PATH` (`''` или `/control-app`), `resource` = `/config.js`, `/assets/…`, `/api/…` и т.д.

### 2. Разделение ролей env

| Переменная | Назначение |
|------------|------------|
| `CONTROLO_PUBLIC_PATH` | Префикс path для **браузерных** URL (HTML, статика, ссылки в config.js) |
| `CONTROL_APP_URL` | Полный публичный base URL controlo для `CHAT3_CONFIG.CONTROL_APP_URL` и `getControlApiUrl` |
| `TENANT_API_URL`, `RABBITMQ_MANAGEMENT_URL` | Без изменений; задаются отдельно в deploy (tenant-api может быть на другом path того же gateway) |

При path-gateway deploy **обязан** задавать согласованную пару: `CONTROLO_PUBLIC_PATH=/control-app` и `CONTROL_APP_URL=https://{gateway-host}/control-app`.

### 3. Backend (controlo-backend): без mount-префикса

5. Express-маршруты остаются на **`/`** (`/api/*`, `/config.js`, `/health`, `/api-docs`, static dist). **Не** вводить `app.use('/control-app', …)` — Caddy `handle_path` снимает префикс до контейнера.
6. `GET /config.js`:
   - `CONTROL_APP_URL` в ответе = публичный URL **с path** (из env `CONTROL_APP_URL`, приоритет; fallback — `{scheme}://{host}{CONTROLO_PUBLIC_PATH}` по заголовкам запроса).
   - `getControlApiUrl(path)` = `CONTROL_APP_URL + path` (path начинается с `/`).
7. Swagger UI (`/api-docs`): `servers[0].url` = публичный URL controlo **через gateway** (с path), не host-only. Использовать `CONTROL_APP_URL` или `{forwarded-proto}://{host}{CONTROLO_PUBLIC_PATH}`.

### 4. UI (controlo-ui): runtime public path, единый образ

8. Выбирается **runtime**-подход (не build-time `base` per deployment): один образ `antirek/mms3` для classic и path-gateway. Build-time Vite `base` **не** привязывается к конкретному deploy.
9. `CONTROLO_PUBLIC_PATH` читается при старте контейнера / serve и применяется к публичным ссылкам:
   - `index.html`: `<script src>`, `<link href>`, favicon — с префиксом `{CONTROLO_PUBLIC_PATH}` (пустой префикс допустим).
   - Собранные ассеты Vite (`/assets/*`) в браузере: `{CONTROLO_PUBLIC_PATH}/assets/…`.
10. Реализация в define/plan (допустимые варианты, один выбирается в коде):
    - относительный `base` в Vite (`./`) + runtime-подстановка путей в отдаваемый `index.html`;
    - или единая утилита `withPublicPath(path)` на сервере при отдаче HTML/static metadata.
    - **Запрещено** как основное решение: отдельные Docker-образы или CI-сборки с разным Vite `base` per environment.
11. Dev-сервер Vite (`vite.config.ts`): учитывать `CONTROLO_PUBLIC_PATH` для локальной проверки path-gateway (middleware / `base`), без поломки dev без env.

### 5. Клиентские API-вызовы

12. Все XHR/fetch controlo API идут через `getControlApiUrl` / `CHAT3_CONFIG.getControlApiUrl` — **не** hardcoded `/api/…` от корня хоста.
13. При корректном `CONTROL_APP_URL` (с path) дополнительный префикс в `getControlApiUrl` не нужен; `CONTROLO_PUBLIC_PATH` влияет на статику и начальную загрузку `config.js`, не дублирует path в API base.

### 6. Деплой path-gateway

14. После выката образа с поддержкой `CONTROLO_PUBLIC_PATH` в `mone-red-mms3-deploy` (и аналогах):
    - задать `CONTROLO_PUBLIC_PATH=/control-app` в env сервиса controlo;
    - **удалить** Caddy workaround, проксирующий `/config.js`, `/assets/*` с корня хоста (commit `9bda499` и подобные);
    - оставить только `handle_path /control-app*` → controlo backend.
15. Classic/green деплои (`mone-mms3`, `amone-mms3`, `amax-mms3`, …): `CONTROLO_PUBLIC_PATH` не задавать → поведение без регрессии.

### Acceptance (проверка успеха #15601)

- Classic FQDN (`mone-mms3-control-app.cs.mobilon.ru`): UI, API, Swagger — без регрессии.
- Path-gateway (`mone-red-mms3.cs.mobilon.ru/control-app/`): нет 404 на `/control-app/config.js`, `/control-app/assets/*`; `CHAT3_CONFIG.CONTROL_APP_URL` содержит `/control-app`.
- Swagger «Try it out» за gateway использует URL с path.
- Unit/smoke на нормализацию `CONTROLO_PUBLIC_PATH` и сборку публичных URL.
- Workaround на корне Caddy удалён после выката tag.

## Consequences

- Один образ mms3 покрывает classic FQDN и path-gateway; deploy задаёт только env.
- Операторы path-gateway: обязательны согласованные `CONTROLO_PUBLIC_PATH` и `CONTROL_APP_URL`; ошибка в паре → 404 или неверные API URL.
- Define/plan: изменения в `controlo-ui` (index.html, vite/serve), `controlo-backend` (`config.js`, swagger), shared util нормализации path, тесты, tag `antirek/mms3`, cleanup `mone-red-mms3-deploy`.
- Будущие path-gateway MMS3 (если появятся) переиспользуют тот же контракт.
- Агенты: не добавлять ADR-S; не ломать classic деплои; не оставлять root-workaround в Caddy после выката.

## Non-goals

- Отдельный FQDN controlo только для red (classic FQDN на других deployment остаётся).
- Caddy `handle /assets*` / `handle /config.js` на корне хоста как постоянное решение.
- Express mount `app.use('/control-app', router)` на backend.
- Build-time-only Vite `base=/control-app/` как единственный способ (ломает single-image).
- Изменение path-gateway tenant-api / rabbitmq (#15518) — вне scope.
- Новые границы репозиториев или API-контрактов (ADR не требуется).
- FDR-S (не кросс-репо контракт space).
