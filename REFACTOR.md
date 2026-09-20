# REFACTOR.md — архитектурный долг

> **Временное к релизу** (совместимость, костыли, лицензии) — `ISSUES_RELEASE.md`.
> **Назначение:** открытая очередь технических работ (R6–R9). Продукт, фазы и очередь контента классов — `PLAN.md`; карта кода — `ARCHITECTURE.md`; деплой — `DEPLOY.md`.
> **Очередь:** R7.7, R7.10, R9.1–R9.4, R10 (карточки ниже — единственный источник деталей).
> **Сделано (в истории git):** R6.1–R6.9, R7.1–R7.5, R7.6, R7.8, R7.9, R7.11, R8.1–R8.8 (фундамент черт + лог партий 1–22), R8.6 (метки бросков) — `git log -p -- REFACTOR.md`.
> **Проверки:** в цикле — `npm run check:quiet`; перед деплоем — полный `npm run verify` (обязателен).
> **Порядок дальше:** движок restrictions → зоны → призывы (сделаны; хвосты — в карточках).

## R7.7. Грубые селекторы → перерисовки/пересчёты. P3, S/M (частично закрыто).
Сделано (история git, `0772081`): `fogRects`/`veilRects` зависят от данных (туман, стены/тьма/области/зоны/размер), а не от identity карты; `useVisionViewers` стабилен по подписи зрителей (позиции+сенсы); `memo` в `TokenView` работает — патчится только изменённый токен.
Осталось (сверено 19.09): `ResourcesPanel.tsx:105,118-129` подписан на `scene.maps` и сканирует всё ради концентрации; `TableTop.tsx:190-210` пересчитывает `reachableCells` на любой апдейт сцены (в бою — на каждый шаг); фильтр токенов (`TableTop.tsx:939-943`); `RollMenu.tsx:45-62` пересчитывает `sources` и всегда смонтирован (`ChatPanel.tsx:305`); `fitView` через `setTimeout` (`maps.ts:25,30`).
**Что сделать:** селекторы по entity (map by id)/`useShallow` там, где осталось, `fitView` в `useEffect` по mapId+viewport, концентрация через `characterTokenOf`.

## R7.10. Черновики форм дублируют инвентарь полей. P2, M (частично закрыто R2).
`TokenMenu.tsx:51-92` и `TokenPanel.tsx:37-62` вручную копируют 13 полей (+ `eslint-disable` на :91/:61); `CharacterSheetModal.tsx:36-50` — правила листа в компоненте (:49 `eslint-disable`); часть правил уже в `lib/sheet.ts`.
**Что сделать:** `useDraft(open, value, toDraft, fromDraft)` + один `tokenFieldsFrom(token)`; поля — из реестра R8.2. Общие поля уже вынесены в `TokenFieldsForm` (сделано в R2).

## R9.1. Нет тестов компонентов; логика заперта в них. P2, M (частично закрыто).
Сделано (`617628f` + сверка 19.09): `client/vitest.config.ts` — проекты `node`/`ui` (jsdom + Testing Library + jest-dom, `src/test/setup.ts`); тесты `SensesForm` (5), `ConditionChips` (4), `CharacterSheetModal`, `TokenMenu`, `TokenPanel`, `DoorMenu`, `control`, `bridge`; `advantagedExpression` вынесена из `RollMenu` в `lib/rollMode.ts` с тестом; `data-testid` — 62 узла (e2e-критичные: `ChatPanel`, `RollOverlay`, `TableTop`, `RollMenu`, `CharacterSheetModal`, `TokenPanel`, `Toolbar`).
Осталось: тесты `SpellsPanel`/`FeatsForm` (ленивые данные заклинаний).
**Зачем:** сейчас любая правка UI-правила проверяется только полным e2e.

## R9.2. Smoke: сценарии не самодостаточны, покрытие реакций дырявое. P2, M (частично закрыто).
`scripts/smoke.mjs:10-24`: все сценарии в одной общей комнате, `SMOKE_ONLY` не подтягивает зависимости (`:26-39`) — изолированный дебаг ограничен; `scripts/lib/rooms-cleanup.mjs:3` хардкодит `ADMIN_TOKEN=''` — ломается при `VTT_ADMIN_TOKEN`; в скриптах нет `reaction:respond`/`combat:setMovement`; `absorbTypesOf`/`superiorityDie` без юнит-тестов.
Сделано (сверка 19.09): `reactionFeatures` покрыт — `shared/src/rules/features.test.ts:250-273`.
**Что сделать:** `makeRoom` для самодостаточных сценариев или явные зависимости; admin-токен из env; smoke на реакционные окна и OA; `shared/src/rules/reactions.test.ts`.

## R9.3. E2E/скриншоты привязаны к окружению и пикселям. P3, S/M.
Жёсткий путь Chrome (`scripts/e2e/00-setup.mjs:21`), вьюпорт 1440×900 (`:74`); `check-screenshots.mjs:122-188` сверяет точные RGB и координаты в составе `verify` (`package.json:23`) — косметика даёт ложные падения.
**Что сделать:** `PUPPETEER_EXECUTABLE_PATH`/viewport из env; приоритет DOM/`window.__vtt`-проверкам; оставить 2–3 грубых скриншот-проверки.

## R9.4. Дубли тест-фикстур и переписанный прод-контекст. P3, S (частично закрыто).
`makeToken` в `server/src/test/fixtures.ts:13-50` и `client/src/test/fixtures.ts:13-50` идентичен — дубль остался (сверка 19.09).
Сделано: фейковый `ConnCtx` закрыт — `server/src/socket/handlers.test.ts:14` использует `makeConnCtx` из `server/src/test/ctx.ts` (реальный `createCtx`), копий прод-кода в тестах нет.
**Что сделать:** общие фабрики в `shared/src/test` (или subpath export `test-utils`).

## R10. ML-авторазметка стен для органических карт. P3, L (отложено владельцем).
Классика (яркость/цвет/контуры/скелет) рисованные пещеры не разделяет: у «The Grotto» порода и вода одной яркости, k-means делит освещение, а не «проходимое/стена» — проверено, стенд в `lab/` (оверлеи — `artifacts/walls-lab`).
**Что нужно:** датасет 20–40 карт стиля с разметкой «проходимое» (разметка через SAM офлайн, ~30–60 мин/карта) + процедурные карты для базы; tiny U-Net (1–3 МБ, ONNX Runtime Web: WebGPU ~0.1–0.5 с, WASM 0.5–3 с); маска → рёбра клеток (как A++ в `lib/wallDetect.ts`) или контуры.
**Проверочный шаг:** 3–5 размеченных карт → прототип → IoU/оверлей.
