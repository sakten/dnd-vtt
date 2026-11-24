# Spells, automation, zones, summons and forms

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Заклинания и их автоматизация. Схема `AutomationSpec` и каталог — в `AUTOMATION.md`; здесь только карта исполнения и особые ветки.

## Каст заклинания целиком

клиент `SpellPopover.tsx` → `store/slices/actions.ts` (`castSpell`/`startAim`/`confirmAim`), `domain/interaction.ts` → сервер `socket/spells.ts` → `socket/spellResolve.ts` → `socket/automation.ts`

## Автоматизация (что делает спелл/фит)

схема `shared/src/domain/automation.ts`; каталог manual/chip `shared/src/rules/automation/catalog.ts`, спеки `shared/src/rules/automation/specs/*` (компилятор `compile.ts`, структурная JSON-Schema записей `schema.ts` +
ajv, материализация канонической записи `SpellDef = meta + automation` — `materialize.ts`, шаг 4) + `automationActions.ts`; **кастомы комнаты** — `RoomState.customSpecs` (`custom:import`/`custom:remove` DM + рассылка
`room:customSpecs`, импорт-резолв `server/src/customSpells.ts`, room-aware `findSpell(key, room)`), `CUSTOM_SPELL_PREFIX`/`SpellSource: 'CUSTOM'`; executor `server/src/socket/automation/{core,handlers,execute}.ts`
(`executeAutomation`), контракт веток — `automation/dispatch.ts`; UI конструктора кастомов — `client/src/components/SpellConstructorModal.tsx` + `lib/spellConstructor.ts` (R16 шаг 5: мастер
профилей/копия/мета-форма/превью, сохранение полной записи тем же `custom:import`, деривация `generatedAutomation` из `automation/generate.ts` без реестра спеков); дизайн `AutomationSpec` (R16) — `AUTOMATION.md`

## Эффекты применения (fx:play)

`SpellFxPayload` (`shared/src/domain/fx.ts`; `selfArea` — область от кастера), рассылка из `executeAutomation` (`server/src/socket/fx.ts`; `area` — из `spell.areaSpec` или области способности); клиент
`store/slices/fx.ts` (очередь; `notBefore` — конец d20 кастера), `components/spellFx/SpellFxOverlay.tsx` (ленивый three.js-оверлей над столом: world→screen через `view`, частицы, reduced-motion пропускает) + чистый
`components/spellFx/timeline.ts` (фазы travel/burst/impact/aura/shape: настоящие формы конуса/линии/куба, палитра по типу урона, таблица оверрайдов `FX_STYLES`), `components/spellFx/flameCone.ts` (фабрика конуса пламени
— общий код игры и лабы), `components/spellFx/textures.ts`, `components/spellFx/mask.ts` (видимость по обзору). Порядок работы (лаба `?fx-lab` на игровом коде, discriminating-тест `client/src/lab/cone-check.mjs`,
negative-прогон) — `AGENTS.md`, «FX-эффекты»

## Зоны (Web, HoH, Spirit Guardians)

сервер `socket/zones.ts` (`createZoneFromDef`/`tickZones`/`handleMovementZones`/`removeZonesOfSource`; `enterOncePerTurn` — «раз за ход» и для endOfTurn; триггер `move` — первый за свой ход шаг, начавшийся/закончившийся в зоне (не пуш); payload с `parts`; заряды `charges` — Cordon/Healing Spirit,
разовый `onCreate` при появлении — Storm Sphere, `excludeCreatureTypes`; аура/триггеры фильтруются `side`/`excludeSource`), `socket/effectsApply.ts` (`applyEffectTo`/`removeZoneEffects`), оси тонкой стены — независимы:
`zone.wall.blocksMovement`/`blocksLineOfSight`/`blocksActions` (`zoneWalls.ts` → `Wall.blocksMovement`/`kind`/`blocksActions`, `rules/walls.ts blocks()`), геометрия `shared/src/rules/areas.ts`
(`areaCells`/`tokensInArea`/`tokenFullyInArea`; `ring` — кольцо с безопасной серединой), флаги `movementCost` (×4, Wall of Thorns) и `obscured: heavy` (мгла) — `rules/movement.ts`/`rules/vision.ts`, клиент
`components/ZoneLayer.tsx`, действия зон — `useZoneAction` (`server/socket/actions.ts`) + `useActionContext`

## Концентрация

`server/src/room/effects.ts` (`clearConcentration`/`setConcentration`/`concentrationCheck`), `socket/automation.ts` (`dropConcentration` — снимает эффекты и зоны у **всех токенов персонажа** с тем же `libraryItemId`,
`anchorConcentration`), `socket/effects.ts` (`rollConcentrationOnDamage`), `socket/spells.ts` (`spell:endConcentration`); UI — `ResourcesPanel.tsx`, `EffectChips.tsx`

## Данные заклинаний

`shared/src/data/spells.json` (мета-снимок 5e.tools, `npm run spells`) + `shared/src/data/catalog.json` (канонические записи `SpellDef = meta + автоматизация`, `npm run catalog`, источник `spellsData`) +
`shared/src/data/homebrew/spells.json` (ручные homebrew-записи `HB:*`, вливаются в `spellsData` вместе с `cbt/spells.json`) +
`rules/spells.ts`/`spellsData.ts`; замок — `rules/data.deploy.test.ts` (`npm run test:deploy`), не перегенерировать без нужды (после `npm run spells` — `npm run catalog`)

## Призывы (Summon-*, Find Familiar)

Спеки `rules/automation/specs/summons.ts` (12, блок `summon`) → `AutomationDef.summon` + `resolution:'summon'`; профиль скейла — `SummonDef.profile`/`SummonSpec.profile` (срез 5b: `npm run catalog` переносит
`BestiaryEntry.summon` в запись; спавн `bestiaryTokenFields(entry, {slotLevel, spellAttackBonus, profile})` — профиль записи, фолбэк бестиарий), особые формы Pact of the Chain — флаг `BestiaryEntry.pactOfChain` в данных
(`familiarFormAvailable(entry, pactChain)` вместо списка в коде); сервер `socket/summons.ts` (`runSummon` — свободные клетки, владелец-контролёр, `Token.summon`, сенсы формы, `addTokenToCombatAfter`; `removeSummonsOf` —
сброс концентрации/смерть/удаление кастера; `checkSummonDeath` из `socket/damage.ts`; `toggleFamiliarSenses` — бонусное действие «смотреть глазами фамильяра» до начала своего хода: эффект `viewFrom` на кастере, до 100
фт, своё зрение сохраняется, обзор объединяется в `client/src/lib/los.ts`); каст — `spell:cast` с `origin` (валидация `spellResolve.validateSpellCast`), клиент — `SpellPopover` (выбор формы, точка через `startAim`),
`domain/interaction.ts` (`summonKey`), кнопка в `ActionPanel`/`useActionContext` (`familiar:senses`); `Animate Objects` — manual (ложный авто-урон выключен)

## Формы (Wild Shape/Polymorph)

Резолвер `server/src/room/shape.ts` (`formOf`/`shapeName`/`shapeAttacks`/`shapeStatblock`/`shapeSenses`/`shapeSpeed` — статы зверя БЕЗ подмены полей токена; физически меняются только клетки/позиция и `Token.shape` с
пулом); правила `shared/src/rules/wildShape.ts` (таблицы уровней, круг луны CR/AC/пул, CR-парсер), лист `CharacterSheet.wildShape.known` (`normalize/sheet.ts`), сервер `socket/forms.ts` (`token:shape` — бонусное
действие, использования `druid:wildShape`, проверка места под 2×2, `token:revert`, `endShapesOf` по концентрации), Polymorph — `AutomationDef.shape` (`resolution:'save'` + форма-зверь, валидация в `spellResolve`), урон
по пулу и возврат с переносом — `room/effects.ts` (`adjustTokenHp`); читатели токена — `actorStats`/`visibleToken`/`combat`/`actions` через резолвер, маппинг статов в поля токена — единый `applyActorStats` (вид для
клиента и заморозка при отвязке; при заморозке форма снимается); клиент — `TokenMenu`/`ActionPanel` (пикер формы, `ShapePicker`, `WildShapeForm` на «Талантах», гейт безоружного, попап Polymorph), smoke `14-shapes`

## FX

- **Код эффектов — в игре**: `client/src/components/spellFx/*` (визуалы-фабрики вроде `flameCone.ts`, текстуры `textures.ts`, таймлайн `timeline.ts`; `SpellFxOverlay.tsx` — только обвязка/адаптер). Новый эффект/вариант — модуль или параметры фабрики в `spellFx/`, не разовая копия в другом месте.
- **Лаборатория `client/src/lab/` (gitignored, `?fx-lab`) рендерит игровой код**, своих реализаций не держит: чтобы предложить варианты, добавляй их в игру за фабрикой и показывай в лабе фиксированную сцену. Ручной перенос кода с переписыванием координат запрещён — именно он давал сдвиг вершины, потерянный разлёт и рост конуса.
- **Проверка — скриптом против реального клиента** (образец: `client/src/lab/cone-check.mjs`): каст через сокет, кадры CDP-скринкастом, метрики по пикселям в мировых координатах: вершина на кастере (в т.ч. на диагоналях), стабильность протяжённости (конус сразу всей длины и не растёт/не едет), покрытие всех полос длины, языки по всей длине, ничего за границами конуса, полное угасание. Порог и метрику подбирай так, чтобы тест ловил именно тот класс дефекта, о котором репорт.
- **Перед показом результата — negative-прогон**: сломать эффект (знак поворота, рост, потеря разлёта) и убедиться, что тест падает; затем вернуть и убедиться, что проходит. Зелёный тест, который не отличает заведомо сломанный эффект от рабочего, не считается проверкой.
- Лаба и её тесты — в `.gitignore`, игра их не импортирует; в чистом клоне/проде `?fx-lab`/`?dice-lab` открывают обычный экран, деплой правок не требует.
- Визуальная приёмка (нравится/нет) — за владельцем; агент приносит только результаты метрик, а не скриншоты ради скриншотов.
