# REFACTOR.md — реестр архитектурных работ

> **Сейчас:** R8.8 — фундамент каталога черт (features.json, merge с ресурсами, пассивки-эффекты, `choices`) — сделан. Дальше: партии по классам (механики + уникальные иконки), либо Шаг 7 (R7.3 `mutate`/ack, client).
> **Проверки:** в цикле — `npm run check:quiet`; перед деплоем — полный `npm run verify` (обязателен).
> Ниже — карточки R6–R9; актуальная очередь — «Шаг N» в конце файла.

Источник: три параллельных аудита (сервер, клиент, shared/данные + тесты), сентябрь 2026; аудит после R5.
Формат: `R<серия>.<номер>` — «задача». Приоритет: **P1** (тормозит следующие фичи) / **P2** (заметно мешает) / **P3** (долг). Трудозатраты: S (~1–2 ч) / M (~полдня) / L (сессия).

Закрыто до этого реестра: **R2** (UI-примитивы: `Modal` + стек Esc, `Field`/`CheckboxRow`/`SizeRow`, общие блоки `TokenFieldsForm`, `AttacksForm` в листе, `SpellPicker`+`SpellTooltip`, `ChipRow`).

## P1-очередь (осталось)

| ID | Задача | Область | Трудо-затраты |
|----|--------|---------|---------------|
| R9.1 | jsdom + Testing Library для логики панелей/модалок | client/tests | M |

Закрытые P1: R8.1, R8.2, R6.1–R6.5, R6.8, R7.1, R7.2, R7.4 (из P2 — R6.6).

---

## R6 — Серверное ядро

- [x] **R6.1. `RoomManager` — god-объект.** P1, L.
  Исходно: `server/src/rooms.ts` (~90 методов, 1223 строки): жизненный цикл + персистенция + карты/библиотека + чат + токены + бой/ход + ресурсы/ячейки + спасброски + условия/эффекты/HP + `toState`. Хендлеры мутировали состояние напрямую (`socket/token.ts:54-124`, `socket/map.ts:39-92`, `socket/resources.ts:28-112`, `socket/context.ts:229`).
  **Сделано (4 среза):** `server/src/room/helpers.ts` — чистые `controllerIdOfToken/Item`, `hasResourceFor`, `roomUploadUrls`, `findTokenById`/`tokenById`/`locateToken`; `room/combat.ts` — инициатива/ход/экономика/производные статы/ростер боя/`ensureActiveTurn` (`CombatDeps`); `room/effects.ts` — состояния, эффекты, концентрация, спасброски, `changeMaxHp`, `adjustTokenHp`, down/dead (`EffectsDeps`); `room/resources.ts` — траты ресурсов/ячеек и зеркалирование листа (`ResourceDeps`); `room/tokens.ts` — карты, библиотека, токены, чат, владение (`TokenDeps`). `rooms.ts` 1223 → 414 строк: реестр/жизненный цикл, `toState`, репозиторий и тонкие делегаты; внешние реэкспорты (`controllerIdOfToken`, `roomUploadUrls`, …) сохранены, хендлеры не менялись. Тесты (100 server), smoke 130/0, e2e 81/0, shots — зелёные; новых тестов нет.

- [x] **R6.2. Персистенция «кто забыл `saveSoon` — потерял данные».** P1, M.
  Исходно: мутация и save — отдельные строки (`token.ts:54-56`, `map.ts:84-95`, `resources.ts:49-52`); часть мутаций вообще не сохраняется: `clearLocks` (`rooms.ts:297-303`), `beginTurn` (`rooms.ts:415-430`), `changeMaxHp` (`rooms.ts:769-785`), `syncSheetToTokens` (`rooms.ts:1108-1131`); бывают двойные save (`token.ts:120` + `rooms.ts:1104`). Механика: фабрика вызывается дважды (`store.ts:47-52`), общий `${target}.tmp` (`store.ts:41`), `saveNow` мёртв (`rooms.ts:1203`), shutdown гоняет 3 с таймаут (`index.ts:33-37`).
  **Сделано:** `RoomRepository`/`createRoomRepository` (`store.ts`): debounce, уникальный `${target}.${uuid}.tmp`, снимок вызывается только в момент записи, `remove` отменяет таймер + файл, `flush` — остановка. `RoomManager` принимает репозиторий в конструкторе (`init`/`deleteRoom`/`saveSoon` через него, `saveNow` удалён, `flushSaves` вместо глобального `flushRoomSaves`). Центральный авто-save: `socket/context.ts` сохраняет комнату в `finally` после каждого события и дисконнекта; 20 явных `manager.saveSoon(room)` из хендлеров удалены (в отложенном выходе `room.ts` явный save остаётся — он вне события).

- [x] **R6.3. Права/актор продублированы, guard-покрытие неровное.** P1, M.
  Исходно: ручной `isDm()` почти в каждом хендлере; `dmRoom()` 9 раз (`socket/combat.ts:11-112`); проверка контролёра заново в `socket/actions.ts:35-37`, `socket/dice.ts:53-54`, `socket/spells.ts:40-41`, `socket/reactions.ts:133-135,292-294`; `attackResolve.ts:316` — инверсия через `Object.values(room.controllers)`; `isDmViewer` скопирован (`context.ts:80-85` и `reactions.ts:104-108`); `skipControl` (`guards.ts:23,36`) мёртв. Заморозка реакций не покрывала `resources:*`, `sheet:update`, `library:*`, `token:add/update`.
  **Сделано:** `scopedToken` возвращает `{ room, mapId, token, isDm, character: { playerId, sheet } }` (мёртвый `skipControl` удалён); `actions.ts`/`dice.ts` больше не выводят контролёра и лист вручную. Заморозка добавлена в `resources:update/hitDie/rest/deathSave`, `sheet:update`, `library:add/update/remove`, `token:add/update` (для «тихих» — без сообщения в чат). Декларативная обёртка `withScope` не вводилась: резолвер + явные проверки остались, чтобы не менять 50 хендлеров разом; вернуться при следующем новом событии.

- [x] **R6.4. Резолв урона/HP продублирован, гейты расходятся.** P1, M.
  Исходно: четыре почти-копии «roll → защиты → `applyHp`»: `socket/attackResolve.ts:300-322`, `socket/spellResolve.ts:245-259,281-283,293-307`. Гейт «цель может получать урон» разный: `attackResolve.ts:316-317` (`Object.values(room.controllers).includes(...)`) vs `spellResolve.ts:305` (`target.id === caster.id`) — персонаж без `hpMax` получает оружейный урон, но не автоматический урон заклинания.
  **Сделано:** `server/src/socket/damage.ts` — единая `applyDamage` (защиты → половина → сообщение → HP) + `hasHpTracking` (свои max HP или ресурсы персонажа-контролёра); атака оружием и все три ветки заклинаний (`spellAttack`/`save`/`auto`) вызывают её. Поведение выровнено: урон заклинаний по персонажу с пустым `hpMax` теперь проходит, по токену без учёта HP — не проходит. Новых тестов нет (покрыто smoke `04-attacks`/`04b-spells`/`09-effects`; тесты не растут).

- [x] **R6.5. Движок реакций: глобальное состояние, одно окно, resume без try/catch.** P1, L.
  Исходно: `pendings`/`roomPending`/`offerIndex`/`pendingContext` — модульные и по код-комнате (`socket/reactions.ts:72-76`); второй триггер молча теряется (`openReactionWindow` → false, `:450`), при этом атака сразу наносит урон; resume — замыкание над внешним `holder` (`attackResolve.ts:920-936`), вызывается из таймаута (`reactions.ts:499-520`) вне try/catch `ctx.on`: исключение = `uncaughtException` (`index.ts:30`).
  **Сделано:**
  - Срез 1: `class ReactionQueue` — инстанс на комнату (`pending`, `offerIndex`, `ctx` внутри; реестр `queues` с поиском по pending/offer и автоочисткой простаивающих), `open`/`lookup`/`offers`/`skipPlayer`/`finish`; хендлеры, таймаут и дисконнект — через инстанс, `isReactionPending`/`pendingOffers` — фасад; резолв обёрнут в try/catch.
  - Срез 2: очередь окон вместо дропа — при занятой паузе `open` кладёт запрос в `waiting` (кап 16) и возвращает `true` (вызывающий ждёт resume); после закрытия окна `startNext` открывает следующее **до** resume (заморозка не прерывается, новые триггеры из resume встают следом), с перепроверкой оплаты (`revalidate`/`optionPayable`: слот реакции свободен, ячейка/ресурс доступны; пустые офферы пропускаются с немедленным `resume([])`).
  - Тест `handlers.test.ts` (+1, essential): второй триггер ждёт и открывается после первого.
  **Не делали:** реестр `onTrigger(kind, resolver)`/типизированный `TriggerEvent` — расширение триггеров по-прежнему через вызовы `openReactionWindow`; вернуться при первом новом триггере (Sentinel/Ready).
  **Зачем:** новый триггер («при попадании заклинанием», «враг подошёл на 30 фт») не должен искать 3 call-site; одновременные триггеры сейчас теряются.

- [x] **R6.6. Рассылка токенов скопирована 5 раз; `visibleToken` сканирует всё.** P2, S/M.
  Исходно: цикл «найти сокет игрока и отправить»: `socket/context.ts:118-132,164-177,178-188,189-196`, `reactions.ts:110-115` (с неизбежными кастами). `visibleToken` ищет mapId через `manager.locateToken` (`context.ts:159`) — O(карты×токены) на каждый токен каждому игроку.
  **Сделано:** `isDmViewer` экспортируется из `context.ts` (убран дубль в `reactions.ts`); `ctx.emitTo(room, playerId, event, …)` (типизированный) — единственный путь отправки конкретному игроку; `broadcastMaps`/`broadcastLibrary`/`emitToken`/`emitResources` и окна реакций (`reaction:offer`/`close`) используют его. `visibleToken(room, token, viewerId, mapId?)` принимает mapId, все вызовы передают его — `locateToken` больше не на горячем пути. Фикстура `handlers.test.ts` дополнена `emitTo` (тесты не добавлялись).

- [x] **R6.7. Типовые швы: `Room` vs `RoomState`, мутационная гидратация, слабая валидация.** P2, M/L.
  Исходно: `Room` (`roomTypes.ts:7-20`) и `RoomState` (`shared/src/types.ts:1124-1134`) описывают комнату по-разному; `toPersistedRoom` копирует живые ссылки (`roomTypes.ts:35-48`); `roomNormalize.ts:23-46` — 138 строк мутаций с `as unknown as`; `noUncheckedIndexedAccess` выключен (`tsconfig.base.json:6`) — `room.controllers[playerId]` типизирован `string`, но может быть `undefined` (`rooms.ts:257,265`); payload-ы проверяются `typeof` вручную (`socket/token.ts:15-24`, `socket/map.ts:9-16`).
  **Что сделать:** нормализаторы на уровне сущностей (Token/Map/Room) + сборка `Room` через них; наружу только `RoomState`; включить `noUncheckedIndexedAccess`; общие `isRecord`/декодеры payload.
  **Срез 1 (сделано):** `shared/src/normalize.ts` — `isRecord`, `normalizeToken`, `normalizeLibraryItem` (legacy `url`→`imageUrl`), `normalizeMapInfo` (токены/туман/бой), `normalizeScene`; неизвестные поля сохраняются. `server/src/roomNormalize.ts` — legacy-сцена и top-level combat остаются на сервере, `hydrateRoom` больше не мутирует вход и собирает `Room` через общие нормализаторы. `isRecord` вместо ручных `typeof === 'object'` в гвардах `socket/token|map|combat|resources|sheet|spells`. Тесты: `shared/normalize.test.ts` (+7), `roomNormalize` +1 (вход не мутируется), 270+104+48; smoke 130/0.
  **Срез 2 (сделано):** `noUncheckedIndexedAccess` включён в `shared/tsconfig.json` — 74 ошибки закрыты (20 в исходниках: `dice`/`movement`/`classes`/`spellCast`/`spells`/`types`, остальные в тестах); поведение не менялось. Server/client пока без флага, включать поэтапно.
  **Срез 3 (сделано):** `noUncheckedIndexedAccess` включён в `server/tsconfig.json` — закрыто ~336 ошибок (19 в исходниках: `room/combat`, `roomNormalize`, `socket/reactions|resources|spellResolve`, остальные в трёх тест-файлах); поведение не менялось (проверено smoke 130/0). Client пока без флага.
  **Срез 4 (сделано):** `noUncheckedIndexedAccess` включён в `client` (~82 ошибки: 26 в исходниках `TableTop`/`ThreeD20`/`RollMenu`/`ChatPanel`/`CharacterSheetModal`/`domain/scene`/`lib/id`, остальные в тестах), затем флаг перенесён в `tsconfig.base.json`, локальные переопределения убраны. `check` + `build` зелёные; поведение не менялось.
  **Срез 5 (сделано):** 5а — `toPersistedRoom` — `structuredClone` (настоящий снапшот; тест «мутации комнаты не меняют снимок»); 5б — `Room extends Omit<RoomState,'players'>`, рантайм-поля (`sheets`/`resources`/`nextZ`) вынесены наверх, `toState` собирается через rest (новое поле `RoomState` уезжает клиенту без правки маппинга, явно маппятся только `players`; тест на отсечение `sheets`/`resources`/`nextZ`/`socketId`); 5в — `server/src/socket/decode.ts` (`asString`/`asTrimmedString`/`asBool`) + перевод `admin`/`room`/`map` (закрыты дыры `name.trim()`/`code.toUpperCase()`/невалидный `clientId`; битый payload — тихий выход или ответ ошибкой, без исключений); тесты `decode.test.ts` (+3). `check` 270+110+48, smoke 130/0.
  **Осталось (необязательно):** перевести остальные домены (`combat`/`actions`/`spells`/`token`) с ручных `typeof` на `decode.ts` — по мере правок, поведение уже безопасно.
  **Зачем:** новое поле Token/Scene = гидратация + фикстуры + маппинг `PersistedRoom` + обе формы комнаты.

- [x] **R6.8. Обработка ошибок непоследовательна.** P2, S/M.
  Исходно: битые payload молча игнорируются (`token.ts:21-24,39`, `spells.ts:37`, `map.ts:16`) или присылаются русской строкой в `chat:error` (`actions.ts:46-94`, `spells.ts:48-156`); `DiceParseError` маппится только в `dice:roll` (`attackResolve.ts:250`, `spellResolve.ts:323` — generic); у `finishPending→resume` нет catch.
  **Сделано:** `server/src/socket/errors.ts` — типизированный каталог `ErrorCode` (16 кодов) с рендером текста (`errorText`, параметры `feet`/`name`) и единый `fail(ctx, code, params)`; все handler-сообщения переведены (`guards`, `actions`, `dice`, `spells`, `token`, `attackResolve`) — тексты сохранены дословно (smoke/handlers-тесты зелёные). `pending.resume` в `finishPending` обёрнут в try/catch (таймаут/DM-скип вне try/catch сокет-хендлера). Пока не трогали: строки-возвраты резолверов (`result.error`, `validateSpellCast`) и формат `chat:error` — перевод на коды на клиенте отдельным шагом, чтобы не менять протокол.

- [x] **R6.9. Серверный тест-каркас: ручной фейк `ConnCtx`, глобальные реакции.** P2, M.
  Исходно: `makeCtx` вручную реализует ~30 членов `ConnCtx` с `as unknown as` (`handlers.test.ts:44-101`); добавление метода в `ConnCtx` не ломает компиляцию, а падает в рантайме на одном пути; `visibleToken` возвращает сырой токен, `applyHp` — копия `context.ts:200-208`; состояние реакций модульное, тесты на комнате `'TEST'` (`fixtures.ts:52`) — протечка отравляет соседние тесты; поведенческие сценарии доступны только в smoke.
  **Сделано:** `server/src/test/ctx.ts` — `makeConnCtx(room, { playerId, dm, all, overrides })` поверх **реального `createCtx`**: подменяется только socket.io-транспорт (in-memory fake сокеты, запись в `emitted`, `invoke`/`selfEvents`/`disconnect`/`advance`), поэтому `applyHp`/`visibleToken`/`emitResources`/`broadcast*` — прод-код. `registerSocket` распилен: экспорт `registerHandlers(ctx)` (используют и прод, и кит с `all: true`). `handlers.test.ts`: локальный фейк (92 строки, ~30 `as unknown as`) удалён, 46 тестов перешли на кит без правок логики (3 ассерта `system` → `room.chat`); `integration.test.ts` (+2): полное соединение `room:create → map:add → library:add → token:add` и `disconnect` c fake timers (`LEAVE_GRACE_MS` → `isConnected=false` + системное сообщение). Fake-сокет хранит несколько обработчиков на событие (как socket.io). `check` 270+112+48, smoke 130/0.

---

## R7 — Клиентское ядро и UI-долг

- [x] **R7.1. Машина выбора цели размазана по 7 файлам.** P1, M/L.
  Исходно: три независимых состояния с ручным взаимным занулением: `AimState`/`MultiTargetState`/`TargetingState` (`store/types.ts:42-89`), переходы `store/slices/actions.ts:32,67-71,126`, `uiReset.ts:4-12`; клики: `TableTop.tsx:270-282`, `TokenView.tsx:59-81`, `TableScreen.tsx:42-58`, `AimPanel.tsx:20-61`, `SpellPopover.tsx:76-114`, `RollMenu.tsx:86-99`; drag/camera переключался в `TableTop.tsx:322,337`, `TokenView.tsx:91-99`.
  **Сделано:** `domain/interaction.ts` — чистые типы (`Interaction` union из target/aim/multi) и переходы (`startTargeting`/`startAim`/`aimToCursor`/`confirmArea`/`pickTarget`/`pickMultiTarget`), возвращающие «новое состояние + команда»; стор хранит одно поле `interaction`, экшены слотов делегируют машине, добавлен `cancelInteraction`. `AimPanel` рендерит все три режима из union, `TokenView`/`TableTop`/`TableScreen` выводят режим из одного поля (нельзя включить два сразу), Esc/клик по пустому месту — единый сброс. Тесты слайсов обновлены под `interaction` (число тестов не выросло); e2e/shots зелёные.

- [x] **R7.2. `ActionPanel` — god-компонент, правила дублированы со `SpellPopover`.** P1, M.
  Исходно: `ActionPanel.tsx` (445 строк): экономика (`:160-222`), атаки (`:178-182`), категории/каст (`:235-261`), рендер (`:303-371`). Те же правила в `SpellPopover.tsx`: `COST_TEXT` (`:28-33`) vs `spellSlotOf`, `maxCastableLevel` (`:52-54`) vs `ActionPanel.tsx:253-255`, выбор режима (`:76-114`) vs `ActionPanel.fire:190-197`/`featureButton:279-301`. `spellByKey` строился заново в `ActionPanel`, `TokenMenu:42`, `ReactionPrompt:33`, `StatblockSpells:24`, `ConditionsOverlay:16`.
  **Сделано:** `lib/actionRules.ts` — чистые `spellSlotOf`, `ACTION_COST_TEXT`, `maxCastableForSpell`, `canSpendSlot`, `canUseFeature`, `featureSlot`, `spellCastInfo`; `lib/useActionContext.ts` — хук-модель панели (токен/ход/экономика/оружие/черты/заклинания) с мемоизацией; `useSpellByKey()` — общая карта заклинаний (`TokenMenu`/`ReactionPrompt`/`ConditionsOverlay`/`ActionPanel`). `ActionPanel` 435 → 308 строк (только рендер + вызовы правил), `SpellPopover` 228 → 179 (использует `spellCastInfo` и `ACTION_COST_TEXT`). Тесты `lib/actionRules.test.ts` (+5): секции, круги, режимы, экономика.

- [ ] **R7.3. Оптимистичные апдейты без единого идиома и отката.** P1, M/L.
  Локальные патчи: `store/slices/tokens.ts:76-90,126-140`, `library.ts:12-21`, `maps.ts:51-67`, `sheet.ts:17-20`; fire-and-forget: `actions.ts:24-30`, `combat.ts:9-29`, `sheet.ts:13-15`; подтверждение иногда игнорируется (`tokens.ts:56-57` — серверный `token:update` дропается во время драга). Единственный канал ошибки — чат (`chat.ts:23-28`): отказ молча расходится со стейтом.
  **Что сделать:** `mutate(event, { optimistic, rollbackOn })` с pending-id и общим `*:error`/ack; внедрять послайсово.
  **Зачем:** каждая новая мутация сейчас заново решает «оптимистично или нет» и изобретает откат.

- [x] **R7.4. Ленивая загрузка `spellIcons` + единый загрузчик данных.** P1, S/M.
  Исходно: `SpellIcon.tsx:3-4` статически импортил `SPELL_ICONS` (`spellIcons.tsx`, 4177 строк, ~300 КБ) — иконки всех 420 заклинаний в главном чанке (599 КБ `index-*.js` в dist), хотя данные ленивые (388 КБ `spellsData`). Загрузку дублировали `ActionPanel.tsx:70-78`, `SpellsPanel.tsx:133-141`, `useSpells.ts:6-18`.
  **Сделано:** `client/src/lib/spellIcons.ts` — `loadSpellIcons()` (ленивый динамический импорт + кэш на сессию) и `spellIconsSync()` для первого рендера; `SpellIcon` подгружает карту после монтирования, до этого рисует штриховой глиф. `useSpells()` теперь возвращает `Spell[] | null` (null — загрузка) и используется всеми: локальные загрузчики в `ActionPanel`/`SpellsPanel` удалены, `ConditionsOverlay`/`ReactionPrompt`/`StatblockSpells`/`TokenMenu` адаптированы. `index-*.js` 599 → **260 КБ**, иконки — отдельный чанк 340 КБ (50 КБ gzip). Тест `lib/spellIcons.test.ts` (+1): кэш и повторный вызов. e2e/shots зелёные.

- [ ] **R7.5. `TableTop` смешивает Konva-ввод, туман, камеру и рендер.** P2, M.
  Геометрия кисти тумана: `TableTop.tsx:133-140,142-182,184-191`, mouse-хендлеры `:219-268`, `rectPreview`; камера `:198-217`; drop `:284-317`; линейка `:111-118,451-472`; оверлеи `:64-109,384-449`. Фильтр токенов для тумана дублирует логику `ConditionsOverlay.tsx:18-29`.
  **Что сделать:** `useFogBrush(map)` + чистый `lib/fog.ts`, `useMapCamera()`, `useTokenDrop()`, оверлеи отдельными компонентами; общий `visibleCell`.
  **Зачем:** новый оверлей/инструмент сейчас впечатывается в 454-строчный файл; правила тумана не тестируются.

- [ ] **R7.6. Проверки прав/владения вне `lib/control.ts`.** P2, S.
  `lib/control.ts:25-34` (`canControlWith`) есть, но контроль выводится заново: `ActionPanel.tsx:113-114`, `SpellPopover.tsx:51`, `TokenMenu.tsx:104-107`, `InitiativeBar.tsx:21-29`, `TableTop.tsx:54-62`; `useIsDm()` (тест-режим) vs сырой `s.role === 'dm'` (`Toolbar.tsx:42`) без фиксации намерения.
  **Что сделать:** `useCanControlToken(id)`, `useIsRealDm()`, `selectIsCharacter`; документировать разницу тест-режим/реальный DM в хелпере.

- [ ] **R7.7. Грубые селекторы → перерисовки/пересчёты.** P2, M.
  `ResourcesPanel.tsx:103,116-127` подписан на `scene.maps` и сканирует всё ради концентрации; `TableTop.tsx:64-84` пересчитывает `reachableCells` на любой апдейт сцены (включая каждый кадр драга); `fogRects` (`:133-140`) и фильтр токенов (`:445-449`) тоже; `RollMenu.tsx:47-64` пересчитывает `sources` и всегда смонтирован (`ChatPanel.tsx:214`); `memo` в `TokenView.tsx:187` не работает из-за смены identity токена; `fitView` через `setTimeout` (`maps.ts:19,24`).
  **Что сделать:** селекторы по entity (map by id), `useShallow`/мемоизация производных, `fitView` в `useEffect` по mapId+viewport, концентрация через `characterTokenOf`.

- [ ] **R7.8. У socket-bridge нет teardown.** P3, S.
  `net/bridge.ts:44-54`: `setInterval` heartbeat и `onAny` на каждый `attachSocketBridge` без dispose; `slices/room.ts:10-15` защищается только от второго сокета — ре-инит/HMR копит слушатели.
  **Что сделать:** возвращать `dispose()` и хранить в слайсе.

- [ ] **R7.9. CSS: плоский неймспейс, хардкод-палитра, разрозненные z-index, связь с e2e.** P3, S/M.
  ~3700 строк, без токенов: `#1c2026` 25× в 8 файлах, `#2b3039` 17×, `#ffd166` 16×; 26 значений z-index без шкалы (`panels.css:13`=12 … `base.css:123`=1000); e2e ищет по классам (`05-sheet-rolls.mjs:7,30,83`, `07-player-fog.mjs:69-72`) — переименование класса ломает CI.
  **Что сделать:** CSS custom properties для палитры + документированная `--z-*` шкала; `data-testid` на e2e-критичных узлах, миграция селекторов.

- [ ] **R7.10. Черновики форм дублируют инвентарь полей.** P2, M (частично закрыто R2).
  `TokenMenu.tsx:57-83` и `TokenPanel.tsx:36-55` вручную копируют 13 полей; `CharacterSheetModal.tsx:34-45` — правила листа в компоненте; сброс черновиков держится на `eslint-disable` deps.
  **Что сделать:** `useDraft(open, value, toDraft, fromDraft)` + один `tokenFieldsFrom(token)`; поля — из реестра R8.2.

---

## R8 — Shared: контракт и данные

- [x] **R8.1. Автоматизация заклинаний/черт — bespoke-ветки, а не каталог.** P1, L.
  Data-driven только `SPELL_EFFECTS` (20 ключей, `shared/src/rules/spellEffects.ts:32-232`); дальше 5 хардкод-веток (`server/src/socket/spellResolve.ts:197-316`); Counterspell/Absorb захардкожены (`reactions.ts:236-259,693`); `acBonusOf` реверс-инжинирит эффекты (`reactions.ts:197-206`); геометрия выхода из reach — в socket-слое (`reactions.ts:599-608`), хотя есть `shared/rules/movement.ts`; `validateSpellCast` прогоняется дважды (`spells.ts:129` + `spellResolve.ts:186`). Из 229 manual-заклинаний не покрыто 214, при этом 103 уже имеют `save`/`conditions`/`areaSpec` (Charm Person, Sleep). `FEATURE_META` даёт 118 кнопок без реализации (`classActions.ts:43-187` + стаб `socket/actions.ts:104-149`).
  **Что сделать:** единая схема `AutomationDef` + generic-executor на сервере, данные — строки; классовые фичи — та же схема; явный `automation: 'manual'` как fallback; counterspell-параметры и reach-геометрия в shared; catalog-level тесты.
  **Согласованная форма (отличается от исходной):** `resolution` (`attack`/`save`/`auto`/`effect`/`utility`/`manual`) — способ разрешения, payload-поля (`save`/`damage`/`heal`/`effects`) ортогональны и комбинируются (Wall of Fire = урон + зона). `ZoneDef` — per-trigger (`enter`/`exit`/`startOfTurn`/`endOfTurn`) + `aura`/`containment`/`anchor`/`flags`; `SummonDef` зарезервирован. Строка каталога появляется только вместе с движком, который её обслуживает, иначе спелл — `manual`. Порядок движков после R8.1: restrictions → зоны → призывы.
  **Срез 1 (сделано):** `domain/automation.ts` — типы (`AutomationDef`, `AutomationEffect` c `escalate`/`wakeOnDamage`/`misdirect`, `AutomationPayload`, `ZoneDef`, `SummonDef`, `AutomationUtility`); `rules/automation.ts` — каталог `AUTOMATION_SPELLS` (20 записей, перенос `SPELL_EFFECTS`) + `automationForSpell` (каталог → деривация атака/спасбросок/автоурон/лечение → `manual`; уровни применяются к `dice`/`count`) + `spellEffectDefs`/`spellAutomated`; `spellEffects.ts` удалён, шима не оставлено. Поведение не менялось. Тесты `automation.test.ts` (+7, essential) и обновлён `data.deploy.test.ts` (каталог, key-инварианты, условия). `check` 277+112+48, `test:deploy` 6+2.
  **Срез 2 (сделано):** `server/src/socket/automation.ts` — generic-executor `executeAutomation` (порт 5 веток + `applyDefEffects`); `spellResolve.ts` 318 → 91 строки (`validateSpellCast`/`resolveSpellCast` на def, без веток по заклинаниям); двойной `validateSpellCast` убран (валидация — в `spells.ts` до списания, реакции валидируют у себя до списания); `applyReactionChoice` ходит одним `resolveSpellCast` (эффектные реакции — через executor). Поведение не менялось. `check` 278+112+48, smoke 130/0.
  **Срез 3 (сделано, контент-партия 1):** движок: `EffectInstance.escalate`/`wakeOnDamage` (+`EffectEscalation` в domain), `tickEffects` — эскалация состояния при провале повторного спаса (событие в чат), `adjustTokenHp` — урон снимает эффекты с `wakeOnDamage`; `endOfTurn/of:'source'` с чужих токенов снимается только в начале хода источника (было и в конце — эффект на чужих не доживал до следующего хода). Каталог (+4): Color Spray, Hold Monster, Hypnotic Pattern, Sleep (спас → механически действующее состояние; Sleep — `escalate` в без сознания). `check` 279+114+48 (юниты на escalate/wake), smoke 130/0.
  **Принцип владельца (решение):** ложная автоматизация не допускается — Charm Person/Charm Monster/Animal Friendship/Suggestion возвращены в `manual`: `charmed` в движке не имеет авто-эффектов (нет запрета атак по очаровавшему, соц-преимущества, исполнения внушения). Закреплено deploy-инвариантом «состояния каталога механически действуют». Вернуться к ним вместе с механикой charmed/отношений.
  **Срез 4 (сделано, классовые действия):** `rules/automationActions.ts` — каталог `AUTOMATION_ACTIONS` (ключ — `ActionDef.id`): базовые `dash`/`disengage`/`hide`/`search` + `class:fighter:actionSurge`/`class:fighter:secondWind`; `automationForAction` со скейлом `classLevelBonus` (Second Wind `1d10+уровень`). Executor получил `utility`-ветку (extraAction/extraMovement/disengage/check); `action:use` списавшие экономику/ресурсы автоматизированные действия гонит через `executeAutomation` (self-таргетинг из `def.targeting`), остальные — заглушка. Поведение мигрированных действий сохранено (новый handlers-тест на Second Wind). `check` 282+115+48, smoke 130/0. Остальные 100+ черт — контент-партии (нужны движки restrictions/зон; по спорной механике — спрашивать владельца).
  **Срез 5 (сделано, реакции + R8.7):** параметры Counterspell → shared (`COUNTERSPELL`), геометрия выхода из reach → `shared/rules/movement.ts` (`pathLeavesReach`), `acBonusOf`/`applyReactionChoice` уже через def (срез 2). Dodge полностью переведён на эффект — см. R8.7. `check` 282+115+48, smoke 130/0.
  **После срезов — движок restrictions (сделано):** `Restrictions` + `restrictionsFor` (условия → запреты действий/бонусов/реакций, эффекты — точечно); проверки в `spendSlot` (noActions/noBonus/noReactions/actionOrBonusOnly), `canAttack`/`consumeAttack` (oneAttackOnly), `reactionSlotFree` и OA (noOpportunityAttacks), `spells.ts` (spellFailureChance для соматики); `rejectIfIncapacitated` обобщён до restrictions. Возможность «эффекты на попадании» в executor (`applyEffectTo`). Каталог: **Shocking Grasp** (деривация + `AUTOMATION_ADDITIONS`: запрет OA до начала следующего хода) и **Slow** (спас, −2 AC/DEX-спасы, ×0.5 скорость, noReactions/actionOrBonusOnly/oneAttackOnly/25% соматика). `check` 286+118+48, smoke 130/0. Не сделано: кап «до 6 существ» у Slow (область берёт всех) и клиентское дизейблирование по ограничениям (сервер отклоняет).
  **Зачем:** следующая большая фича (каталог классовых действий и остаток Ф8) без этого — сотни строк ручных веток и правки в 4–6 файлах на заклинание.

- [x] **R8.2. Добавление поля Token/Sheet — чек-лист из 6+ мест.** P1, M.
  Исходно: `damageDefenses` встречается в ~20 файлах; путь нового поля: тип (`shared/src/types.ts:62-78`) → полный и patch-нормализаторы (`:706-759`) → два ручных цикла гидратации (`server/src/roomNormalize.ts:54-82,89-107`) → два redact-whitelist (`socket/context.ts:155-168`; `attacks` там уже забыт) → фикстуры (`server/src/test/fixtures.ts:13-48`, `client/src/test/fixtures.ts:13-48`) → формы.
  **Сделано:** реестр `shared/src/fields.ts` (`TOKEN_FIELD_SPECS`): полная нормализация, patch и заглушки redact в одной записи на поле; `normalizeTokenFields`/`normalizeTokenFieldsPatch` и `redactToken`/`redactLibraryItem` считаются из реестра; `server/src/roomNormalize.ts` и `server/src/socket/context.ts` используют их (опция `keepAcHp` сохраняет непарные AC/HP старых данных). Тесты `shared/src/fields.test.ts` (+11): coverage реестра, patch, `keepAcHp`, redact и отсутствие мутаций. Новое поле = запись в `TokenFields` + строка в реестре (типы не дадут пропустить).
  **Что сделать:** таблица-дескриптор полей (coerce/validate), общая для `normalizeTokenFields`, `normalizeTokenFieldsPatch`, `roomNormalize` и redact; один `redactToken/redactLibrary`; round-trip тест «каждый ключ `TokenFields` нормализуется и редактируется».
  **Зачем:** следующая фича сразу добавляет поля (`CharacterSheet.choices`); сейчас это правки в 6+ местах с риском утечки статов.

- [x] **R8.3. Сгенерированные данные не валидируются, парсятся регексами по тексту.** P2, S/M.
  Исходно: три `as unknown as` (`shared/src/spellsData.ts:11`, `rules/spellLimits.ts:20`, `rules/subclassSpells.ts:27`); ни один тест не импортирует `data/*.json`; вывод зависит от английской прозы: `deriveAreaSpec` (`rules/spells.ts:291-308`), апкаст (`rules/spellCast.ts:41-66`), число атак (`:133-157`); `scripts/build-spells.ts:13` тянет из GitHub в билде и пишет `JSON.stringify` (`:208`).
  **Сделано:** снимок заморожен (перегенерации нет), поэтому вместо проверки схемы 5e.tools — deploy-«замок». Введён бакет `*.deploy.test.ts` (`vitest.deploy.config.ts` в каждом workspace, `passWithNoTests`, `npm run test:deploy`, первым шагом в `verify`; из `check`/`verify:server` исключён). `shared/src/rules/data.deploy.test.ts` (+6): SHA-256 (16 hex) по `JSON.stringify` для `spells.json`/`spellcasting.json`/`subclassSpells.json` (любая осознанная правка = обновить константу); контракт записей (ключи/источники/круги/школы/automation/кости/спасы/areaSpec/`ConditionKey`/классы/описания); сверка каталогов (`SPELL_EFFECTS`, `REACTION_SPELL_TRIGGERS`, `ABSORB_SPELL_TYPES` — новый `Record` в `reactions.ts`, `subclassSpells.json`); контракт `spellcasting.json` (массивы 20, неубывание); свип `spellDamageExpression`/`spellAttackCount` по всем 420. `client/src/components/spellIcons.deploy.test.ts` (+2): каждое заклинание имеет иконку и нет иконок без заклинаний. `npm run spells` уже логирует распределения — закрыто ранее.
  **Не делали:** рантайм-валидаторы вместо трёх `as unknown as` (тест гарантирует форму снимка); `deriveAreaSpec` в свипе (работает на сыром тексте до нормализации — покрыт hash + инвариантами `areaSpec`).
  **Зачем:** случайная правка 388 КБ данных или каталога падает на деплой-гейте, а не всплывает багом в бою.

- [x] **R8.4. `types.ts` — свалка на 1294 строки.** P2, M.
  Исходно: сущности (`:62-108`, `:347-365`, `:517-533`), 13 нормализаторов (`:575-1030`), RU-таблицы (`:397-433,1032-1060`), socket-контракт (`:1136-1293`) в одном файле; `CharacterSheet.abilities`/`TokenStatblock.abilities`/`DEFAULT_ABILITIES` — три пути; `RoomState`/`Room`/`PersistedRoom` — три формы комнаты.
  **Срез 1 (сделано):** `types.ts` 1239 строк → 13 (тонкая реэкспорт-шима). Новые модули: `domain/{core,damage,effects,actions,token,sheet,combat,scene,chat,room}.ts`, `labels.ts` (`DAMAGE_TYPES`/`damageTypeName`/`DEFENSE_TYPE_NAMES`/`ABILITIES`/`SKILLS`), `socket/contract.ts`, `normalize/{guards,attacks,sheet,effects,actions,combat,token,scene,index}.ts` (+ приватный `normalize/internal.ts` — общие хелперы `newId`/`clampInt`/`isAbilityKey`/`SPELL_KEY_RE` без расширения публичного API). `fields.ts` переведён на канонические импорты (цикл fields↔normalize), `index.ts` — явные реэкспорты, старый `normalize.ts` удалён. Публичный API `shared` не изменился (189 runtime-экспортов до/после, 97 деклараций на месте).
  **Срез 3 (сделано):** 26 файлов shared переведены с `./types`/`../types` на канонические модули, шима `types.ts` удалена (0 ссылок). `check` 270+110+48, `test:deploy` 6+2, `build` (index 260.6 КБ — как было), smoke 130/0.
  **Зачем:** любой импорт тянет всё; несвязанные правки конфликтуют в одном файле.

- [x] **R8.5. Идентичность каталогов привязана к источнику; состояния дублированы.** P3, S/M.
  Исходно: ключи `'XPHB:Shield'`/`'XGE:Absorb Elements'` (`rules/spellEffects.ts:32`, `rules/reactions.ts:8-12`); `Spell.conditions` хранит английские имена (`rules/spells.test.ts:171`), `conditionKeyOf` (`rules/conditions.ts:63`) к данным не применяется; вторая RU-карта — `client/src/lib/spellText.ts:32-48`; `SpellAutomation.'unsupported'` не возвращается никем (`rules/spells.ts:18,319`).
  **Сделано:** `Spell.conditions` → `ConditionKey[]` (`normalizeSpell` через `conditionKeyOf`; разовая миграция `spells.json` — все 15 значений мапятся 1:1); клиентская карта `CONDITION_RU` удалена, текст — из `conditionName`; `SpellAutomation.'unsupported'` удалён из union. `check` 270+110+48, `build`, smoke 130/0.
  **Отменено сознательно:** ключи каталогов по нормализованному имени + приоритету источника. `spells.json` — замороженный разовый снимок (перегенерации нет), `Spell.key` стабилен, так что ref-слой дал бы только косметику. Каталоги (`SPELL_EFFECTS`/`REACTION_SPELL_TRIGGERS`) остаются ключёванными по `Spell.key`; R8.1 ключуется так же.

- [ ] **R8.6. Метки бросков хранят готовый RU-текст, клиент парсит его для стилей.** P2, S/M.
  `server/src/socket/messages.ts:29-31` всегда пишет legacy `label`; `client/src/components/ChatPanel.tsx:57-68` классифицирует по `label.startsWith('Атака'/'Урон'/...)`; `dice.ts:22` ограничивает клиентские kind'ы.
  **Что сделать:** новые сообщения без `label` (чтение legacy оставить), стили — из `rollKind`, форматтер с локалью.
  **Зачем:** локализация сейчас заблокирована сохранёнными строками и text-sniffing'ом.

- [x] **R8.7. Боевые состояния действий — эффектами, а не флагами `TurnState`.** P2, M.
  **Сделано:** Dodge — строка `AUTOMATION_ACTIONS.dodge` (`resolution: 'effect'`, targeting self): эффект с `attack`+`disadvantage` (читается `attackRollParts` как «атаки по владельцу») и `save`+`advantage`/фильтр `dex`, длительность `endOfTurn/of: 'target'` (снимается в начале следующего хода владельца существующим `tickEffects` — `startOfTurn` не понадобился). Удалены `TurnState.dodge`, `Combat.isDodging` + фасад `RoomManager.isDodging`, `dodgeAdvantage` в `savePartsForToken`, `targetDodging` из `countAttackAdvantage` и оба резолвера атак. `TurnState.disengaged` оставлен флагом (правило движения). Цена принята: эффект виден в `EffectChips`. Тест `rooms.test` переписан на эффект, handlers-тест «Уклонение» зелёный.
  **Зачем:** правки в резолверах не нужны вообще, adv/dis для атак и спасов идут через движок эффектов — то же направление, что R8.1 (`AutomationDef`: действия — данные).

---

## R9 — Тесты и devex

- [ ] **R9.1. Нет тестов компонентов; логика заперта в них.** P1, M.
  `client/vitest.config.ts:4-6`: `environment: 'node'`, только `src/**/*.test.ts`; нет jsdom/@testing-library; все UI-сценарии — только Puppeteer (~60–85 с). Тестируемые правила в компонентах: `ActionPanel.canSpend:160-168`, `SpellPopover.submit:76-114`, `RollMenu.applyAdvantage:23-27`.
  **Что сделать:** вынести правила в `lib/` (см. R7.2), добавить jsdom + Testing Library для модалок/панелей, `data-testid` на e2e-критичных узлах.
  **Зачем:** сейчас любая правка UI-правила проверяется только полным e2e.

- [ ] **R9.2. Smoke: сценарии не самодостаточны, покрытие реакций дырявое.** P2, M.
  `scripts/smoke.mjs:10-38`: все сценарии в одной общей комнате, `SMOKE_ONLY` не подтягивает зависимости (`:24-25`) — изолированный дебаг ограничен; `scripts/lib/rooms-cleanup.mjs:3` хардкодит `ADMIN_TOKEN=''` — ломается при `VTT_ADMIN_TOKEN`; в скриптах нет `reaction:respond`/`combat:setMovement`; `reactionFeatures`/`absorbTypesOf`/`superiorityDie` без юнит-тестов.
  **Что сделать:** `makeRoom` для самодостаточных сценариев или явные зависимости; admin-токен из env; smoke на реакционные окна и OA; `shared/src/rules/reactions.test.ts`.

- [ ] **R9.3. E2E/скриншоты привязаны к окружению и пикселям.** P3, S/M.
  Жёсткий путь Chrome (`scripts/e2e/00-setup.mjs:21`), вьюпорт 1440×900 (`:74`); `check-screenshots.mjs:122-188` сверяет точные RGB и координаты в составе `verify` (`package.json:23`) — косметика даёт ложные падения.
  **Что сделать:** `PUPPETEER_EXECUTABLE_PATH`/viewport из env; приоритет DOM/`window.__vtt`-проверкам; оставить 2–3 грубых скриншот-проверки.

- [ ] **R9.4. Дубли тест-фикстур и переписанный прод-контекст.** P2, M.
  `makeToken` в `server/src/test/fixtures.ts:13-48` и `client/src/test/fixtures.ts:13-48` идентичен; фейковый `ConnCtx` (`handlers.test.ts:36-113`) и `applyHp` — копии прод-кода, поэтому изменения прав/redact могут не ловиться тестами.
  **Что сделать:** общие фабрики в `shared/src/test` (или subpath export `test-utils`); критичные тесты — против реального `createCtx` (пересекается с R6.9).

---

## Очередь работ (актуально, по шагам)

Принцип: сначала убрать оставшиеся риски и подготовить данные/типы, затем строить каталог классовых действий на новом фундаменте; клиентский долг — после, чтобы не мешал фиче. Каждый шаг — отдельная сессия и коммит.

### Шаг 1. R6.5 — очередь реакций (L, server). ✅ Сделано
Инстанс `ReactionQueue` на комнату, очередь окон с перепроверкой оплаты, изоляция resume. Осталось (необязательно): реестр `onTrigger(kind, resolver)` — при первом новом триггере.

### Шаг 2. R6.9 — тест-кит сервера (M). ✅ Сделано
`makeConnCtx` поверх реального `createCtx` + in-memory транспорт, `registerHandlers(ctx)`, перевод `handlers.test.ts` (46) и `integration.test.ts` (+2). Ручной фейк `ConnCtx` удалён.

### Шаг 3. R6.7 — типовые швы (M/L, server/shared). ✅ Сделано (срезы 1–5)
Нормализаторы Token/Map/Scene, `isRecord` + `decode.ts`, `noUncheckedIndexedAccess` в base, `toPersistedRoom`-снапшот, `Room` от `RoomState`, `toState` через rest. Необязательный хвост: остальные домены на `decode.ts` по мере правок.

### Шаг 4. R8.5 — ключи каталогов и состояний (S/M, shared). ✅ Сделано
`Spell.conditions` → `ConditionKey` (миграция снимка, `conditionKeyOf`), дубль RU-карты удалён, `unsupported` убран. Ref-ключи каталогов отменены: снимок `spells.json` заморожен, `Spell.key` стабилен; каталоги и R8.1 ключуются по `Spell.key`.

### Шаг 5. R8.3 — снимок-тест данных (S/M). ✅ Сделано
Deploy-бакет `*.deploy.test.ts` + `npm run test:deploy` (первый шаг `verify`): hash трёх JSON, контракт записей и каталогов, свип парсеров, покрытие иконок. Обычный `check` бакет не подхватывает.

### Шаг 6. R8.4 + R8.1 — распил `types.ts` и каталог `AutomationDef` (M + L). ✅ Сделано
R8.4 ✅: `domain/*`, `labels.ts`, `socket/contract.ts`, `normalize/*`, шима удалена. R8.1 ✅ (срезы 1–5): схема `AutomationDef` + деривация, каталоги `AUTOMATION_SPELLS`/`AUTOMATION_ACTIONS`, generic-executor, контент-партия спеллов (Color Spray/Hold Monster/Hypnotic Pattern/Sleep), базовые действия и первые черты, реакции/Counterspell/reach в shared, Dodge → эффект (R8.7). Подробности — в карточке R8.1.

**Движок зон (сделано):** `ZoneInstance` в `MapInfo.zones` (персистентность через `normalize/scene`), `socket/zones.ts` — создание при касте (`createZoneFromDef`), аура (`zoneId` на эффектах), триггеры enter/exit/startOfTurn/endOfTurn, `enterOncePerTurn`, `containment: 'fullyWithin'` (`tokenFullyInArea`), раунды, снятие по концентрации (`removeZonesOfSource` во всех путях), синк клиенту через `maps:update`; `ZoneLayer` на столе. Executor создаёт зону независимо от мгновенного payload'а (`origin`/`direction` протянуты из `spell:cast`). Тесты: `zones.test.ts` (4, синтетическая зона), `tokenFullyInArea`; `check` 287+122+48, build зелёный. **Контент зон (сделано):** **Web** (концентрация, DEX-спас при касте/входе/начале хода → restrained; «Выпутаться» — STR/Athletics против СЛ), **Grease** (cube 10, `rounds:10`, DEX-спас при касте/входе/конце хода → prone), **Stinking Cloud** (концентрация, CON-спас в начале хода → poisoned до конца хода + noActions/noBonus), **Spirit Guardians** (деривация урона + `AUTOMATION_ADDITIONS`: зона `anchor:'source'`, `enterOncePerTurn`, кости `'$spell'` с апкастом, аура speed ×0.5, `damageTypes:['radiant']`), **Hunger of Hadar** (containment `fullyWithin`: аура blinded, начало хода — 2d6 cold без спаса, конец — DEX-спас и 2d6 acid). «Выпутаться» — динамическое действие панели (`escape:` в `action:use`, `EffectInstance.escape`, владение навыком). `check` 291+123+48, deploy 7+2, smoke 130/0.
**Зоны — хвосты:** флаги `difficultTerrain`/`obscured`/`blocksLight` пока только данные — **TODO к вижну/движению** (Stinking Cloud `obscured:'heavy'`, HoH `blocksLight` = darkness); кап целей Slow (6) и клиентское дизейблирование по ограничениям — по-прежнему хвосты.
**Догон по зонам (сделано):** per-payload `containment` (у HoH урон-триггеры `anyCell` — краевые 4×4 бьются, аура слепоты остаётся `fullyWithin`); якорь концентрации на кастере для зонных заклинаний без целевых эффектов (HoH/Stinking Cloud/Spirit Guardians) + снятие прошлых эффектов и зон **до** создания новой (Web больше не теряет зону при касте); `token:move` синкает ауру/enter/exit (drag в чужой ход); origin area-каста считает сервер (эманация — от кастера), клиент шлёт `origin`/`direction` как раньше. `ZoneLayer` — штриховка клеток (не путается с подсветкой движения); меню действий (`.ap-icons`) скроллится при переполнении. **Концентрация-зоны:** ручное снятие якоря гасит зоны; в меню токена аура зоны помечена «аура зоны» (не снимается чипом), у своего якоря — кнопка «Прекратить» (`spell:endConcentration`); осиротевшие зоны концентрации сносятся при гидратации комнаты и в `tickZones`/`handleMovementZones`.

**Панель действий, мульти-цели, реакции (сделано):** иконки заклинаний — три яруса (эффекты → авто-механика → `manual` «красные» в конце), внутри круг/название; тултипы порталом (`.ap-tip`, не режутся скроллом `.ap-icons`), горизонтальной полосы нет. Апкаст-цели — `spellExtraTargets` («one additional creature/Humanoid/Beast/Undead for each slot level above N»): Hold Person/Hold Monster/Bless/Bane/Longstrider; мультивыбор «до N» с досрочным применением меньшего числа (`finishMultiTarget`) и запретом дублей для существ (`distinct`). Массовое лечение — `AutomationDef.targets` + `AUTOMATION_ADDITIONS`: Mass Healing Word 6, Prayer of Healing 5, Mass Cure Wounds 6 (каждая цель по разу, сервер режет по `targets`). В пикере ячеек — только круги с `current > 0` (`castableLevels`, пакт/статблок), по умолчанию первый доступный. Концентрация не остаётся, если эффекты ни на кого не легли и зоны нет (Hypnotic Pattern: все прошли спас). **Реакции:** окно на выход из досягаемости открывается и при оплачиваемых классовых чертах (Рипост/Парирование/Палящая вспышка/Невероятное уклонение), а не только заклинаниях; починена DM-кнопка «Пропустить все» (`reaction:forceSkip` принимает id оффера).

**Mirror Image (сделано):** `EffectInstance.misdirect` (заряды/кость/порог) + хук `socket/misdirect.ts` в обоих путях попадания (оружие — `applyWeaponAttackDamage`, spell-атаки — executor): бросок кости за каждый образ, любой ≥ порога принимает удар (образ гибнет, урона нет), 0 зарядов — эффект снимается; ослеплённый атакующий образами не обманывается (blindsight/truesight не моделируются); `effectSummary` показывает остаток. Каталог: `XPHB:Mirror Image` (3×d6≥3, 10 раундов). Тесты: каталог, тултип, редирект в `handlers.test` (урона нет, эффект снят). `check` 292+124+48, deploy 7+2, smoke 130/0.

**Дальше по контенту каталога:** restrictions ✅ → зоны ✅ (движок) → призывы; заклинания/черты под них — партиями, по спорной механике спрашивать владельца. Полный каталог черт/фитов (`features.json` + `CharacterSheet.choices`) — отдельный план в `PLAN.md`.

**R8.8 — каталог черт классов/подклассов (фундамент ✅, сделано):** `npm run features` → `shared/src/data/features.json` (829 черт, 13 классов/97 подклассов, XPHB/XGE/TCE, ≤20 ур., ключи совпадают с ресурсами `CLASSES`); `rules/features.ts` + merge в `classFeatures` (уровень из каталога гейтит ресурс, имена/описания из каталога, manual-заглушка печатает суть); ручной слой `rules/featureAutomation.ts` (`passive`/`active`/`choice`, уровневые функции); `EffectInstance.hidden` + синк пассивок (`server/src/socket/features.ts`, секция «Черты класса» в меню токена); `CharacterSheet.choices`.

**R8.8 — партия 1 (варвар + воин, ядро) ✅:** фильтр `ModifierFilter.direction` (`self`/`against`) в движке эффектов (Reckless Attack, заодно починен Dodge); Ярость — эффект с уровневым уроном (+2/+3), сопротивлением B/P/S, преимуществом Str и запретом заклинаний (`restrictions.noSpells` + `rejectIfSpellsBlocked`); Безрассудная атака; пассивки варвара (Защита без доспехов = AC `10+dex+con`, Быстрое передвижение, Чувство опасности, Звериный инстинкт) скрытыми эффектами; Extra Attack / Two Extra Attacks / Improved Combat Superiority — `native`; уникальные иконки 18 активных кнопок (`client/src/components/featureIcons.tsx`) + deploy-покрытие по обработанным классам. `check:quiet` ✓, build ✓, smoke 130/0 (после перезапуска сервера). **Хвосты:** Чувство опасности — сузить до «видимых» эффектов после вижна; Ярость — запрет концентрации и реакционных заклинаний (сейчас только `spell:cast`). **Дальше:** партии подклассов (механики + иконки), attack riders под Sneak Attack/Divine Smite/манёвры, choices-пикер.

**R8.8 — партия 2 (подклассы варвара/воина) ✅:** attack-rider движок (`rules/attackRiders.ts` + `server/src/socket/attackRiders.ts`): условия ярость/безрассудство/метка, расход ресурса, «раз в ход» скрытой меткой; **Божественная ярость** (1d6+полуровень радиант), **Неистовство** (2d6/3d6 при Reckless+Ярости), **Псионический удар** (кнопка-метка + кость пси-энергии +1d6+Int). Реакции расширены: kind `reduceDamage` (**Щит духов** — −2d6 урона союзнику 30 фт), `acBonusAlly` (**Защитный манёвр** — +1d8 AC союзнику 5 фт), `counterAttack` по триггеру `damage` (**Возмездие**); окно attackHit теперь собирает офферы защитников-союзников, `WeaponDamageMods.flatReduction`. Пассивки: **Защищённый разум** (сопротивление психике), **Выдающийся атлет** (преимущество инициативы и Атлетики). Иконка пси-удара. Тесты: shared 6, server 66 в handlers (+4), deploy OK. **Осталось по подклассам:** манёвры/инвокации (choices), предок-защитник, тотемы, аура бури, temp HP (Самурай), критический диапазон (Чемпион), telekineticThrust (толчок/сбивание), reaction-окна для заклинаний урона (Щит духов по спеллу).

**R8.8 — партия 3 (temp HP + крит-диапазон) ✅:** механика временных HP: `AutomationEffect.tempHp` выдаёт пул при наложении (`grantTempHp` — не складывается, берётся большее), урон списывает temp до основных HP (`adjustTokenHp`, персонаж/монстр); **Боевой дух** самурая полностью (преимущество только на оружие — фильтр `weapon`, 5/10/15 temp HP), **Vitality of the Tree** (temp HP = уровень варвара при входе в Ярость, кнопки нет — native). Крит-диапазон: `critRangeFor` (Чемпион 19/18) + `isCriticalHit(roll, minFace)`. Тесты: shared +5 (combat/features), server +3 (Боевой дух, поглощение temp, крит на 19).

**R8.8 — партия 4 (Фанатичное присутствие + досягаемость) ✅:** `AutomationEffect.radiusFeet` — бафф на всех союзников в радиусе без выбора целей (фракция не-нейтральная, включая кастера), **Zealous Presence** (преимущество на атаки/спасброски до начала своего следующего хода). Модификатор эффекта `target:'reach'` + `attackRange(..., reachBonus)`; **Battering Roots** — пассивно +10 фт к ближним атакам **только в свой ход** (вне своего хода сервер игнорирует; ограничение Heavy/Versatile не моделируется), OA — без бонуса. Хелпер `hostileTokens` вынесен в shared (реакции его переиспользуют). Тесты: shared +3, server +2.

### Шаг 7. R7.3 — `mutate`/ack + тосты (M/L, client)
Единый идиом оптимистичных мутаций с откатом и ошибками — под новые действия/фичи каталога.

### Шаг 8. Клиентский долг по убыванию отдачи
R7.5 (`TableTop`: туман/камера/оверлеи), R7.7 (селекторы/перф), R7.6 (права в UI), R7.9 (CSS-токены/z-index + `data-testid`), R7.10 (черновики форм).

### Шаг 9. По мере надобности
R8.6 (метки без RU-текста — перед локализацией), R9.2 (smoke: самостоятельные сценарии, admin env), R9.3 (e2e env/пиксели), R9.1 (jsdom+TL — когда понадобятся быстрые тесты модалок).

**Правило тестов:** количество не растёт; новые — только «самые необходимые», вместо устаревших.

**Старт:** R8.2, R6.1–R6.9, R7.1, R7.2, R7.4, R6.7 (срезы 1–5), R8.5, R8.3, R8.4 (срезы 1, 3), R8.1 (срезы 1–5), R8.7 — сделано. Дальше: движок restrictions → зоны → призывы; контент каталога партиями.
