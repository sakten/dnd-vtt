# Maps, fog, walls, doors and vision

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Сцена и пространство: карты, сетка, стены/двери, туман, зоны видимости и библиотека.

## Карты, туман, библиотека, сетка, стены, двери

`socket/map.ts` (`fog:update`/`grid:update {mapId,grid}`/`walls:update`/`vision:update`/`areas:update`/`zones:update` — видимость DM: обзор + «Темнота» + области)/`doors.ts` (`door:toggle`: DM всегда; игрок —
контролируемый токен `isPlayerToken`/`canInteract` в 5 фт от края подошвы, `dmOnly` запрет, `pickDc>0` в бою запрет, вне боя чек Ловкости рук, успех снимает замок; `door:update` — настройки DM)/`library.ts`,
`shared/src/normalize/scene.ts` (**сетка у каждой карты своя**: `MapInfo.grid`, `scene.grid` — дефолт комнаты; `Wall.dmOnly`/`pickDc` — только у дверей), `shared/src/rules/walls.ts` (LOS/проход + `segmentRectDistance`),
`rules/vision.ts` (`canSee`/`visionKindAt`/`sightContextOf`), `rules/areas.ts` (`areaContainsPoint`), `rules/sheet.ts` (`bonusPart` — владение/экспертиза числом или костью: `d4` + экспертиза → `2d4`;
`d20Check`/`d20Expr`/`fmtMod` — единые формулы проверок и бросков d20; им строятся проверки двери и «Выпутаться»); клиент `store/slices/maps.ts` (`updateGrid`/`applyMapGrid`, `activeGridOf`, `toggleDoor` c
`flushThrottled`, `updateDoor`, `doorMenuId`)/`library.ts`, `TableTop.tsx` (двери видны игрокам, курсор-замочек и клик по двери; стены — DM; вуаль обзора), `DoorMenu`/`ObjectMenu` (мини-UI двери: открыть/закрыть, DM —
«только для ведущего», Сл взлома, удаление), `DoorView.tsx` (деревянная створка с петлёй и ручкой, косяки-рама; длиннее клетки — двустворчатая; анимация 200 мс) + `lib/doorRender.ts` (геометрия створок/петель:
`doorGeometry`/`doorLeaves`, чистая), `GridLayer`, `WallsPanel.tsx`, `LightPanel.tsx` («Тьма»), `VisionSettingsModal.tsx` (окно «Обзор»), `lib/{grid,walls}Detect*.ts`, `lib/los.ts`

## Восприятие (зрение) и тьма

`shared/src/domain/sense.ts` (`SENSE_TYPES`: darkvision/blindsight/devilsight/truesight — истинное зрение раскрывает скрытых, `MAX_SENSES`), `normalize/sense.ts`, `labels.ts` (`SENSE_NAMES`); лист —
`CharacterSheet.senses`, токен — `Token.senses` (зеркалится `room/resources.ts`), редактор — `client/src/components/SensesForm.tsx`; области `LightArea` (`darkness`/`magical`/`obscured`) и вижн-зоны заклинаний
(`flags.blocksLight` → магическая тьма, `flags.obscured: heavy` → мгла; Darkness/Fog Cloud/Cloudkill/Sleet Storm, Hunger of Hadar, Stinking Cloud) — `rules/vision.ts` (`visionRadiiCells`, `visionKindAt`, `tokenSenses` —
сенсы токена + эффектов, Darkvision; `sightCrossingKind` — мгла/магическая тьма блокируют обзор **сквозь** (Wall of Thorns, туман), `canSee(..., { ignoreAreas })` — вход вслепую), атаки — `socket/attackResolve.ts`
(невидимость → adv/dis RAW, у видящего невидимого снимается — `attackSources` с флагами `attackerSeesInvisible`/`targetSeesInvisible`); скрытие невидимых — клиентское `lib/visibility.ts` (`invisibilityViewFor`: чужим
токен скрыт, контролёр/DM видят полупрозрачным, See Invisibility раскрывает; скрытые (`hidden`) — контролируемым токеном с соседней клетки, истинным зрением или See Invisibility; `TokenLayer`/`ConditionsOverlay`, «?» в
`InitiativeBar` у несоюзных)

Опция комнаты **«Видимость в мгле»** (`OptionalRules.fogSight`, 0–10): `client/src/lib/los.ts` раскрывает в тяжёлой мгле клетки по манхэттенскому радиусу (0 — только своя, 1 — четыре соседние, далее на клетку во все стороны). Это только отображение: помеха атакам по целям в мгле остаётся серверной (`attackUnseen`), без blindsight её не снимает.
