# Shared: контракт и правила

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Общие домены, нормализация, правила и данные. Это детали слоя `shared`; корневой ARCHITECTURE содержит только индекс.

## Модули

- `src/domain/*` — домен: `core` (Role/AbilityKey/`DEFAULT_ABILITIES`/`abilityMod`/`statNumber`/`statsPaired`/`clampCells`, лимиты `MAX_*`/`DEFAULT_*`), `token`
(`TokenFields`/`Token`/`LibraryItem`/`TokenStatblock`/`AttackEntry`), `sheet` (`CharacterSheet`/`PlayerResources`/`ClassLevel`), `combat` (`TurnState`/`CombatState`), `effects` (`Condition*`/`Modifier*`/`Effect*`),
`actions` (`ActionDef`/`Reaction*`/`AreaSpec`), `scene` (Grid/Fog/`MapInfo` c `zones: ZoneInstance[]`/`Scene`/`snapToGrid`/`gridOfMap` — единый резолвер сетки карты с фолбэками), `chat`
(`RollMessage`/`RollKind`/`labelParams` — структурные метки бросков для i18n), `room` (`Player`/`RoomState`/`customSpecs`); `src/socket/contract.ts` — socket-события `ClientToServerEvents`/`ServerToClientEvents`;
`src/labels.ts` — RU-каталоги (`DAMAGE_TYPES`/`damageTypeName`, `DEFENSE_TYPE_NAMES`, `ABILITIES`, `SKILLS`); `src/normalize/*` — нормализаторы; `src/fields.ts` — реестр полей предметов/токенов
(`normalizeTokenFields`/`normalizeTokenFieldsPatch`); `applyDamageDefenses`/`DamageDefense` — `domain/damage.ts`.
- `src/dice.ts` — парсер выражений и бросок (чистый, покрыт тестами; суффиксы типов урона на термах: `1d6 + 3force`, раскладка `damageParts` по типам, `modifiers` с типами).
- `src/rules/` — `classes.ts` (данные классов, слоты, HP, caster level), `combat.ts` (дистанции, `attackRange`, `resolveAttack`, `countAttackAdvantage`, `weaponRolls`), `control.ts` (`controlsToken`/`isCharacterToken` —
общее правило контроля токена для сервера и клиента), `movement.ts` (стоимость шагов/достижимые клетки, `pathLeavesReach` — выход из досягаемости для OA), `resources.ts` (ресурсы, `syncResources`, `sanitizeResources`,
`applyRest`), `actions.ts` (`BASE_ACTIONS`, экономика слотов: `actionSlotAvailable`/`attackAvailable`/`slotSpendable`/`consumeAttackTurn`/`consumeSlotTurn`), `classActions.ts` (`classFeatures` — классовые черты из
ресурсов `CLASSES`), `reactions.ts` (триггеры реакционных заклинаний, `COUNTERSPELL`, реакционные черты `reactionFeatures`), `spells.ts` (типы `Spell`, нормализатор заклинаний 5e.tools, флаги `healing`/`saveHalf`),
`spellLimits.ts` (лимиты кантрипов/подготовки/круга/DC из `data/spellcasting.json`; третьи кастеры EK/AT), `spellCast.ts` (`spellActionCost`, скейл кантрипов/апкаст `spellDamageExpression`, дистанция, `maxCastableLevel`,
`casterStats`, `spellHasArea`/`spellAreaOrigin`), `areas.ts` (геометрия областей Ф7: `areaCells`/`tokensInArea`/`tokenFullyInArea`/`tokenCells`, общие клеточные примитивы
`pointCell`/`cellCenter`/`areaCellKey`/`cellChebyshev`), `conditions.ts` (состояния Ф8: каталог, авто-эффекты — adv/dis, авто-крит, авто-провал спасбросков, запрет движения/действий, истощение; `hidden` — скрытый: видно
с соседней клетки/истинным зрением/See Invisibility, `seesHidden`), `effects.ts` (движок эффектов Ф8: модификаторы к атаке/урону/AC/спасброскам/скорости, `rollMode` — любое преимущество и любая помеха взаимно отменяются,
сопротивления, `filter.targetId` для метки, `concentrationDc`, формулы вида `13+dex`, `restrictionsFor` — ограничения экономики от условий/эффектов), `automation.ts` + `automationActions.ts` (схема автоматизации R8.1:
`automationForSpell` — спеки `AUTOMATION_SPECS`, затем каталог `AUTOMATION_SPELLS` (только manual/chip: Charm Person/Compulsion/Phantasmal Force/…), затем деривация «атака/спасбросок/автоурон» из данных → `manual`; слой
добавок (`AUTOMATION_ADDITIONS`, Shocking Grasp/Cure Wounds/Chill Touch/Harm) мигрирован в спеки и удалён — `derived` не менялся; `automationForAction` — каталог `AUTOMATION_ACTIONS` (базовые действия и черты:
dash/disengage/hide/search/dodge/Всплеск действия/Второе дыхание, скейл `classLevelBonus`); ограничения экономики — `Restrictions`/`restrictionsFor` (Slow/Stinking Cloud); выпутывание —
`AutomationEffect.escape`/`EffectInstance.escape` (Web); типы `AutomationDef`/`AutomationEffect`/`ZoneDef`/`ZoneInstance`/`SummonDef` — в `domain/automation.ts`; `escalate`/`wakeOnDamage`/`misdirect` (Mirror Image) —
движки, призывы зарезервированы, строк без обработчика нет), `subclassSpells.ts` (выдаваемые заклинания доменов/клятв/патронов). Баррель `src/rules.ts`.
- `src/data/spells.json` (420 заклинаний — мета из 5e.tools, генерируется `npm run spells`; поля `healing`/`saveHalf`/`areaSpec`), `src/data/catalog.json` (канонические записи: мета + спек автоматизации, генерируется
`npm run catalog`; источник `shared/spellsData`), `src/data/spellcasting.json` (лимиты классов), `src/data/subclassSpells.json` (выдача классам/подклассам), `src/data/features.json` (829 черт классов/подклассов,
генерируется `npm run features`; ключи совпадают с ресурсами `CLASSES`), `src/data/maneuvers.json` (20 манёвров боевого мастера XPHB, генерируется `npm run maneuvers`), `src/data/races.json` (10 видов PHB 2024,
генерируется `npm run races`), `src/data/weapons.json` (37 единиц оружия, генерируется `npm run weapons`; свойства/мастерства — данные, механика мастерств не реализована); `src/spellsData.ts` — ленивый экспорт записей
(`shared/spellsData`), `src/maneuversData.ts` — ленивый каталог манёвров (`shared/maneuversData`).
- `npm test` — vitest: shared/server/client; deploy-бакет `*.deploy.test.ts` — только `npm run test:deploy`/`verify`. Точные counts смотреть в выводе `npm test`.
