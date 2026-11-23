# Scripts: данные, smoke, e2e и тесты

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Сборщики данных и инструменты проверки. Полные правила запуска — в `AGENTS.md`, не дублировать здесь.

## Модули

- `build-spells.ts` (`npm run spells`, tsx) — сборка данных заклинаний (5e.tools → `shared/src/data/spells.json`) и лимитов кастеров (`shared/src/data/spellcasting.json`) (см. `shared/src/rules/spells.ts`,
`spellLimits.ts`).
- `build-catalog.ts` (`npm run catalog`, tsx, R16 шаг 4) — канонический каталог: материализация `SpellDef` (meta + спек) из `spells.json` + `AUTOMATION_SPECS` (деривация — `generatedAutomation`) в
`shared/src/data/catalog.json` (источник `spellsData`); валидация схемой (ajv); замки — `automation.materialize.test.ts`, deploy-hash.
- `vitest-quiet.mjs` — обёртка `vitest --reporter=json`: печатает одну строку summary на workspace и список упавших тестов; используется `test:quiet`/`check:quiet`.
- `e2e.mjs` + `e2e/*` — сценарии в браузере (Puppeteer), общий `state.mjs` (`S`) и последовательные `await import()`; скриншоты в `artifacts/e2e`, маркер прогона `artifacts/e2e/.run`.
- `smoke.mjs` + `smoke/*` — серверные socket-сценарии, общий `S`; включает `04b-spells` (каст: ячейка, спасбросок, урон), `08-conditions` (состояния), `09-effects` (Shield/Bless/Aid/Hex + концентрация и долгий отдых),
`10-test-mode` (права ведущего у игроков), `16-shillelagh` (weaponOverride: кость/характеристика клуба, `noClubOrStaff`), `06-robustness` (битые payload). Дебаг-прогон подмножества: `SMOKE_ONLY=09,10 node
scripts/smoke.mjs` (00-setup + выбранные сценарии; зависимости от предыдущих не подтягиваются).
- `smoke.mjs`/`e2e.mjs` — снимок комнат до прогона и удаление созданных в `finally`/по watchdog (чистка после падения).
- `lib/` — `check.mjs` (тихий вывод, `VTT_VERBOSE=1`), `e2e-helpers.mjs` (`findButton`, `waitFor`/`nextFrame` — ждать состояние/кадр вместо `sleep`), `smoke-helpers.mjs` (`eventOnce`, `addLibrary`, `setCharacter`,
`spawnToken`, `setSheet`, `waitToken`), `png.mjs`, `rooms-cleanup.mjs` (`deleteTestRooms` — сносит только комнаты с маркером `test`, обычные не трогает).
- Тесты: серверные фикстуры — `server/src/test/fixtures.ts` (`makeToken`/`makeRoom`/`makeCombatRoom`/`makeResources`), тест-кит контекста — `server/src/test/ctx.ts` (`makeConnCtx` поверх реального `createCtx` и in-memory
транспорта; `invoke`/`emitted`/`advance`); клиентские — `client/src/test/fixtures.ts`.
- `check-screenshots.mjs` (`npm run shots`) — анализ PNG из `artifacts/e2e`; падает, если скриншоты старше маркера прогона; `check-dev.mjs` — проверка dev-экрана.

## Тесты и инструменты

`scripts/smoke/*`, `scripts/e2e/*`, `server/src/test/{fixtures,ctx}.ts`, `client/src/test/fixtures.ts`; уровни проверок — `AGENTS.md`
