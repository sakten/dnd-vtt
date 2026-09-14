# REFACTOR.md — реестр архитектурных работ

Источник: три параллельных аудита (сервер, клиент, shared/данные + тесты), сентябрь 2026; аудит после R5.
Формат: `R<серия>.<номер>` — «задача». Приоритет: **P1** (тормозит следующие фичи) / **P2** (заметно мешает) / **P3** (долг). Трудозатраты: S (~1–2 ч) / M (~полдня) / L (сессия).

Закрыто до этого реестра: **R2** (UI-примитивы: `Modal` + стек Esc, `Field`/`CheckboxRow`/`SizeRow`, общие блоки `TokenFieldsForm`, `AttacksForm` в листе, `SpellPicker`+`SpellTooltip`, `ChipRow`).

## P1-очередь (осталось)

| ID | Задача | Область | Трудо-затраты |
|----|--------|---------|---------------|
| R6.5 | `ReactionQueue`: срез 1 ✅ (инстанс на комнату), осталась очередь окон | server | L |
| R8.1 | Каталог `AutomationDef` + generic-executor | shared/server | L |
| R9.1 | jsdom + Testing Library для логики панелей/модалок | client/tests | M |

Закрытые P1: R8.2, R6.1–R6.4, R6.6, R6.8, R7.1, R7.2, R7.4.

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

- [ ] **R6.5. Движок реакций: глобальное состояние, одно окно, resume без try/catch.** P1, L. **(срез 1 сделан, срез 2 — очередь окон)**
  Исходно: `pendings`/`roomPending`/`offerIndex`/`pendingContext` — модульные и по код-комнате (`socket/reactions.ts:72-76`); второй триггер молча теряется (`openReactionWindow` → false, `:450`), при этом атака сразу наносит урон; resume — замыкание над внешним `holder` (`attackResolve.ts:920-936`), вызывается из таймаута (`reactions.ts:499-520`) вне try/catch `ctx.on`: исключение = `uncaughtException` (`index.ts:30`). Расширение триггеров — правки в `attackResolve.ts:806-908`, `reactions.ts:393-436,637-803`, `socket/spells.ts:28-165`.
  **Срез 1 (сделано):** `class ReactionQueue` — инстанс на комнату (`pending`, `offerIndex`, `ctx` внутри класса; реестр `queues` с поиском по pending/offer и автоочисткой простаивающих), `open`/`lookup`/`offers`/`skipPlayer`/`finish`; хендлеры, таймаут и дисконнект работают через инстанс, `isReactionPending`/`pendingOffers` — фасад. Резолв по-прежнему обёрнут в try/catch. Тесты 100, smoke 130/0, e2e 81/0.
  **Срез 2 (осталось):** очередь окон вместо дропа второго триггера (`waiting`-очередь в `ReactionQueue.open`: при занятой паузе args встают в очередь и открываются после `finish`) с перепроверкой оплаты/офферов на момент открытия; типизированный `TriggerEvent` для расширения триггеров.
  **Зачем:** новый триггер («при попадании заклинанием», «враг подошёл на 30 фт») не должен искать 3 call-site; одновременные триггеры сейчас теряются.

- [x] **R6.6. Рассылка токенов скопирована 5 раз; `visibleToken` сканирует всё.** P2, S/M.
  Исходно: цикл «найти сокет игрока и отправить»: `socket/context.ts:118-132,164-177,178-188,189-196`, `reactions.ts:110-115` (с неизбежными кастами). `visibleToken` ищет mapId через `manager.locateToken` (`context.ts:159`) — O(карты×токены) на каждый токен каждому игроку.
  **Сделано:** `isDmViewer` экспортируется из `context.ts` (убран дубль в `reactions.ts`); `ctx.emitTo(room, playerId, event, …)` (типизированный) — единственный путь отправки конкретному игроку; `broadcastMaps`/`broadcastLibrary`/`emitToken`/`emitResources` и окна реакций (`reaction:offer`/`close`) используют его. `visibleToken(room, token, viewerId, mapId?)` принимает mapId, все вызовы передают его — `locateToken` больше не на горячем пути. Фикстура `handlers.test.ts` дополнена `emitTo` (тесты не добавлялись).

- [ ] **R6.7. Типовые швы: `Room` vs `RoomState`, мутационная гидратация, слабая валидация.** P2, M/L.
  `Room` (`roomTypes.ts:7-20`) и `RoomState` (`shared/src/types.ts:1124-1134`) описывают комнату по-разному; `toPersistedRoom` копирует живые ссылки (`roomTypes.ts:35-48`); `roomNormalize.ts:23-46` — 138 строк мутаций с `as unknown as`; `noUncheckedIndexedAccess` выключен (`tsconfig.base.json:6`) — `room.controllers[playerId]` типизирован `string`, но может быть `undefined` (`rooms.ts:257,265`); payload-ы проверяются `typeof` вручную (`socket/token.ts:15-24`, `socket/map.ts:9-16`).
  **Что сделать:** нормализаторы на уровне сущностей (Token/Map/Room) + сборка `Room` через них; наружу только `RoomState`; включить `noUncheckedIndexedAccess`; общие `isRecord`/декодеры payload.
  **Зачем:** новое поле Token/Scene = гидратация + фикстуры + маппинг `PersistedRoom` + обе формы комнаты.

- [x] **R6.8. Обработка ошибок непоследовательна.** P2, S/M.
  Исходно: битые payload молча игнорируются (`token.ts:21-24,39`, `spells.ts:37`, `map.ts:16`) или присылаются русской строкой в `chat:error` (`actions.ts:46-94`, `spells.ts:48-156`); `DiceParseError` маппится только в `dice:roll` (`attackResolve.ts:250`, `spellResolve.ts:323` — generic); у `finishPending→resume` нет catch.
  **Сделано:** `server/src/socket/errors.ts` — типизированный каталог `ErrorCode` (16 кодов) с рендером текста (`errorText`, параметры `feet`/`name`) и единый `fail(ctx, code, params)`; все handler-сообщения переведены (`guards`, `actions`, `dice`, `spells`, `token`, `attackResolve`) — тексты сохранены дословно (smoke/handlers-тесты зелёные). `pending.resume` в `finishPending` обёрнут в try/catch (таймаут/DM-скип вне try/catch сокет-хендлера). Пока не трогали: строки-возвраты резолверов (`result.error`, `validateSpellCast`) и формат `chat:error` — перевод на коды на клиенте отдельным шагом, чтобы не менять протокол.

- [ ] **R6.9. Серверный тест-каркас: ручной фейк `ConnCtx`, глобальные реакции.** P2, M.
  `makeCtx` вручную реализует ~30 членов `ConnCtx` с `as unknown as` (`handlers.test.ts:44-101`); добавление метода в `ConnCtx` не ломает компиляцию, а падает в рантайме на одном пути; `visibleToken` возвращает сырой токен, `applyHp` — копия `context.ts:200-208`; состояние реакций модульное, тесты на комнате `'TEST'` (`fixtures.ts:52`) — протечка отравляет соседние тесты; поведенческие сценарии доступны только в smoke.
  **Что сделать:** тест-кит `makeConnCtx(partial)` (merge overrides) + `invoke`/`calls`; fake timers для таймаута реакции; пара интеграционных тестов поверх реального `createCtx` и in-memory socket.io; состояние реакций — в инстансе очереди (после R6.5).

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

- [ ] **R8.1. Автоматизация заклинаний/черт — bespoke-ветки, а не каталог.** P1, L.
  Data-driven только `SPELL_EFFECTS` (20 ключей, `shared/src/rules/spellEffects.ts:32-232`); дальше 5 хардкод-веток (`server/src/socket/spellResolve.ts:197-316`); Counterspell/Absorb захардкожены (`reactions.ts:236-259,693`); `acBonusOf` реверс-инжинирит эффекты (`reactions.ts:197-206`); геометрия выхода из reach — в socket-слое (`reactions.ts:599-608`), хотя есть `shared/rules/movement.ts`; `validateSpellCast` прогоняется дважды (`spells.ts:129` + `spellResolve.ts:186`). Из 229 manual-заклинаний не покрыто 214, при этом 103 уже имеют `save`/`conditions`/`areaSpec` (Charm Person, Sleep). `FEATURE_META` даёт 118 кнопок без реализации (`classActions.ts:43-187` + стаб `socket/actions.ts:104-149`).
  **Что сделать:** единая схема `AutomationDef` (kind: damage/heal/save/buff/debuff/control; duration; modifiers; conditions; scaling) + generic-executor на сервере, данные — строки; классовые фичи — та же схема; явный `automation: 'manual'` как fallback; counterspell-параметры и reach-геометрия в shared; catalog-level тесты.
  **Зачем:** следующая большая фича (каталог классовых действий и остаток Ф8) без этого — сотни строк ручных веток и правки в 4–6 файлах на заклинание.

- [x] **R8.2. Добавление поля Token/Sheet — чек-лист из 6+ мест.** P1, M.
  Исходно: `damageDefenses` встречается в ~20 файлах; путь нового поля: тип (`shared/src/types.ts:62-78`) → полный и patch-нормализаторы (`:706-759`) → два ручных цикла гидратации (`server/src/roomNormalize.ts:54-82,89-107`) → два redact-whitelist (`socket/context.ts:155-168`; `attacks` там уже забыт) → фикстуры (`server/src/test/fixtures.ts:13-48`, `client/src/test/fixtures.ts:13-48`) → формы.
  **Сделано:** реестр `shared/src/fields.ts` (`TOKEN_FIELD_SPECS`): полная нормализация, patch и заглушки redact в одной записи на поле; `normalizeTokenFields`/`normalizeTokenFieldsPatch` и `redactToken`/`redactLibraryItem` считаются из реестра; `server/src/roomNormalize.ts` и `server/src/socket/context.ts` используют их (опция `keepAcHp` сохраняет непарные AC/HP старых данных). Тесты `shared/src/fields.test.ts` (+11): coverage реестра, patch, `keepAcHp`, redact и отсутствие мутаций. Новое поле = запись в `TokenFields` + строка в реестре (типы не дадут пропустить).
  **Что сделать:** таблица-дескриптор полей (coerce/validate), общая для `normalizeTokenFields`, `normalizeTokenFieldsPatch`, `roomNormalize` и redact; один `redactToken/redactLibrary`; round-trip тест «каждый ключ `TokenFields` нормализуется и редактируется».
  **Зачем:** следующая фича сразу добавляет поля (`CharacterSheet.choices`); сейчас это правки в 6+ местах с риском утечки статов.

- [ ] **R8.3. Сгенерированные данные не валидируются, парсятся регексами по тексту.** P2, S/M.
  Три `as unknown as` (`shared/src/spellsData.ts:11`, `rules/spellLimits.ts:20`, `rules/subclassSpells.ts:27`); ни один тест не импортирует `data/*.json`; вывод зависит от английской прозы: `deriveAreaSpec` (`rules/spells.ts:291-308`), апкаст (`rules/spellCast.ts:41-66`), число атак (`:133-157`); `scripts/build-spells.ts:13` тянет из GitHub в билде и пишет `JSON.stringify` (`:208`).
  **Что сделать:** `rules/data.test.ts` с минимальными type-guard'ами (формат ключей, круги 0–6, `areaSpec`, слаги состояний, классы) + content hash; логировать распределение автоматизации в `npm run spells`.
  **Зачем:** смена схемы/формулировок 5e.tools молча ломает 388 КБ данных.

- [ ] **R8.4. `types.ts` — свалка на 1294 строки.** P2, M.
  Сущности (`:62-108`, `:347-365`, `:517-533`), 13 нормализаторов (`:575-1030`), RU-таблицы (`:397-433,1032-1060`), socket-контракт (`:1136-1293`) в одном файле; `CharacterSheet.abilities`/`TokenStatblock.abilities`/`DEFAULT_ABILITIES` — три пути; `RoomState`/`Room`/`PersistedRoom` — три формы комнаты.
  **Что сделать:** `domain/*` (token, sheet, combat, effects, chat), `normalize/*`, `labels.ts`, `socket/contract.ts`; `index.ts` — re-export.
  **Зачем:** любой импорт тянет всё; несвязанные правки конфликтуют в одном файле.

- [ ] **R8.5. Идентичность каталогов привязана к источнику; состояния дублированы.** P3, S/M.
  Ключи `'XPHB:Shield'`/`'XGE:Absorb Elements'` (`rules/spellEffects.ts:32`, `rules/reactions.ts:8-12`); `Spell.conditions` хранит английские имена (`rules/spells.test.ts:171`), `conditionKeyOf` (`rules/conditions.ts:63`) к данным не применяется; вторая RU-карта — `client/src/lib/spellText.ts:32-48`; `SpellAutomation.'unsupported'` не возвращается никем (`rules/spells.ts:18,319`).
  **Что сделать:** нормализовать conditions в `ConditionKey` на билде; ключи автоматизации — по нормализованному имени + приоритету источника; RU-имена — из общего каталога.

- [ ] **R8.6. Метки бросков хранят готовый RU-текст, клиент парсит его для стилей.** P2, S/M.
  `server/src/socket/messages.ts:29-31` всегда пишет legacy `label`; `client/src/components/ChatPanel.tsx:57-68` классифицирует по `label.startsWith('Атака'/'Урон'/...)`; `dice.ts:22` ограничивает клиентские kind'ы.
  **Что сделать:** новые сообщения без `label` (чтение legacy оставить), стили — из `rollKind`, форматтер с локалью.
  **Зачем:** локализация сейчас заблокирована сохранёнными строками и text-sniffing'ом.

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

### Шаг 1. R6.5 — очередь реакций (L, server)
**Почему первым:** последний P1 на сервере с реальными рисками: состояние в модульных `Map`, одна пауза на комнату (второй триггер сейчас теряется), `pendingContext` и резолв из таймаута. Готовит Ready и вложенные окна.
**Объём:** срез 1 — `ReactionQueue` как инстанс на комнату (снять модульные `pendings`/`roomPending`/`offerIndex`/`pendingContext`), API `isReactionPending`/`pendingOffers` сохранить; срез 2 — очередь окон вместо дропа + явные ошибки резолва (задел уже есть: `fail` и try/catch).
**Проверка:** 9 handlers-тестов реакций + smoke `02-combat`/`04-attacks`/`04b-spells`/`09-effects`.

### Шаг 2. R6.9 — тест-кит сервера (M)
**Почему после R6.5:** per-instance очередь даст чистый сброс состояния между тестами; `makeConnCtx(partial)` + несколько поведенческих тестов на реальном `createCtx` поверх in-memory socket.io уберут «фейк-ctx дрейф» и позволят проверять поведение без smoke.
**Объём:** тест-кит, fake timers для окон реакций, отказ от ручного `as unknown as ConnCtx`.

### Шаг 3. R6.7 — типовые швы (M/L, server/shared)
`Room` vs `RoomState`, гидратация через нормализаторы (`roomNormalize`), `noUncheckedIndexedAccess`, декодеры payload. Делать до того, как добавятся новые поля/события автоматизации.

### Шаг 4. R8.5 — ключи каталогов и состояний (S/M, shared)
Нормализовать `Spell.conditions` в `ConditionKey`, убрать дубль RU-карт, ключи автоматизации — по имени + приоритету источника. Иначе R8.1 размножит `'XPHB:Shield'`-строки по каталогу.

### Шаг 5. R8.3 — валидация сгенерированных данных (S/M)
Проверка `spells.json`/`spellcasting.json`/`subclassSpells.json` (в `npm run spells` + один тест): форматы ключей, круги, `areaSpec`, слаги состояний. Фиксирует данные перед написанием каталога автоматизации.

### Шаг 6. R8.4 + R8.1 — распил `types.ts` и каталог `AutomationDef` (M + L) — старт фичи
Новые типы автоматизации сразу в чистые модули (`domain/*`), старый `types.ts` — реэкспорт; затем единый `AutomationDef` + generic-executor, классовые фичи на той же схеме. Это уже «каталог классовых действий» и остаток Ф8.

### Шаг 7. R7.3 — `mutate`/ack + тосты (M/L, client)
Единый идиом оптимистичных мутаций с откатом и ошибками — под новые действия/фичи каталога.

### Шаг 8. Клиентский долг по убыванию отдачи
R7.5 (`TableTop`: туман/камера/оверлеи), R7.7 (селекторы/перф), R7.6 (права в UI), R7.9 (CSS-токены/z-index + `data-testid`), R7.10 (черновики форм).

### Шаг 9. По мере надобности
R8.6 (метки без RU-текста — перед локализацией), R9.2 (smoke: самостоятельные сценарии, admin env), R9.3 (e2e env/пиксели), R9.1 (jsdom+TL — когда понадобятся быстрые тесты модалок).

**Правило тестов:** количество не растёт; новые — только «самые необходимые», вместо устаревших.

**Старт:** R8.2, R6.1–R6.4, R6.6, R6.8, R7.1, R7.2, R7.4 — сделано; шаг 1 (R6.5) — срез 1. Следующий: срез 2 очереди окон (R6.5) либо шаг 2 (R6.9).
