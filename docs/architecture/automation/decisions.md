# AutomationSpec: принятые решения

Назад: [AUTOMATION.md](../../../AUTOMATION.md).

## 8. Принятые решения и открытые вопросы

Принято:
- спелл — композиция блоков с одной ведущей веткой; `primary` ∈ `AutomationResolution`, `shape` только с `save`;
- стабильные `id` у массивов; патч по именам; неизвестный путь — ошибка;
- выделяются `loadout`, `triggers`, `uses`, `movement`, `choices`, `selection`, `vision`;
- `mark`/`markTarget`/`markSaved` остаются в `effects`; `retarget` — в `selection`;
- `economy`/`defense` не выделяются; `triggers` — единый формат payload + слот;
- шаблоны — конструкторы над композицией;
- `ValueExpr` (ref/tiers/add/concat) — реализован; пилот `loadout` (10 спеков: GFB/Booming Blade, True Strike, Shillelagh, Magic/Elemental Weapon, Flame Arrows, Shadow Blade, Magic Stone, Flame Blade) компилируется из
`AUTOMATION_SPECS`, равенство вывода билдерам — замок `automation.spec.test.ts`;
- блок `uses` (charges/consumeOnAttack/misdirect) — реализован; мигрированы Resistance, Elemental Bane, Zephyr Strike, Mirror Image; спеки перехватывают и каталог, и билдеры (`derive.ts`);
- блок `zone` + `PayloadSpec` — реализованы (pass-through + ValueExpr); мигрированы Guardian of Faith, Cordon of Arrows, Healing Spirit: `uses` закрыт;
- батч `choices`: `ModifierSpec` (ссылки в value/filter), условия/`retaliate`/`takesExtraDamage`/действия со ссылками, `{ if, then }`, `add/includes/mapped`; мигрированы 10 заклинаний выбора (26 спеков);
- батч составного урона и базовых стен: `DamageSpec.parts`, `part.index`, `choice.optional`, `zone.area: { wall: 'spell' }`; мигрированы Destructive Wave, Wall of Fire, Blade Barrier, Wall of Sand (30 спеков). Тонкие
стены (Ice/Force/Stone: `zone.wall` + `breach`), Wall of Light (`shrinkFeet`), Wall of Thorns — следующим шаблоном `wallZone`;
- батч стен через `wallZone`: параметрические габариты (`WallDims | { from: 'spell' }`, `wallAreaOf`), секции с `breach`, литеральный `scale.by`, `ActionSpec` (`count`/`shrinkFeet`/`defKey`); мигрированы Thorns, Ice,
Force, Stone, Light (35 спеков, все 9 стен);
- батч carrier'ов `choices`: `Leveled<T>` (круг каста), гейты `wakeOnDamage`/`turnDodge`/`takesExtraDamage`, `markSaved`, вложенные эффекты действий; мигрированы Eyebite и Bestow Curse — `choices` закрыт (37 спеков);
- батч `hooks` (damageHooks): `HookSpec`
(retaliate/damageReduce/elementalBane/takesExtraDamage/wakeOnDamage/saveOnDamage/breakOn/sanctuary/deathWard/damageLink/tempHp/noHeal/maximizeHealing/deathSaveAdvantage/saveNoDamage/dominates/ward/damageReaction),
`ValueExpr` (`upcastFlat`/`sum`); регрупп 7 спеков + мигрированы Armor of Agathys, Shadow of Moil, Invisibility, Greater Invisibility, Death Ward (42 спека); билдеры и каталожные записи удалены;
- батч `movement`: `UtilitySpec` (ссылки в blockedDamage/fromBurst), `MovementSpec`/`EffectMovementSpec`, `AutomationSpec.utility`/`targets`; мигрированы Misty Step, Scatter, Far Step, Dimension Door, Thunder Step, Steel
Wind Strike (48 спеков), билдеры/каталог удалены;
- батч `selection` (начало): `chain` (`jumps` — ссылка) и `burst` (Ice Knife); мигрированы Chain Lightning и Ice Knife (50 спеков), билдеры удалены; `burst` читается и веткой сейва (вспышка вокруг каждой цели);
- батч `vision` (начало): `EffectSpec.senses`/`seesInvisible` (+ гейты `{ if, then }`); мигрированы Light, Continual Flame, Darkvision, See Invisibility, Pass without Trace, Silence, Darkness, Fog Cloud (58 спеков),
каталожные записи удалены;
- батч смайтов: `AutomationSpec.force`, `EffectSpec.conditionImmunities`/`banish`, `ValueExpr.join`; мигрированы 9 XPHB-смайтов (67 спеков), билдер удалён;
- `selection` добор: `mark`/`markTarget`/`retarget` (Hex/Hunter's Mark), `targets` (Bless/Bane), `autoTargets` (Beacon of Hope), `side`+`$spell` (Spirit Guardians, Conjure Woodland Beings, `baseActionId`),
`requiresCreatureTypes`/`saveAdvantageInCombat`+`Leveled<null>` (Dominate Beast/Person), Telekinesis (utility + носитель-действие) — 77 спеков, `derived` не менялся, билдеры удалены. Батч `selection` закрыт.
- каталог закрыт на спеках: `zone`-локации (Daylight/Moonbeam/Flaming Sphere/Faithful Hound/Crusader's Mantle/Holy Weapon), `escape`/`escalate` (Web/Sleep), `endConditions` (Protection from Poison/Lesser Restoration),
`shape`/`saveSuccess`/`conditionImmunitiesFrom`/флаги движения (Polymorph/Freedom of Movement/Protection from Evil and Good/Otto/Primordial Ward/Fount of Moonlight); в `AUTOMATION_SPELLS` — только manual/chip.
- слой добавок снесён: Shocking Grasp/Chill Touch — attack-спеки с райдером (`restrictions.noOpportunityAttacks`/`triggers.healReceived.preventHeal`), Cure Wounds/Healing Word/Mass Healing Word/Mass Cure Wounds (heal
`abilityMod` + `types`, `targets: 6`), Prayer of Healing (`targets: 5`), Harm (`AutomationSpec.maxHpFromDamage`); `AUTOMATION_ADDITIONS`/`AutomationAddition`/`withAdditions`/`healAbilityMod`-мутация и
`withSpellDice`/`resolveZoneDice` удалены, `derived` не менялся (`21dcc4e4cec47878`).
- класс 2 аудита (точки расширения): выборы — адресация по id (`{ref:'choice', choice}`, `optional` включается только явным вариантом этого выбора), словари опций (`damageType`/`condition`/`ability`/`skill`) проверяет
`validateSpec`, `spellVariantDef` резолвит `extends`-копии (селект кастомного спелла); замок зеркала `UtilitySpec.multiplier/thenMove` (Мантия вдохновения) — тесты `automation.spec.test.ts`, `derived` не менялся.
`ref:'characterLevel'` и `ZoneWallDef.resistances` по решению владельца не покрывались.
- класс 3 аудита (дубли): удалены `header.remarkAction`/`header.zoneMoveAction` (мёртвый runtime-слой, универсальный путь — `ActionSpec`) и `LoadoutAugment.ranged` (дубль `ModifierFilter.attackType`, Flame Arrows
объявляет его напрямую); `validateSpec` даёт ошибку на `baseActionId`+payload и дособирает refs `saveSuccess`/`zone.actions`. Отложено: `CompositeConfig.upcast/onFail/zone` — срез B (тултипы из спеков); роль `'choice'` в
данных `damage.parts` — снять при следующей регенерации `npm run spells`.
- срез B: `spellDamageParts` выводится из ролей частей данных (`main` — составной; одна `main` + `trigger` другого типа — Ice Knife/Wall of Thorns; меньше двух строк — данные карточки), типы-выборы — в порядке спековых
`choices`; `COMPOSITE_CONFIGS`/`CompositeConfig`/`CompositePart` и ключевые хардкоды (Ice Knife/Wall of Thorns/Jallarzi) удалены, свип всех 420 ключей — нулевой diff, `derived` не менялся.
- Haste RAW (сессия 23): `EffectSpec.onEnd` (вялость при снятии: `rounds: 2`, скорость ×0, запрет действий/бонусных/реакций; во всех путях снятия, кроме замены при перекасте) + преимущество на спас DEX; `derived` изменён
осознанно (`70802ac175f12af1`).
- срез A `triggers`: блок эффекта `triggers` (`EffectTriggers`) — единый словарь событий × операции (`damaged`/`healReceived`/`hpReachedZero`/`deathSave`/`saveSucceeded`/`targetedByAttack`/`own*`/`willingMove` +
тёрн-слоты) вместо прежних `hooks`/`triggers`; `tempHp`/`dominates` вынесены в поля эффекта, `willingMove` зарезервирован под B (Booming Blade пока в `weaponAttack.hitEffect`); компилируется в те же поля
`AutomationEffect`, рантайм не менялся, `derived` не менялся.
- срез B (рантайм триггеров): `EffectInstance.triggers: TriggerInstance[]` — 16 именованных полей хуков удалены из рантайма
(`retaliate`/`damageReduce`/`elementalBane`/`takesExtraDamage`/`wakeOnDamage`/`saveOnDamage`/`breakOn`/`sanctuary`/`deathWard`/`damageLink`/`noHeal`/`maximizeHealing`/`deathSaveAdvantage`/`saveNoDamage`/`ward`/`damageReaction`/`onWillingMove`);
потребители — через `triggersOn`/`triggerOn`/`hasTrigger` (`rules/effects.ts`), сводка чипов — по триггерам; сохранённые комнаты старой формы хуки не восстанавливают (решение владельца, без миграции). Срез C: те же поля
удалены и из `AutomationEffect` — `compileTriggers` пишет `triggers` напрямую (включая тёрн-слоты и `weaponAttack.hitEffect.triggers`), `effectFieldsFromDef` только копирует массив; характеризация обновлена осознанно
(`derived e4ae27231c5f3319`, форма IR), `catalog`/green/red не менялись; аудит показал и починил скрытый баг — `featureAutomation` (turnUndead) писал легаси `wakeOnDamage` мимо типов.
- билдеры закрыты: `lifesteal`/`lifeTransfer`, `UtilitySpec.dice`, `area`, `halfOnMiss`/`successDamage`/`undeadTempHp`/`heal`, effect `triggers`/`selfOnFail`/`maxHpBonus`,
`ActionSpec.banishOnFail`/`requiresCreatureTypes`; мигрированы все билдеры, `derived` не менялся, `BUILTIN_AUTOMATION`/`spellBuiltinAutomated` удалены, `builders.ts` → `helpers.ts` (хелперы костей).
- шаг 4, срез 1 (прототип `materialize`, ничего не переключено): `materializeSpell`/`materializeAutomation` (`shared/src/rules/automation/materialize.ts`) собирают `SpellDef = meta + automation` из `spells.json` +
`AUTOMATION_SPECS`; `key`/`name` только в meta, копии (`extends`) слиты, `WALL_DIMS` по ключу развёрнут в литералы записи (ссылки `{ ref: ... }`/`{ from: 'spell' }` на meta остаются). Замок
`automation.materialize.test.ts`: для 162 спеков `compileSpec(meta + automation)` байт-в-байт равен `automationForSpell` на свипе 9 кругов × 5 уровней персонажа × варианты × spellMod, стены компилируются при удалённых
ключах `WALL_DIMS`; остальные 258 пока без `automation` (fallback каталог/призывы/деривация/manual). Генерация — `npm run catalog` → gitignored `artifacts/catalog.json` (420 записей, hash `85a05494d9c809e8`).
- шаг 4, срез 2 (валидация): JSON-Schema `automation/schema.ts` + ajv (root devDependency; subpath `shared/automationSchema`); `automation.schema.test.ts` — все 162 спека и все материализованные автоматизации валидны,
негативы (неизвестное поле, битый enum/тип, лишние `key`/`name` в записи) отклоняются; `npm run catalog` валидирует записи перед записью. `validateSpec` дополнен `utility без utility.kind` и `shape без shape`;
`compileSpec` по-прежнему бросает на невалидном спеке.
- шаг 4, срез 3 (гэпы 1–3): (1) блок `manual` (`byDesign`/`chip`/`chipActions`): 22 manual-замка + 4 chip переведены из `AUTOMATION_SPELLS` в `specs/manual.ts`, рантайм-каталог удалён, `spellByDesign` читает
`spec.manual`; def-имя Tenser's приведено к каноническому 'Transformation' (переименование 5e.tools PI). (2) блок `summon` (`creature`/`fromFamiliar`/`count`/`duration`/`initiative`/`baseLevel`; `concentration` — из
меты) — 12 призывов в `specs/summons.ts`, `SUMMON_SPELLS`/`summonSpellDef` удалены. (3) деривация: `materialize` генерирует спек для всех записей без реестрового (`spellDamage`/`spellAttackCount`/литеральные
типы/`healing`/`save`/`manual`), пустой `types` не пишется; `AutomationSpec.count` — `ValueExpr`; инвокации ELB — патчи по именованным путям (`INVOCATION_MECHANICS[].patches`: `automation.damage.abilityMod`,
`automation.force`, `meta.range.distance.amount`), `eldritchBlastMods`/`withBlastMods`/ключевые проверки удалены, `applyPatch` (опциональный `add`) — общий язык с копиями `extends`. `materialize` покрывает все 420
записей, характеризация обновлена осознанно (`derived 33c2ac8fbd6b405c`: `types: []` → отсутствие).
- шаг 4, срез 4 (канон переключён): единая запись `SpellDef = meta + automation` — `npm run catalog` пишет `shared/src/data/catalog.json` (канон, источник `spellsData`; `spells.json` — только мета-снимок, после `npm run
spells` нужен `npm run catalog`); `automationForSpell` читает `spell.automation` (без реестра/деривации), `resolveSpec` остаётся только для импорта кастомов; data-флаг `Spell.automation: 'full'|'manual'` снят из
типа/нормализатора/`build-spells`; `spellAutomated`/`spellByDesign`/`spellVariantDef` читают запись. Deploy-замок: hash `catalog.json` (`ba3454c758880378`) + сверка с `spells.json`; характеризация без сдвига (`derived
33c2ac8fbd6b405c`).

- шаг 4, срез 5 (кастомы комнаты): формат — `room.customSpecs` (не отдельный файл): записи `CUSTOM:` хранятся в комнате вместе с `data/rooms/<code>.json`, импорт/удаление — только DM (`custom:import`/`custom:remove`),
запись рассылается всем (`room:customSpecs`) — по ней кастуют и игроки. Вход импорта: копия `{ extends, key?, name, patch?, remove? }` (база — канон или уже импортированная запись; meta наследуется) либо полная запись
(экспорт 1:1). Резолв — `server/src/customSpells.ts`: `importCustomSpell` = `resolveSpec` → JSON-Schema (`MATERIALIZED_AUTOMATION_SCHEMA`) → `validateSpec` → пробный `compileSpec` (ошибка — `chat:error customInvalid`,
без записи); в комнате канон хранит слитую запись. Резолв каста — `findSpell(key, room)` (сначала кастомы), room-aware и в реакциях/диспеле/зонах/смайтах; `SpellSource` дополнен `'CUSTOM'`; клиент — `useSpells` мержит
`room.customSpecs`, пикер и `SpellIcon` метят `CUSTOM:` («+/кастом»), в настройках комнаты — список с экспортом-скачиванием и удалением. `resolveSpec` остаётся только слоем импорта/авторинга. Замки:
`server/src/socket/custom.test.ts` (копия Jallarzi → огонь+паралич, каст, права, ошибки, replace/remove, персистентность), smoke `19-custom` (импорт → каст с холодом → удаление → `spellNotFound`).
