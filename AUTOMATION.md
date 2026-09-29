# AUTOMATION.md — AutomationSpec: дизайн (R16, шаг 2)

Карточка — `REFACTOR.md` (R16); карта кода — `ARCHITECTURE.md`; контракт веток исполнителя — `server/src/socket/automation/dispatch.ts` + `dispatch.test.ts`.

Документ фиксирует модель до написания типов: **спелл — композиция блоков с одной ведущей веткой**. Рантайм не меняется: `AutomationDef` остаётся целевым форматом, `AutomationSpec` компилируется в него, характеризационный замок (`automation.characterization.test.ts`) гарантирует, что миграция не меняет механику.

## 1. Модель

- **Ветка (`primary`)** — как спек разрешается рантаймом; ровно одна. Объявленный `AutomationResolution`: `attack | save | auto | effect | utility | summon | shape | manual`. `shape` допустим только вместе с `save` (Polymorph); Wild Shape — отдельный socket-flow (`server/src/socket/forms.ts`).
- **Блоки** — механизмы, ортогональные ветке. Существующие: `zone`, `effects`, `summon`, `utility`, payload (`save`/`damage`/`heal`/`successDamage`/`endConditions`/`healTo`/`containment`). Выделяются явно: `loadout`, `triggers`, `uses`, `movement`, `choices`, `selection`, `vision`.
- **Вложенность**: `GrantedAction.def` — полноценный спек (своя ветка); `zone.triggers.*`, `effect.triggers.*`, `burst`, `zone.onCreate` — общий payload; блок `uses` расходуется событиями.

Обоснование (аудит 420 заклинаний): 66 из 245 зелёных многосоставные — Ice Knife (attack + burst), Jallarzi (save + zone:aura + triggers), Wall of Light (save + zone + granted action), Eyebite (carrier + 3 действия со своими save), Polymorph (save + shape); механика копий (`extends` + `patch`) требует дерева именованных узлов.

## 2. Ветки: контракт диспетчера

Порядок веток — контракт (менять только сознательно, с обновлением `dispatch.test.ts`):

| # | Ветка | Условие выбора | Примеры |
|---|---|---|---|
| 1 | `utility` | `resolution:'utility'` + `utility` | Misty Step, False Life (tempHp), Scatter, Revivify, Telekinesis, Dispel Magic |
| 2 | `summon` | `resolution:'summon'` + `summon` | Find Familiar, Summon-* |
| 3 | `effect` | `resolution:'effect'` + непустые `effects` | Bless, Shield of Faith, Spirit Guardians, Eyebite, Shadow Blade |
| 4 | `lifeTransfer` | `lifeTransfer` (приоритетнее атаки/спаса) | Life Transference |
| 5 | `attack` | `attack` + статы кастера | Scorching Ray, Steel Wind Strike, GFB, Hail of Thorns |
| 6 | `healOrDamage` | `save` + `heal` + `damage` | редкая комбинация (см. `dispatch.test.ts`) |
| 7 | `save` | `save` + статы | Fireball, Hold Person, Polymorph, Banishment |
| 8 | `auto` | есть `effects`, нет `save`/`attack` | авто-эффекты без спасброска |
| 9 | `manual` | нет выражения урона/лечения и других веток | ручные замки (`byDesign`), ложные деривации |
| 10 | `multi` | `targets > 1` (финальная) | массовые цели без области |
| 11 | `single` | дефолт | одиночная цель |

До диспетчера — общие стадии: сбор целей (`autoTargets` → `side` → `excludeCreatureTypes`), гейт фамильяра, `fx:play`, снятие старой концентрации, создание зоны, self-эффекты (кроме `selfOnFail`), якорь зоны.

`multi`/`single`/`healOrDamage` не объявляются в спеке — они следствие состава блоков (`selection`, payload). `manual` — единственный escape hatch.

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

`EffectSpec.triggers: EffectTriggers` — одно поле на эффект: ключ — событие рантайма, значение — операция или список операций (элемент может быть под гейтом `{ if, then }`). Спелл ссылается на событие, а не заводит именованное поле под механику.

- `damaged` (входящий урон): `damage` (ответ атакующему, `to:'source'` — Armor of Agathys, Fire Shield, Shadow of Moil), `reduce` (Resistance), `extraDamage` (`oncePerTurn` — Elemental Bane; `from:'source'` — Spirit Shroud, CME), `redirect:'linked'` (Warding Bond), `endEffect` (пробуждение Sleep/Eyebite/Hypnotic Pattern), `repeatSave` (Hideous Laughter, Dominate), `reaction` (`kind:'ward'` — Primordial Ward; `kind:'saveCondition'` — Fount of Moonlight);
- `healReceived` (`preventHeal` — Chill Touch; `maximizeHeal` — Beacon of Hope), `hpReachedZero` (`survive {hp:1}` — Death Ward), `deathSave` (Beacon of Hope), `saveSucceeded` (`noDamageOnSuccess` — Circle of Power), `targetedByAttack` (спас + `cancel` — Sanctuary);
- `ownAttackRoll`/`ownSpellCast`/`ownDamageDealt` (`endEffect` — обрыв Invisibility/Sanctuary), `willingMove` — зарезервирован под B-срез (Booming Blade пока в `weaponAttack.hitEffect.onWillingMove`);
- `startOfTurn`/`endOfTurn` — тёрн-слоты (`EffectTriggerSpec`: `tempHp`/`damage`), живут в том же объекте.

`tempHp` (Armor of Agathys) и `dominates` (Dominate Beast/Person) — поля самого эффекта: это состояние при наложении, а не реакция на событие. Поток HP вне триггеров: `lifesteal` (Vampiric Touch), `lifeTransfer`, `maxHpFromDamage` (Harm), `undeadTempHp` (Negative Energy Flood), `healTo` (Aura of Life), `maxHpBonus`.

Порядок критичен — фиксируется тестами; целевой диспетчер — `gateAttackOnTarget` (до окна реакций) и `afterDamage` (после урона), окна реакций (`ward`/Absorb Elements) остаются в `reactions/*`.
Реализовано (`EffectTriggers`, компилируется в триггеры): реактивные перехваты сведены в единый словарь (A-срез, рантайм не менялся). Мигрированы: Fire Shield, Resistance, Elemental Bane, Spirit Shroud, CME, Eyebite, Bestow Curse, Armor of Agathys, Shadow of Moil, Invisibility, Greater Invisibility, Death Ward, Hideous Laughter, Hypnotic Pattern, Sleep, Chill Touch, Sanctuary, Warding Bond, Beacon of Hope, Dominate Beast/Person, Circle of Power, Primordial Ward, Fount of Moonlight.
Срез R14: диспетчеры — `server/src/socket/triggers.ts`: `gateAttackOnTarget` (одна точка Sanctuary вместо 4 вызовов, оружие + вредные заклинания per-target), фазы `beforeDamage`/`afterDamage` события `damaged` через **реестр шагов** (`DAMAGE_STEPS`, порядок — контракт): before — Resistance → карточка → сообщение снижения → Elemental Bane; after — Warding Bond → триггеры монстра («урон»/«смерть») → обрыв `ownDamageDealt`. hp-level операции (wake/Death Ward/repeatSave) остаются в HP-пайплайне и зажигаются только событием урона (`applyHp(..., { damageEvent: true })` из `applyDamage`/переноса Warding Bond), а не ручными правками HP мастера (`token:hp`) — контракт закреплён тестом.

### 3.3. `uses` — заряды и счётчики (выделяется)
`effect.charges {count, on}` (Flame Arrows — 12 боеприпасов, Magic Stone — 3 камня, Resistance), `charges.on: 'rangedWeaponAttack'`, `zone.charges` (Cordon of Arrows, Healing Spirit), `zone.dealtLimit` (Guardian of Faith — 60), `misdirect.charges` (Mirror Image), `bonusDieUses` (Бардовское вдохновение), `consumeOnAttackRoll` (Zephyr Strike), `elementalBane.usedTurn`. Общий вид: `uses: { count, spendOn, endsWhen, replenish }`.

Реализовано (`UsesSpec`): `charges` (count + `on`), `consumeOnAttack` (Zephyr Strike), `misdirect` (Mirror Image) — компилируются в существующие поля эффекта, пока серверные потребители не унифицированы. Мигрированы: Flame Arrows, Magic Stone, Resistance, Zephyr Strike, Mirror Image; зонные счётчики — Guardian of Faith (`dealtLimit`), Cordon of Arrows (`charges: perLevel`), Healing Spirit (`charges: spellMod`).

### 3.4. `movement` — перемещение (выделяется)
`force` (push/pull: Repelling Blast, Thunderwave), `utility.teleport` (+`passenger`/`blockedDamage`/`ignoreSight`, Thunder Step `fromBurst`), `teleportAfter` (Steel Wind Strike), `scatter`, `telekinesis` (`placements`), `utility.moveZone` (Moonbeam/Spiritual Weapon), `onWillingMove` (Booming Blade), `ignoresDifficultTerrain`/`immuneToSpeedReduction` (Freedom of Movement), модификаторы скорости (Longstrider, Zephyr Strike). Стратегии: `teleport | push | pull | scatter | moveZone | punishMove`.

Реализовано: `UtilitySpec` (кости `blockedDamage`/`fromBurst` — ссылки), `MovementSpec` (`teleportAfter`) и `EffectMovementSpec` (`zephyrStrike`); `AutomationSpec.utility`/`targets`; мигрированы Misty Step, Scatter, Far Step, Dimension Door, Thunder Step, Steel Wind Strike (+ Zephyr Strike под `movement`); `force`/`onWillingMove`/медленностные флаги — по мере миграции остальных (Repelling Blast — инвокация, Thunderwave/FoM — дальше).

### 3.5. `choices` — выбор при касте (выделяется)
Сейчас отдельный реестр `SPELL_VARIANTS` (18 заклинаний): `damageType` (Dragon's Breath, Destructive Wave, Elemental Weapon, Resistance, Protection from Energy, Spirit Shroud, CME, True Strike, Elemental Bane), `effect` (Eyebite, Blindness/Deafness, Bestow Curse, Fire Shield, формы стен), `ability` (Enhance Ability), `skill` (Skill Empowerment), `command` (Command). Сюда же — формы Polymorph/призывов.

Блок: `choices: [{ id, param, options, default? }]`; `param` — типизированный enum, значение подставляется ссылками в `DiceRef.types`, `effect.conditions`, `ability`, `zone.area` (форма стены). Клиент выбирает вариант в `SpellPopover`, сервер валидирует (`spellResolve`).

Реализовано: `ChoiceSpec` + `ModifierSpec` (`value`/`filter.damageType|ability|skill` — ссылки), условия/элементы `triggers` (`damage`/`extraDamage`/`endEffect`)/`turnDodge` и действия (`save`/`area`/`damage.types`/`effects`) принимают ссылки и гейты `{ if, then }`, `Leveled` для круга каста. Мигрированы все носители `SPELL_VARIANTS`: Elemental Weapon, Resistance, Elemental Bane, Protection from Energy, Blindness/Deafness, Fire Shield, Dragon's Breath, Command, Enhance Ability, Skill Empowerment, Spirit Shroud, CME, Eyebite (carrier с 3 действиями, `markSaved`), Bestow Curse (режимы, `turnDodge`, `Leveled`-длительность). Реестр `SPELL_VARIANTS` удалён: `spellVariantDef` читает `choices` спеков (единый источник для UI и валидации).

Опции выборов — из фиксированных словарей: `damageType` (`DAMAGE_TYPES` + сентинел `weapon` — True Strike), `condition`, `ability`, `skill` проверяет `validateSpec` (кастомные значения не вводятся); `mode`/`effect`/`command` задаёт базовый спек. Копии (`extends`) сужают/переставляют опции (`patch: {'choices.<id>.options': [...]}`), `spellVariantDef` резолвит копии — селект кастомного спелла виден в UI. Адресация значения — `{ref:'choice', choice:'<id>'}` (без `id` — первый выбор); `optional` включается только явным вариантом этого выбора. UI показывает первый выбор; мультивыбор — задел конструктора (`spellVariantDef` + контракт `variants: Record<id,string>` в будущем), сегодня все спеки одно-выборочные.

### 3.6. `selection` — как выбираются цели (выделяется)
- `mode`: `single` / `multi` (`targets`, `targetsAbility`) / `area` (`areaSpec`, `origin`) / `chain` (`jumps`, `feet`) / `scatter` / `radius` (`radiusFeet`, `autoTargets`);
- `filters`: `side`, `excludeCreatureTypes`, `requiresCreatureTypes`, `containment`;
- метки: поля `mark`/`markTarget`/`markSaved` остаются в `effects` (компилируются в `EffectInstance` с `filter.targetId`); `retarget` (Hex/Hunter's Mark) — операция `selection` над меткой.

Реализовано: `chain` (`jumps: ValueExpr` — Chain Lightning: 3 + круг − 6) и `burst` (Ice Knife: `2d6cold`, спас DEX, `includePrimary`); `burst` читается и веткой атаки (луч/райдер), и веткой сейва (вспышка вокруг каждой цели, независимо от исхода её сейва); метки — `EffectSpec.mark`/`markTarget` + `ActionSpec.retarget` (Hex/Hunter's Mark), мультивыбор — `effect.targets` (Bless/Bane), авто-цели — `AutomationSpec.autoTargets` (Beacon of Hope), сторона — `AutomationSpec.side` + `$spell` через `{ref:'spellDamage'}` (Spirit Guardians, Conjure Woodland Beings, `ActionSpec.baseActionId`); фильтры типов — `requiresCreatureTypes`/`saveAdvantageInCombat` (Dominate Beast/Person), Телекинез — `utility` + носитель-действие (Hail of Thorns/Lightning Arrow — спеки смайтов, к `selection` не относятся). Батч закрыт: 77 спеков.

Часть правил уже в `shared/src/rules/targeting.ts`; блок описывает только декларацию, выбор остаётся за `interaction.ts`/клиентом.

### 3.7. `vision` — свет, сенсы, скрытие (выделяется)
Общий блок эффекта и зоны: `light` (Light, Moonbeam, Flame Blade), `senses` (Darkvision, Devil's Sight), `seesInvisible` (See Invisibility), `obscures` (zone flag `obscured`), `blocksLight` (Darkness/Fog Cloud), `silence` (Silence, Jallarzi). Компилируется в те же поля `EffectInstance`/`ZoneInstance`; правила — `rules/vision.ts`.

Реализовано (начало батча): `EffectSpec.senses`/`seesInvisible` с гейтами; мигрированы Light, Continual Flame (свет 20/20), Darkvision (150 фт, 8 ч), See Invisibility, Pass without Trace (аура 30 фт, +10 Скрытность), Silence, Darkness, Fog Cloud. `light` и флаги зон (`blocksLight`/`obscured`/`silence`) — pass-through, уже работали.

### 3.8. Существующие блоки (не меняются)
- `zone` (`ZoneDef`): area/origin/duration/anchor/aura/triggers/onCreate/charges/dealtLimit/actions/wall/flags — уже самостоятельный блок с под-механизмами; в спеке — `ZoneSpec` (pass-through + `ValueExpr` в charges/триггерах через `PayloadSpec`); стены — параметрически: `zone.area: { wall: WallDims | { from: 'spell' } }` (`wallAreaOf(dims, variant)`, габариты — `WALL_DIMS`), секции — `zone.wall` (+`breach: PayloadSpec`), общий шаблон `wallZone(...)` в `specs/factories.ts` (шапка + параметры: триггеры/секции/флаги/свет/действия);
- `effects` (`AutomationEffect`): длительности, условия, модификаторы, ограничения, триггеры, реактивности (в `triggers`), выданные действия; `onEnd` — эффект при снятии носителя (Haste: «вялость») — применяется во всех путях снятия, кроме замены одноимённого эффекта при перекасте;
- `utility` (`kind` — готовый образец «блока со стратегиями», 21 значение);
- `summon`, `shape`, payload (`save`/`damage`/`heal`/…).

### 3.9. Не выделяются
- `economy` (`restrictions`, стоимость выданных действий, `extraAction`/`extraMovement`/`extraAttacks`/`disengage`) — остаётся в `Restrictions` + `GrantedAction` + `utility`;
- `defense` (`conditionImmunities*`, `saveNoDamage`, `deathSaveAdvantage`) — пересекается с `triggers`/`effects`;
- `triggers`/`timing` — приводится к одному формату payload + слот (`startOfTurn`/`endOfTurn`/`enter`/`exit`/`onCreate`), отдельным классом не является.

## 4. ValueExpr (DiceRef)

Значения спека (кости, типы, бонусы) — ссылки `ValueExpr`, резолвит компилятор:

- `{ ref: 'cantrip' | 'damage' | 'part' | 'upcastDice' | 'spellDamage' | 'upcastAttack' | 'type0' | 'spellMod' | 'castLevel' | 'characterLevel' | 'choice'; part?; choice?; fallback? }` — данные заклинания, опции каста, выбор из `choices`;
- `{ add: [expr, expr] }` — сложение однотипных костей (`addDiceExpression`: `1d8` + `1d8 + 1d8` → `3d8`, без базы — добавка);
- `{ includes: { of, values } }` — гейт `'1'`/`''` для условных элементов `{ if, then }` (Command: halt/grovel);
- `{ ref: 'part', part, index?, fallback? }` — часть данных по роли и индексу (составной урон: две `main`);
- `{ ref: 'upcastFlat' }` — плоская прибавка апкаста (Armor of Agathys: +5/круг); `{ sum: [...] }` — числовая сумма (нераскрытое — 0);
- `{ ref: 'choice', optional? }` — выбор при касте; `optional` — без явного варианта поле опускается (Wall of Sand);
- урон — `DamageSpec`: одиночная часть (`dice`/`types`) или `parts: [{ dice, type }]` (Destructive Wave: `5d6thunder + 5d6radiant` с уникальными типами);
- `Leveled<T>` — значение по кругу каста: `{ levels: [{ above, value }], fallback? }` (Bestow Curse: длительность/концентрация/лимит; `null` — без лимита, `fallback: undefined` — дефолт движка);
- `Gated<T>` — элемент под условием выбора: `{ if, then }` (условия, модификаторы, элементы `triggers` (`extraDamage`/`endEffect`), `turnDodge`);
- `{ concat: [...] }` — `${кость}${тип}`: любое нерешённое слагаемое опускает всё поле (`riderDice` у GFB/True Strike);
- `{ join: { parts, sep } }` — склейка непустых слагаемых разделителем (Hail/Lightning Arrow: `2d8 + 1d8` — база + апкаст сохраняются раздельно);
- `{ tiers: [{ above, value }] }` — литеральные ступени (Magic Weapon: +1/+2/+3 с 1/3/6 круга);
- `{ perLevel: { base, per, above } }` — `base + per × (круг − above)` (Cordon: 4 + 2 стрелы за круг);
- `{ spellMod: { base, min } }` — `max(min, base + round(spellMod))` (Healing Spirit: заряды 1 + мод, мин 2);
- `{ scale: { dice, by: 'upcast' | { dice } } }` — кость с шагом апкаста: из данных (Healing Spirit: 1к6 + 1к6/круг) или литеральным (Wall of Ice: появление +2к6, лист +1к6);
- `{ mapped: { of, values, fallback? } }` — отображение значения по таблице (Fire Shield: warm → сопротивление холоду, ответ огнём);
- литералы; `undefined` — поле опускается, обязательное нерезолвленное — ошибка компиляции (`mustValue`).

Рантайм `AutomationDice.dice` получает уже разрешённую строку — компилятор, а не исполнитель.

## 5. Стабильные имена и патч-пути

- Блоки — объектные ключи (`zone`, `loadout`, `selection`, …).
- Массивы — коллекции с `id`: `effects.<id>`, `zone.actions.<id>`, `grantedActions.<id>`, `choices.<id>`, `triggers.<slot>`. Патч адресует узел по имени, а не по индексу (копия может менять и `choices.<id>.options` — в пределах словаря параметра, см. §3.5).
- `extends` + `patch`: операции `set` / `append` / `remove` по путям; присваивание массива заменяет его целиком; неизвестный путь — **ошибка компиляции** (deploy-инвариант), а не молчаливый no-op.

Пример копии (из карточки R16):
```
CUSTOM:Jallarzi-Fire {
  extends: "XPHB:Jallarzi's Storm of Radiance",
  patch: {
    "zone.triggers.enter.damage.types": ["fire"],
    "zone.aura.effects.blinded.conditions": ["paralyzed"]
  }
}
```
Реализовано: `resolveSpec` (копия → база + `patch`/`remove`; неизвестный путь — ошибка), ссылка `above:'spell'` (базовый круг заклинания). Копии проверяются тестом: меняют механику без кода.

## 6. Валидатор (матрица `primary` × блоки)

Слои: структура — JSON-Schema (draft 2020-12) в `automation/schema.ts` (`additionalProperties: false` на всех узлах; экспорт `AUTOMATION_SPEC_SCHEMA` / `MATERIALIZED_AUTOMATION_SCHEMA`, второй — запись без `key`/`name`); валидируется ajv в `automation.schema.test.ts` и при генерации `npm run catalog` (ajv — корневой devDependency, в клиентский бандл не входит; для сервера/скриптов — subpath `shared/automationSchema`). Семантика (матрица и словари ниже, ссылки `ValueExpr`) — `validateSpec` в `compile.ts`, вызывается `compileSpec` (ошибка — исключение, не молчаливое поле).

Проектная матрица; каждая клетка либо поддержана резолвером, либо даёт ошибку валидации (никаких «молча игнорируется»):

| Блок | attack | save | auto | effect | utility | summon | manual |
|---|---|---|---|---|---|---|---|
| `loadout.rider` | ✓ | — | — | — | — | — | — |
| `loadout.augment/inject/grant` | — | — | ✓ | ✓ | — | — | — |
| `triggers` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `uses` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `movement` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `choices` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `selection` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `vision` | — | ✓ | ✓ | ✓ | — | — | — |
| `zone` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `effects` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `shape` | — | ✓ | — | — | — | — | — |
| `summon` | — | — | — | — | — | ✓ | — |
| payload `save` | — | ✓ | — | — | — | — | — |
| `banishOnFail` | — | ✓ | — | — | — | — | — |

Обязательные условия: `attack` требует `attack` (или `weaponAttack`); `effect` — непустой `effects`; `utility` — `utility.kind`; `summon` — `summon`; `manual` — только `byDesign`-замки и отложенный контент; `ActionSpec` с `baseActionId` несовместим с payload-полями (`primary`/`save`/`damage`/`effects`/`utility`/`count`/…) — ошибка валидатора, а не молчаливая потеря.

## 7. Компиляция и миграция

1. `compileSpec(spec, opts): AutomationDef` — резолв `extends`/`patch` → подстановка `choices` → резолв `DiceRef`/скейлов → сборка `AutomationDef`. Рантайм (`dispatchKind`, `executeAutomation`) не меняется. Срез 4.1: `compileSpec` сам применяет правило данных «длительность ровно 1 минута → 10 раундов» (`spellMaxRounds`), если спек не задал `maxRounds` — запись компилируется без пост-обработки в `automationForSpell`.
2. Шаблоны (`zoneStorm`, `weaponAttack`, `chain`, `teleportAfter`, `summon`) — конструкторы спеков, не отдельная модель.
3. Миграция — батчами по классам (сначала каталог + билдеры на `loadout`/`uses`/`choices`, затем `triggers`/`movement`/`selection`/`vision`), под характеризационным замком: хэши производных не меняются, кроме осознанных правок.
4. `CUSTOM:`-каталог и UI конструктора — после стабилизации компилятора; тогда же deploy-инварианты (достижимость полей, i18n/иконки копий).
5. Ручной слой (149 manual) не мигрируем — остаётся `manual`/`byDesign`.

## 8. Принятые решения и открытые вопросы

Принято:
- спелл — композиция блоков с одной ведущей веткой; `primary` ∈ `AutomationResolution`, `shape` только с `save`;
- стабильные `id` у массивов; патч по именам; неизвестный путь — ошибка;
- выделяются `loadout`, `triggers`, `uses`, `movement`, `choices`, `selection`, `vision`;
- `mark`/`markTarget`/`markSaved` остаются в `effects`; `retarget` — в `selection`;
- `economy`/`defense` не выделяются; `triggers` — единый формат payload + слот;
- шаблоны — конструкторы над композицией;
- `ValueExpr` (ref/tiers/add/concat) — реализован; пилот `loadout` (10 спеков: GFB/Booming Blade, True Strike, Shillelagh, Magic/Elemental Weapon, Flame Arrows, Shadow Blade, Magic Stone, Flame Blade) компилируется из `AUTOMATION_SPECS`, равенство вывода билдерам — замок `automation.spec.test.ts`;
- блок `uses` (charges/consumeOnAttack/misdirect) — реализован; мигрированы Resistance, Elemental Bane, Zephyr Strike, Mirror Image; спеки перехватывают и каталог, и билдеры (`derive.ts`);
- блок `zone` + `PayloadSpec` — реализованы (pass-through + ValueExpr); мигрированы Guardian of Faith, Cordon of Arrows, Healing Spirit: `uses` закрыт;
- батч `choices`: `ModifierSpec` (ссылки в value/filter), условия/`retaliate`/`takesExtraDamage`/действия со ссылками, `{ if, then }`, `add/includes/mapped`; мигрированы 10 заклинаний выбора (26 спеков);
- батч составного урона и базовых стен: `DamageSpec.parts`, `part.index`, `choice.optional`, `zone.area: { wall: 'spell' }`; мигрированы Destructive Wave, Wall of Fire, Blade Barrier, Wall of Sand (30 спеков). Тонкие стены (Ice/Force/Stone: `zone.wall` + `breach`), Wall of Light (`shrinkFeet`), Wall of Thorns — следующим шаблоном `wallZone`;
- батч стен через `wallZone`: параметрические габариты (`WallDims | { from: 'spell' }`, `wallAreaOf`), секции с `breach`, литеральный `scale.by`, `ActionSpec` (`count`/`shrinkFeet`/`defKey`); мигрированы Thorns, Ice, Force, Stone, Light (35 спеков, все 9 стен);
- батч carrier'ов `choices`: `Leveled<T>` (круг каста), гейты `wakeOnDamage`/`turnDodge`/`takesExtraDamage`, `markSaved`, вложенные эффекты действий; мигрированы Eyebite и Bestow Curse — `choices` закрыт (37 спеков);
- батч `hooks` (damageHooks): `HookSpec` (retaliate/damageReduce/elementalBane/takesExtraDamage/wakeOnDamage/saveOnDamage/breakOn/sanctuary/deathWard/damageLink/tempHp/noHeal/maximizeHealing/deathSaveAdvantage/saveNoDamage/dominates/ward/damageReaction), `ValueExpr` (`upcastFlat`/`sum`); регрупп 7 спеков + мигрированы Armor of Agathys, Shadow of Moil, Invisibility, Greater Invisibility, Death Ward (42 спека); билдеры и каталожные записи удалены;
- батч `movement`: `UtilitySpec` (ссылки в blockedDamage/fromBurst), `MovementSpec`/`EffectMovementSpec`, `AutomationSpec.utility`/`targets`; мигрированы Misty Step, Scatter, Far Step, Dimension Door, Thunder Step, Steel Wind Strike (48 спеков), билдеры/каталог удалены;
- батч `selection` (начало): `chain` (`jumps` — ссылка) и `burst` (Ice Knife); мигрированы Chain Lightning и Ice Knife (50 спеков), билдеры удалены; `burst` читается и веткой сейва (вспышка вокруг каждой цели);
- батч `vision` (начало): `EffectSpec.senses`/`seesInvisible` (+ гейты `{ if, then }`); мигрированы Light, Continual Flame, Darkvision, See Invisibility, Pass without Trace, Silence, Darkness, Fog Cloud (58 спеков), каталожные записи удалены;
- батч смайтов: `AutomationSpec.force`, `EffectSpec.conditionImmunities`/`banish`, `ValueExpr.join`; мигрированы 9 XPHB-смайтов (67 спеков), билдер удалён;
- `selection` добор: `mark`/`markTarget`/`retarget` (Hex/Hunter's Mark), `targets` (Bless/Bane), `autoTargets` (Beacon of Hope), `side`+`$spell` (Spirit Guardians, Conjure Woodland Beings, `baseActionId`), `requiresCreatureTypes`/`saveAdvantageInCombat`+`Leveled<null>` (Dominate Beast/Person), Telekinesis (utility + носитель-действие) — 77 спеков, `derived` не менялся, билдеры удалены. Батч `selection` закрыт.
- каталог закрыт на спеках: `zone`-локации (Daylight/Moonbeam/Flaming Sphere/Faithful Hound/Crusader's Mantle/Holy Weapon), `escape`/`escalate` (Web/Sleep), `endConditions` (Protection from Poison/Lesser Restoration), `shape`/`saveSuccess`/`conditionImmunitiesFrom`/флаги движения (Polymorph/Freedom of Movement/Protection from Evil and Good/Otto/Primordial Ward/Fount of Moonlight); в `AUTOMATION_SPELLS` — только manual/chip.
- слой добавок снесён: Shocking Grasp/Chill Touch — attack-спеки с райдером (`restrictions.noOpportunityAttacks`/`triggers.healReceived.preventHeal`), Cure Wounds/Healing Word/Mass Healing Word/Mass Cure Wounds (heal `abilityMod` + `types`, `targets: 6`), Prayer of Healing (`targets: 5`), Harm (`AutomationSpec.maxHpFromDamage`); `AUTOMATION_ADDITIONS`/`AutomationAddition`/`withAdditions`/`healAbilityMod`-мутация и `withSpellDice`/`resolveZoneDice` удалены, `derived` не менялся (`21dcc4e4cec47878`).
- класс 2 аудита (точки расширения): выборы — адресация по id (`{ref:'choice', choice}`, `optional` включается только явным вариантом этого выбора), словари опций (`damageType`/`condition`/`ability`/`skill`) проверяет `validateSpec`, `spellVariantDef` резолвит `extends`-копии (селект кастомного спелла); замок зеркала `UtilitySpec.multiplier/thenMove` (Мантия вдохновения) — тесты `automation.spec.test.ts`, `derived` не менялся. `ref:'characterLevel'` и `ZoneWallDef.resistances` по решению владельца не покрывались.
- класс 3 аудита (дубли): удалены `header.remarkAction`/`header.zoneMoveAction` (мёртвый runtime-слой, универсальный путь — `ActionSpec`) и `LoadoutAugment.ranged` (дубль `ModifierFilter.attackType`, Flame Arrows объявляет его напрямую); `validateSpec` даёт ошибку на `baseActionId`+payload и дособирает refs `saveSuccess`/`zone.actions`. Отложено: `CompositeConfig.upcast/onFail/zone` — срез B (тултипы из спеков); роль `'choice'` в данных `damage.parts` — снять при следующей регенерации `npm run spells`.
- срез B: `spellDamageParts` выводится из ролей частей данных (`main` — составной; одна `main` + `trigger` другого типа — Ice Knife/Wall of Thorns; меньше двух строк — данные карточки), типы-выборы — в порядке спековых `choices`; `COMPOSITE_CONFIGS`/`CompositeConfig`/`CompositePart` и ключевые хардкоды (Ice Knife/Wall of Thorns/Jallarzi) удалены, свип всех 420 ключей — нулевой diff, `derived` не менялся.
- Haste RAW (сессия 23): `EffectSpec.onEnd` (вялость при снятии: `rounds: 2`, скорость ×0, запрет действий/бонусных/реакций; во всех путях снятия, кроме замены при перекасте) + преимущество на спас DEX; `derived` изменён осознанно (`70802ac175f12af1`).
- срез A `triggers`: блок эффекта `triggers` (`EffectTriggers`) — единый словарь событий × операции (`damaged`/`healReceived`/`hpReachedZero`/`deathSave`/`saveSucceeded`/`targetedByAttack`/`own*`/`willingMove` + тёрн-слоты) вместо прежних `hooks`/`triggers`; `tempHp`/`dominates` вынесены в поля эффекта, `willingMove` зарезервирован под B (Booming Blade пока в `weaponAttack.hitEffect`); компилируется в те же поля `AutomationEffect`, рантайм не менялся, `derived` не менялся.
- срез B (рантайм триггеров): `EffectInstance.triggers: TriggerInstance[]` — 16 именованных полей хуков удалены из рантайма (`retaliate`/`damageReduce`/`elementalBane`/`takesExtraDamage`/`wakeOnDamage`/`saveOnDamage`/`breakOn`/`sanctuary`/`deathWard`/`damageLink`/`noHeal`/`maximizeHealing`/`deathSaveAdvantage`/`saveNoDamage`/`ward`/`damageReaction`/`onWillingMove`); потребители — через `triggersOn`/`triggerOn`/`hasTrigger` (`rules/effects.ts`), сводка чипов — по триггерам; сохранённые комнаты старой формы хуки не восстанавливают (решение владельца, без миграции). Срез C: те же поля удалены и из `AutomationEffect` — `compileTriggers` пишет `triggers` напрямую (включая тёрн-слоты и `weaponAttack.hitEffect.triggers`), `effectFieldsFromDef` только копирует массив; характеризация обновлена осознанно (`derived e4ae27231c5f3319`, форма IR), `catalog`/green/red не менялись; аудит показал и починил скрытый баг — `featureAutomation` (turnUndead) писал легаси `wakeOnDamage` мимо типов.
- билдеры закрыты: `lifesteal`/`lifeTransfer`, `UtilitySpec.dice`, `area`, `halfOnMiss`/`successDamage`/`undeadTempHp`/`heal`, effect `triggers`/`selfOnFail`/`maxHpBonus`, `ActionSpec.banishOnFail`/`requiresCreatureTypes`; мигрированы все билдеры, `derived` не менялся, `BUILTIN_AUTOMATION`/`spellBuiltinAutomated` удалены, `builders.ts` → `helpers.ts` (хелперы костей).
- шаг 4, срез 1 (прототип `materialize`, ничего не переключено): `materializeSpell`/`materializeAutomation` (`shared/src/rules/automation/materialize.ts`) собирают `SpellDef = meta + automation` из `spells.json` + `AUTOMATION_SPECS`; `key`/`name` только в meta, копии (`extends`) слиты, `WALL_DIMS` по ключу развёрнут в литералы записи (ссылки `{ ref: ... }`/`{ from: 'spell' }` на meta остаются). Замок `automation.materialize.test.ts`: для 162 спеков `compileSpec(meta + automation)` байт-в-байт равен `automationForSpell` на свипе 9 кругов × 5 уровней персонажа × варианты × spellMod, стены компилируются при удалённых ключах `WALL_DIMS`; остальные 258 пока без `automation` (fallback каталог/призывы/деривация/manual). Генерация — `npm run catalog` → gitignored `artifacts/catalog.json` (420 записей, hash `85a05494d9c809e8`).
- шаг 4, срез 2 (валидация): JSON-Schema `automation/schema.ts` + ajv (root devDependency; subpath `shared/automationSchema`); `automation.schema.test.ts` — все 162 спека и все материализованные автоматизации валидны, негативы (неизвестное поле, битый enum/тип, лишние `key`/`name` в записи) отклоняются; `npm run catalog` валидирует записи перед записью. `validateSpec` дополнен `utility без utility.kind` и `shape без shape`; `compileSpec` по-прежнему бросает на невалидном спеке.

Открыто (решить при реализации шага 2–3):
- формат `CUSTOM:`-снимка (отдельный JSON рядом с `spells.json` или data-модуль) — шаг 4;
- имена стратегий `loadout`/`movement` (проверить на миграции первых 10 спеков);
- нужен ли `choices.default` для копий, меняющих набор вариантов.
- гэпы среза 1 до «одна запись на всё» (258 записей): (1) `byDesign`/`chip`/`chipActions` каталога (4 chip + byDesign; `manualSpell` выразим как `primary:'manual'`) — нет полей в `AutomationSpec`; (2) призывы (12) — реестр `SUMMON_SPELLS`, нет блока `summon`; (3) деривация (71) — `count` не `ValueExpr` (`spellAttackCount` зависит от круга/уровня), `types` — не один `type0` (нужен ref всех типов), хардкоды `withBlastMods`/`effectiveSpellRangeFeet` по ключу Eldritch Blast (инвокации вне спека); (4) data-флаг `Spell.automation: 'full'|'manual'` конфликтует именем с полем спека `SpellDef.automation` — на срезе 3 переименовать/выкинуть (в материализованных записях флага нет).

## 9. Правила общности и дублирования (контроль)

Спек должен оставаться параметризуемым, а не «захардкоженным заклинанием»:

1. Значения — `ValueExpr` (данные заклинания, опции, выборы, ступени); литералы — только fallback и RAW-константы (`SPELL_BASES`), с комментарием.
2. Производные — ссылки, не копии: `above:'spell'`, `{ ref: 'cantrip' | 'upcastDice' | 'part' | ... }`; число в спеке допустимо там, где его нет в `spells.json`.
3. Выбор при касте — `choices`, не булевы флаги и не отдельные спеки-двойники.
4. Компилятор не знает конкретных ключей (никаких `spell.key ===`); различия выражаются полями спека.
5. Новый механизм — блок (`loadout`/`uses`/`choices`/`zone`/`PayloadSpec`/…), а не разовое поле; pass-through полей — только временный шаг батча.
6. Каждая механика проверяется копией: `extends`+`patch` меняет поведение без кода (`automation.spec.test.ts`).
7. Дублирование: после закрытия батча билдеры мигрированных заклинаний, их вызовы и старые каталожные записи удаляются; замок равенства билдерам — временный инструмент миграции (постоянные замки — характеризация и поведенческие тесты). Сделано: 36 билдеров (37 спеков), вызовы в `derive.ts`, запись `XPHB:Mirror Image` в каталоге, `SPELL_VARIANTS`; `spellVariantDef` и `spellAutomated` читают спеки.
