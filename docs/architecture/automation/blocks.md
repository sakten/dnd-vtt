# AutomationSpec: блоки

Назад: [AUTOMATION.md](../../../AUTOMATION.md).

## 3. Блоки

### 3.1. `loadout` — оружие и атаки (выделяется)
Сегодня одна механика в пяти представлениях:
- `weaponAttack` `{riderDice, replace, anyWeapon, spellAbility, secondary, hitEffect}` — каст-тайм райдер: True Strike, Green-Flame/Booming Blade, Hail of Thorns, Lightning Arrow;
- `weaponOverride` `{weapons, dice, damageType, abilityMod}` — Shillelagh;
- `shadowBlade` `{dice, inHand}` + действие `recallWeapon` — Shadow Blade (`rules/loadout.ts` инжектит атаки);
- `magicWeapon` + модификаторы `filter.weapon` + `charges` — Magic Weapon, Elemental Weapon, Flame Arrows;
- выданные attack-`def`: Flame Blade, Magic Stone, лучи Sunbeam/Wall of Light, удары зон (Spiritual Weapon, Conjure Fey).

Стратегии блока: `augment` (подмена/бонус существующего оружия), `inject` (синтетическое оружие в лоадаут), `rider` (добавка к атаке при касте), `grant` (выданное attack-действие).

### 3.2. `triggers` — перехват урона и HP (единый словарь событий × операции; рантайм R14 — отдельно)

`EffectSpec.triggers: EffectTriggers` — одно поле на эффект: ключ — событие рантайма, значение — операция или список операций (элемент может быть под гейтом `{ if, then }`). Спелл ссылается на событие, а не заводит
именованное поле под механику.

- `damaged` (входящий урон): `damage` (ответ атакующему, `to:'source'` — Armor of Agathys, Fire Shield, Shadow of Moil), `reduce` (Resistance), `extraDamage` (`oncePerTurn` — Elemental Bane; `from:'source'` — Spirit
Shroud, CME), `redirect:'linked'` (Warding Bond), `endEffect` (пробуждение Sleep/Eyebite/Hypnotic Pattern), `repeatSave` (Hideous Laughter, Dominate), `reaction` (`kind:'ward'` — Primordial Ward; `kind:'saveCondition'` —
Fount of Moonlight);
- `healReceived` (`preventHeal` — Chill Touch; `maximizeHeal` — Beacon of Hope), `hpReachedZero` (`survive {hp:1}` — Death Ward), `deathSave` (Beacon of Hope), `saveSucceeded` (`noDamageOnSuccess` — Circle of Power),
`targetedByAttack` (спас + `cancel` — Sanctuary);
- `ownAttackRoll`/`ownSpellCast`/`ownDamageDealt` (`endEffect` — обрыв Invisibility/Sanctuary), `willingMove` — зарезервирован под B-срез (Booming Blade пока в `weaponAttack.hitEffect.onWillingMove`);
- `startOfTurn`/`endOfTurn` — тёрн-слоты (`EffectTriggerSpec`: `tempHp`/`damage`), живут в том же объекте.

`tempHp` (Armor of Agathys) и `dominates` (Dominate Beast/Person) — поля самого эффекта: это состояние при наложении, а не реакция на событие. Поток HP вне триггеров: `lifesteal` (Vampiric Touch), `lifeTransfer`,
`maxHpFromDamage` (Harm), `undeadTempHp` (Negative Energy Flood), `healTo` (Aura of Life), `maxHpBonus`.

Порядок критичен — фиксируется тестами; целевой диспетчер — `gateAttackOnTarget` (до окна реакций) и `afterDamage` (после урона), окна реакций (`ward`/Absorb Elements) остаются в `reactions/*`.
Реализовано (`EffectTriggers`, компилируется в триггеры): реактивные перехваты сведены в единый словарь (A-срез, рантайм не менялся). Мигрированы: Fire Shield, Resistance, Elemental Bane, Spirit Shroud, CME, Eyebite,
Bestow Curse, Armor of Agathys, Shadow of Moil, Invisibility, Greater Invisibility, Death Ward, Hideous Laughter, Hypnotic Pattern, Sleep, Chill Touch, Sanctuary, Warding Bond, Beacon of Hope, Dominate Beast/Person,
Circle of Power, Primordial Ward, Fount of Moonlight.
Срез R14: диспетчеры — `server/src/socket/triggers.ts`: `gateAttackOnTarget` (одна точка Sanctuary вместо 4 вызовов, оружие + вредные заклинания per-target), фазы `beforeDamage`/`afterDamage` события `damaged` через
**реестр шагов** (`DAMAGE_STEPS`, порядок — контракт): before — Resistance → карточка → сообщение снижения → Elemental Bane; after — Warding Bond → триггеры монстра («урон»/«смерть») → обрыв `ownDamageDealt`. hp-level
операции (wake/Death Ward/repeatSave) остаются в HP-пайплайне и зажигаются только событием урона (`applyHp(..., { damageEvent: true })` из `applyDamage`/переноса Warding Bond), а не ручными правками HP мастера
(`token:hp`) — контракт закреплён тестом.

### 3.3. `uses` — заряды и счётчики (выделяется)
`effect.charges {count, on}` (Flame Arrows — 12 боеприпасов, Magic Stone — 3 камня, Resistance), `charges.on: 'rangedWeaponAttack'`, `zone.charges` (Cordon of Arrows, Healing Spirit), `zone.dealtLimit` (Guardian of Faith
— 60), `misdirect.charges` (Mirror Image), `bonusDieUses` (Бардовское вдохновение), `consumeOnAttackRoll` (Zephyr Strike), `elementalBane.usedTurn`. Общий вид: `uses: { count, spendOn, endsWhen, replenish }`.

Реализовано (`UsesSpec`): `charges` (count + `on`), `consumeOnAttack` (Zephyr Strike), `misdirect` (Mirror Image) — компилируются в существующие поля эффекта, пока серверные потребители не унифицированы. Мигрированы:
Flame Arrows, Magic Stone, Resistance, Zephyr Strike, Mirror Image; зонные счётчики — Guardian of Faith (`dealtLimit`), Cordon of Arrows (`charges: perLevel`), Healing Spirit (`charges: spellMod`).

### 3.4. `movement` — перемещение (выделяется)
`force` (push/pull: Repelling Blast, Thunderwave), `utility.teleport` (+`passenger`/`blockedDamage`/`ignoreSight`, Thunder Step `fromBurst`), `teleportAfter` (Steel Wind Strike), `scatter`, `telekinesis` (`placements`),
`utility.moveZone` (Moonbeam/Spiritual Weapon), `onWillingMove` (Booming Blade), `ignoresDifficultTerrain`/`immuneToSpeedReduction` (Freedom of Movement), модификаторы скорости (Longstrider, Zephyr Strike). Стратегии:
`teleport | push | pull | scatter | moveZone | punishMove`.

Реализовано: `UtilitySpec` (кости `blockedDamage`/`fromBurst` — ссылки), `MovementSpec` (`teleportAfter`) и `EffectMovementSpec` (`zephyrStrike`); `AutomationSpec.utility`/`targets`; мигрированы Misty Step, Scatter, Far
Step, Dimension Door, Thunder Step, Steel Wind Strike (+ Zephyr Strike под `movement`); `force`/`onWillingMove`/медленностные флаги — по мере миграции остальных (Repelling Blast — инвокация, Thunderwave/FoM — дальше).

### 3.5. `choices` — выбор при касте (выделяется)
Сейчас отдельный реестр `SPELL_VARIANTS` (18 заклинаний): `damageType` (Dragon's Breath, Destructive Wave, Elemental Weapon, Resistance, Protection from Energy, Spirit Shroud, CME, True Strike, Elemental Bane), `effect`
(Eyebite, Blindness/Deafness, Bestow Curse, Fire Shield, формы стен), `ability` (Enhance Ability), `skill` (Skill Empowerment), `command` (Command). Сюда же — формы Polymorph/призывов.

Блок: `choices: [{ id, param, options, default? }]`; `param` — типизированный enum, значение подставляется ссылками в `DiceRef.types`, `effect.conditions`, `ability`, `zone.area` (форма стены). Клиент выбирает вариант в
`SpellPopover`, сервер валидирует (`spellResolve`).

Реализовано: `ChoiceSpec` + `ModifierSpec` (`value`/`filter.damageType|ability|skill` — ссылки), условия/элементы `triggers` (`damage`/`extraDamage`/`endEffect`)/`turnDodge` и действия
(`save`/`area`/`damage.types`/`effects`) принимают ссылки и гейты `{ if, then }`, `Leveled` для круга каста. Мигрированы все носители `SPELL_VARIANTS`: Elemental Weapon, Resistance, Elemental Bane, Protection from
Energy, Blindness/Deafness, Fire Shield, Dragon's Breath, Command, Enhance Ability, Skill Empowerment, Spirit Shroud, CME, Eyebite (carrier с 3 действиями, `markSaved`), Bestow Curse (режимы, `turnDodge`,
`Leveled`-длительность). Реестр `SPELL_VARIANTS` удалён: `spellVariantDef` читает `choices` спеков (единый источник для UI и валидации).

Опции выборов — из фиксированных словарей: `damageType` (`DAMAGE_TYPES` + сентинел `weapon` — True Strike), `condition`, `ability`, `skill` проверяет `validateSpec` (кастомные значения не вводятся);
`mode`/`effect`/`command` задаёт базовый спек. Копии (`extends`) сужают/переставляют опции (`patch: {'choices.<id>.options': [...]}`), `spellVariantDef` резолвит копии — селект кастомного спелла виден в UI. Адресация
значения — `{ref:'choice', choice:'<id>'}` (без `id` — первый выбор); `optional` включается только явным вариантом этого выбора. UI показывает первый выбор; мультивыбор — задел конструктора (`spellVariantDef` + контракт
`variants: Record<id,string>` в будущем), сегодня все спеки одно-выборочные.

### 3.6. `selection` — как выбираются цели (выделяется)
- `mode`: `single` / `multi` (`targets`, `targetsAbility`) / `area` (`areaSpec`, `origin`) / `chain` (`jumps`, `feet`) / `scatter` / `radius` (`radiusFeet`, `autoTargets`);
- `filters`: `side`, `excludeCreatureTypes`, `requiresCreatureTypes`, `containment`;
- метки: поля `mark`/`markTarget`/`markSaved` остаются в `effects` (компилируются в `EffectInstance` с `filter.targetId`); `retarget` (Hex/Hunter's Mark) — операция `selection` над меткой.

Реализовано: `chain` (`jumps: ValueExpr` — Chain Lightning: 3 + круг − 6) и `burst` (Ice Knife: `2d6cold`, спас DEX, `includePrimary`); `burst` читается и веткой атаки (луч/райдер), и веткой сейва (вспышка вокруг каждой
цели, независимо от исхода её сейва); метки — `EffectSpec.mark`/`markTarget` + `ActionSpec.retarget` (Hex/Hunter's Mark), мультивыбор — `effect.targets` (Bless/Bane), авто-цели — `AutomationSpec.autoTargets` (Beacon of
Hope), сторона — `AutomationSpec.side` + `$spell` через `{ref:'spellDamage'}` (Spirit Guardians, Conjure Woodland Beings, `ActionSpec.baseActionId`); фильтры типов — `requiresCreatureTypes`/`saveAdvantageInCombat`
(Dominate Beast/Person), Телекинез — `utility` + носитель-действие (Hail of Thorns/Lightning Arrow — спеки смайтов, к `selection` не относятся). Батч закрыт: 77 спеков.

Часть правил уже в `shared/src/rules/targeting.ts`; блок описывает только декларацию, выбор остаётся за `interaction.ts`/клиентом.

### 3.7. `vision` — свет, сенсы, скрытие (выделяется)
Общий блок эффекта и зоны: `light` (Light, Moonbeam, Flame Blade), `senses` (Darkvision, Devil's Sight), `seesInvisible` (See Invisibility), `obscures` (zone flag `obscured`), `blocksLight` (Darkness/Fog Cloud),
`silence` (Silence, Jallarzi). Компилируется в те же поля `EffectInstance`/`ZoneInstance`; правила — `rules/vision.ts`.

Реализовано (начало батча): `EffectSpec.senses`/`seesInvisible` с гейтами; мигрированы Light, Continual Flame (свет 20/20), Darkvision (150 фт, 8 ч), See Invisibility, Pass without Trace (аура 30 фт, +10 Скрытность),
Silence, Darkness, Fog Cloud. `light` и флаги зон (`blocksLight`/`obscured`/`silence`) — pass-through, уже работали.

### 3.8. Существующие блоки (не меняются)
- `zone` (`ZoneDef`): area/origin/duration/anchor/aura/triggers/onCreate/charges/dealtLimit/actions/wall/flags — уже самостоятельный блок с под-механизмами; в спеке — `ZoneSpec` (pass-through + `ValueExpr` в
charges/триггерах через `PayloadSpec`); стены — параметрически: `zone.area: { wall: WallDims | { from: 'spell' } }` (`wallAreaOf(dims, variant)`, габариты — `WALL_DIMS`), секции — `zone.wall` (+`breach: PayloadSpec`),
общий шаблон `wallZone(...)` в `specs/factories.ts` (шапка + параметры: триггеры/секции/флаги/свет/действия);
- `effects` (`AutomationEffect`): длительности, условия, модификаторы, ограничения, триггеры, реактивности (в `triggers`), выданные действия; `onEnd` — эффект при снятии носителя (Haste: «вялость») — применяется во всех
путях снятия, кроме замены одноимённого эффекта при перекасте;
- `utility` (`kind` — готовый образец «блока со стратегиями», 21 значение);
- `summon`, `shape`, payload (`save`/`damage`/`heal`/…).

### 3.9. Не выделяются
- `economy` (`restrictions`, стоимость выданных действий, `extraAction`/`extraMovement`/`extraAttacks`/`disengage`) — остаётся в `Restrictions` + `GrantedAction` + `utility`;
- `defense` (`conditionImmunities*`, `saveNoDamage`, `deathSaveAdvantage`) — пересекается с `triggers`/`effects`;
- `triggers`/`timing` — приводится к одному формату payload + слот (`startOfTurn`/`endOfTurn`/`enter`/`exit`/`onCreate`), отдельным классом не является.
