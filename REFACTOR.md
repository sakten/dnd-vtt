# REFACTOR.md — архитектурный долг

> **Назначение:** открытая очередь технических работ (R6–R9). Продукт, фазы и очередь контента классов — `PLAN.md`; карта кода — `ARCHITECTURE.md`; деплой — `DEPLOY.md`.
> **Очередь:** R7.3, R7.5–R7.10, R9.1–R9.4, R10 (карточки ниже — единственный источник деталей).
> **Сделано (в истории git):** R6.1–R6.9, R7.1, R7.2, R7.4, R8.1–R8.8 (фундамент черт + лог партий 1–22), R8.6 (метки бросков) — `git log -p -- REFACTOR.md`.
> **Проверки:** в цикле — `npm run check:quiet`; перед деплоем — полный `npm run verify` (обязателен).
> **Правило тестов:** количество не растёт; новые — только «самые необходимые», вместо устаревших.
> **Порядок дальше:** движок restrictions → зоны → призывы (сделаны; хвосты — в карточках).

## R7.3. Оптимистичные апдейты без единого идиома и отката. P2, M (частично закрыто).
Сделано (`617628f`): `store/optimistic.ts` — `beginOptimistic(get, key, rollback, message)` / `settleOptimistic(Prefix)` / `clearOptimistic`; подтверждение — доменное эхо, таймаут 4 с → откат + `chatError`. Мигрированы: `tokens.setTokenFields` (ключ `token:update:<id>`), `sheet.updateResources`, `library.updateLibraryItem`; ожидания сбрасываются при дисконнекте/смене комнаты.
Осталось послайсово: `maps.ts` (`updateFog`/`updateWalls`/`updateVision`/`updateAreas` — троттлинг, ключ по mapId); fire-and-forget `actions.ts`/`combat.ts` (оптимизма нет — нужен канал ошибки, не откат); буфер серверного `token:update` во время драга (`tokens.ts`).
**Что сделать:** распространить идиом на остальные мутации; при появлении ack в контракте заменить эхо-подтверждение точным ack.

## R7.5. `TableTop` смешивает Konva-ввод, туман, камеру и рендер. P2, M.
Геометрия кисти тумана: `TableTop.tsx:133-140,142-182,184-191`, mouse-хендлеры `:219-268`, `rectPreview`; камера `:198-217`; drop `:284-317`; линейка `:111-118,451-472`; оверлеи `:64-109,384-449`. Фильтр токенов для тумана дублирует логику `ConditionsOverlay.tsx:18-29`.
**Что сделать:** `useFogBrush(map)` + чистый `lib/fog.ts`, `useMapCamera()`, `useTokenDrop()`, оверлеи отдельными компонентами; общий `visibleCell`.
**Konva (посмотреть):** stage держит 6 слоёв при рекомендованных ≤5 (warning в консоли) — увести зоны/линейку в `Group` основного слоя.
**Зачем:** новый оверлей/инструмент сейчас впечатывается в 454-строчный файл; правила тумана не тестируются.

## R7.6. Проверки прав/владения вне `lib/control.ts`. P2, S.
`lib/control.ts:25-34` (`canControlWith`) есть, но контроль выводится заново: `ActionPanel.tsx:113-114`, `SpellPopover.tsx:51`, `TokenMenu.tsx:104-107`, `InitiativeBar.tsx:21-29`, `TableTop.tsx:54-62`; `useIsDm()` (тест-режим) vs сырой `s.role === 'dm'` (`Toolbar.tsx:42`) без фиксации намерения.
**Что сделать:** `useCanControlToken(id)`, `useIsRealDm()`, `selectIsCharacter`; документировать разницу тест-режим/реальный DM в хелпере.

## R7.7. Грубые селекторы → перерисовки/пересчёты. P3, S/M (частично закрыто).
Сделано (история git, `0772081`): `fogRects`/`veilRects` зависят от данных (туман, стены/тьма/области/зоны/размер), а не от identity карты; `useVisionViewers` стабилен по подписи зрителей (позиции+сенсы); `memo` в `TokenView` работает — патчится только изменённый токен.
Осталось: `ResourcesPanel.tsx:102-127` подписан на `scene.maps` и сканирует всё ради концентрации; `TableTop.tsx:142-162` пересчитывает `reachableCells` на любой апдейт сцены (в бою — на каждый шаг); фильтр токенов (`:445-449`); `RollMenu.tsx:47-64` пересчитывает `sources` и всегда смонтирован (`ChatPanel.tsx:214`); `fitView` через `setTimeout` (`maps.ts:19,24`).
**Что сделать:** селекторы по entity (map by id)/`useShallow` там, где осталось, `fitView` в `useEffect` по mapId+viewport, концентрация через `characterTokenOf`.

## R7.8. У socket-bridge нет teardown. P3, S.
`net/bridge.ts:44-54`: `setInterval` heartbeat и `onAny` на каждый `attachSocketBridge` без dispose; `slices/room.ts:10-15` защищается только от второго сокета — ре-инит/HMR копит слушатели.
**Что сделать:** возвращать `dispose()` и хранить в слайсе.

## R7.9. CSS: плоский неймспейс, хардкод-палитра, разрозненные z-index, связь с e2e. P3, S/M.
~3700 строк, без токенов: `#1c2026` 25× в 8 файлах, `#2b3039` 17×, `#ffd166` 16×; 26 значений z-index без шкалы (`panels.css:13`=12 … `base.css:123`=1000); e2e ищет по классам (`05-sheet-rolls.mjs:7,30,83`, `07-player-fog.mjs:69-72`) — переименование класса ломает CI.
**Что сделать:** CSS custom properties для палитры + документированная `--z-*` шкала; `data-testid` на e2e-критичных узлах, миграция селекторов.

## R7.10. Черновики форм дублируют инвентарь полей. P2, M (частично закрыто R2).
`TokenMenu.tsx:57-83` и `TokenPanel.tsx:36-55` вручную копируют 13 полей; `CharacterSheetModal.tsx:34-45` — правила листа в компоненте; сброс черновиков держится на `eslint-disable` deps.
**Что сделать:** `useDraft(open, value, toDraft, fromDraft)` + один `tokenFieldsFrom(token)`; поля — из реестра R8.2.

## R9.1. Нет тестов компонентов; логика заперта в них. P2, M (частично закрыто).
Сделано (`617628f`): `client/vitest.config.ts` — проекты `node`/`ui` (jsdom + Testing Library + jest-dom, `src/test/setup.ts`); первые тесты: `SensesForm` (5), `ConditionChips` (4); `advantagedExpression` вынесена из `RollMenu` в `lib/rollMode.ts` с тестом (правило `canSpendSlot` уже в `lib/actionRules.ts`, R7.2).
Осталось: тесты `SpellsPanel`/`FeatsForm` (ленивые данные заклинаний), `data-testid` на e2e-критичных узлах (пересекается с R7.9).
**Зачем:** сейчас любая правка UI-правила проверяется только полным e2e.

## R9.2. Smoke: сценарии не самодостаточны, покрытие реакций дырявое. P2, M.
`scripts/smoke.mjs:10-38`: все сценарии в одной общей комнате, `SMOKE_ONLY` не подтягивает зависимости (`:24-25`) — изолированный дебаг ограничен; `scripts/lib/rooms-cleanup.mjs:3` хардкодит `ADMIN_TOKEN=''` — ломается при `VTT_ADMIN_TOKEN`; в скриптах нет `reaction:respond`/`combat:setMovement`; `reactionFeatures`/`absorbTypesOf`/`superiorityDie` без юнит-тестов.
**Что сделать:** `makeRoom` для самодостаточных сценариев или явные зависимости; admin-токен из env; smoke на реакционные окна и OA; `shared/src/rules/reactions.test.ts`.

## R9.3. E2E/скриншоты привязаны к окружению и пикселям. P3, S/M.
Жёсткий путь Chrome (`scripts/e2e/00-setup.mjs:21`), вьюпорт 1440×900 (`:74`); `check-screenshots.mjs:122-188` сверяет точные RGB и координаты в составе `verify` (`package.json:23`) — косметика даёт ложные падения.
**Что сделать:** `PUPPETEER_EXECUTABLE_PATH`/viewport из env; приоритет DOM/`window.__vtt`-проверкам; оставить 2–3 грубых скриншот-проверки.

## R9.4. Дубли тест-фикстур и переписанный прод-контекст. P2, M.
`makeToken` в `server/src/test/fixtures.ts:13-48` и `client/src/test/fixtures.ts:13-48` идентичен; фейковый `ConnCtx` (`handlers.test.ts:36-113`) и `applyHp` — копии прод-кода, поэтому изменения прав/redact могут не ловиться тестами.
**Что сделать:** общие фабрики в `shared/src/test` (или subpath export `test-utils`); критичные тесты — против реального `createCtx` (пересекается с R6.9).

## R10. ML-авторазметка стен для органических карт. P3, L (отложено владельцем).
Классика (яркость/цвет/контуры/скелет) рисованные пещеры не разделяет: у «The Grotto» порода и вода одной яркости, k-means делит освещение, а не «проходимое/стена» — проверено, стенд в `lab/` (оверлеи — `artifacts/walls-lab`).
**Что нужно:** датасет 20–40 карт стиля с разметкой «проходимое» (разметка через SAM офлайн, ~30–60 мин/карта) + процедурные карты для базы; tiny U-Net (1–3 МБ, ONNX Runtime Web: WebGPU ~0.1–0.5 с, WASM 0.5–3 с); маска → рёбра клеток (как A++ в `lib/wallDetect.ts`) или контуры.
**Проверочный шаг:** 3–5 размеченных карт → прототип → IoU/оверлей.
