# AUTOMATION.md — AutomationSpec: дизайн (R16, шаг 2)

Карточка — `REFACTOR.md` (R16); карта кода — `ARCHITECTURE.md`; контракт веток исполнителя — `server/src/socket/automation/dispatch.ts` + `dispatch.test.ts`.

Документ фиксирует модель до написания типов: **спелл — композиция блоков с одной ведущей веткой**. Рантайм не меняется: `AutomationDef` остаётся целевым форматом, `AutomationSpec` компилируется в него, характеризационный замок (`automation.characterization.test.ts`) гарантирует, что миграция не меняет механику.

## 1. Модель

- **Ветка (`primary`)** — как спек разрешается рантаймом; ровно одна. Объявленный `AutomationResolution`: `attack | save | auto | effect | utility | summon | shape | manual`. `shape` допустим только вместе с `save` (Polymorph); Wild Shape — отдельный socket-flow (`server/src/socket/forms.ts`).
- **Блоки** — механизмы, ортогональные ветке. Существующие: `zone`, `effects`, `summon`, `utility`, payload (`save`/`damage`/`heal`/`successDamage`/`endConditions`/`healTo`/`containment`). Выделяются явно: `loadout`, `damageHooks`, `uses`, `movement`, `choices`, `selection`, `vision`.
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

### 3.2. `damageHooks` — перехват урона и HP (выделяется; это и есть R14)
- Входящий урон: `retaliate` (Armor of Agathys, Fire Shield), `damageReduce` (Resistance), `elementalBane`, `ward` (Primordial Ward), `damageReaction` (Fount of Moonlight), `damageLink` (Warding Bond), `deathWard`, `saveOnDamage` (Hideous Laughter), `wakeOnDamage` (Sleep), `breakOn` (Invisibility);
- гейты: `sanctuary` (нельзя выбрать целью);
- поток HP: `lifesteal` (Vampiric Touch), `lifeTransfer`, `maxHpFromDamage` (Harm), `undeadTempHp` (Negative Energy Flood), `healTo` (Aura of Life), `tempHp`, `maxHpBonus`, `noHeal`, `maximizeHealing`.

Порядок критичен — фиксируется тестами; целевой диспетчер — `gateAttackOnTarget` (до окна реакций) и `afterDamage` (после урона), окна реакций (`ward`/Absorb Elements) остаются в `reactions/*`.

### 3.3. `uses` — заряды и счётчики (выделяется)
`effect.charges {count, on}` (Flame Arrows — 12 боеприпасов, Magic Stone — 3 камня, Resistance), `charges.on: 'rangedWeaponAttack'`, `zone.charges` (Cordon of Arrows, Healing Spirit), `zone.dealtLimit` (Guardian of Faith — 60), `misdirect.charges` (Mirror Image), `bonusDieUses` (Бардовское вдохновение), `consumeOnAttackRoll` (Zephyr Strike), `elementalBane.usedTurn`. Общий вид: `uses: { count, spendOn, endsWhen, replenish }`.

Реализовано (`UsesSpec`): `charges` (count + `on`), `consumeOnAttack` (Zephyr Strike), `misdirect` (Mirror Image) — компилируются в существующие поля эффекта, пока серверные потребители не унифицированы. Мигрированы: Flame Arrows, Magic Stone, Resistance, Zephyr Strike, Mirror Image; зонные счётчики — Guardian of Faith (`dealtLimit`), Cordon of Arrows (`charges: perLevel`), Healing Spirit (`charges: spellMod`).

### 3.4. `movement` — перемещение (выделяется)
`force` (push/pull: Repelling Blast, Thunderwave), `utility.teleport` (+`passenger`/`blockedDamage`/`ignoreSight`, Thunder Step `fromBurst`), `teleportAfter` (Steel Wind Strike), `scatter`, `telekinesis` (`placements`), `utility.moveZone` (Moonbeam/Spiritual Weapon), `onWillingMove` (Booming Blade), `ignoresDifficultTerrain`/`immuneToSpeedReduction` (Freedom of Movement), модификаторы скорости (Longstrider, Zephyr Strike). Стратегии: `teleport | push | pull | scatter | moveZone | punishMove`.

### 3.5. `choices` — выбор при касте (выделяется)
Сейчас отдельный реестр `SPELL_VARIANTS` (18 заклинаний): `damageType` (Dragon's Breath, Destructive Wave, Elemental Weapon, Resistance, Protection from Energy, Spirit Shroud, CME, True Strike, Elemental Bane), `effect` (Eyebite, Blindness/Deafness, Bestow Curse, Fire Shield, формы стен), `ability` (Enhance Ability), `skill` (Skill Empowerment), `command` (Command). Сюда же — формы Polymorph/призывов.

Блок: `choices: [{ id, param, options, default? }]`; `param` — типизированный enum, значение подставляется ссылками в `DiceRef.types`, `effect.conditions`, `ability`, `zone.area` (форма стены). Клиент выбирает вариант в `SpellPopover`, сервер валидирует (`spellResolve`).

Реализовано: `ChoiceSpec` + `ModifierSpec` (`value`/`filter.damageType|ability|skill` — ссылки), условия/`retaliate`/`takesExtraDamage` и действия (`save`/`area`/`damage.types`) принимают ссылки, условные элементы списков `{ if, then }` (Command), `ValueExpr.add/includes/mapped`. Мигрированы: Elemental Weapon (пилот), Resistance/Elemental Bane (батч `uses`), Protection from Energy, Blindness/Deafness, Fire Shield, Dragon's Breath, Command, Enhance Ability, Skill Empowerment, Spirit Shroud, CME. Остальные носители `SPELL_VARIANTS`: Eyebite (carrier с 3 действиями), Bestow Curse (режимы), Destructive Wave (составной урон), формы стен (нужен `wallArea` в спеке).

### 3.6. `selection` — как выбираются цели (выделяется)
- `mode`: `single` / `multi` (`targets`, `targetsAbility`) / `area` (`areaSpec`, `origin`) / `chain` (`jumps`, `feet`) / `scatter` / `radius` (`radiusFeet`, `autoTargets`);
- `filters`: `side`, `excludeCreatureTypes`, `requiresCreatureTypes`, `containment`;
- метки: поля `mark`/`markTarget`/`markSaved` остаются в `effects` (компилируются в `EffectInstance` с `filter.targetId`); `retarget` (Hex/Hunter's Mark) — операция `selection` над меткой.

Часть правил уже в `shared/src/rules/targeting.ts`; блок описывает только декларацию, выбор остаётся за `interaction.ts`/клиентом.

### 3.7. `vision` — свет, сенсы, скрытие (выделяется)
Общий блок эффекта и зоны: `light` (Light, Moonbeam, Flame Blade), `senses` (Darkvision, Devil's Sight), `seesInvisible` (See Invisibility), `obscures` (zone flag `obscured`), `blocksLight` (Darkness/Fog Cloud), `silence` (Silence, Jallarzi). Компилируется в те же поля `EffectInstance`/`ZoneInstance`; правила — `rules/vision.ts`.

### 3.8. Существующие блоки (не меняются)
- `zone` (`ZoneDef`): area/origin/duration/anchor/aura/triggers/onCreate/charges/dealtLimit/actions/wall/flags — уже самостоятельный блок с под-механизмами; в спеке — `ZoneSpec` (pass-through + `ValueExpr` в charges/триггерах через `PayloadSpec`); стены — параметрически: `zone.area: { wall: WallDims | { from: 'spell' } }` (`wallAreaOf(dims, variant)`, габариты — `WALL_DIMS`), секции — `zone.wall` (+`breach: PayloadSpec`), общий шаблон `wallZone(...)` в `specs.ts` (шапка + параметры: триггеры/секции/флаги/свет/действия);
- `effects` (`AutomationEffect`): длительности, условия, модификаторы, ограничения, триггеры, реактивности (мигрируют в `damageHooks`), выданные действия;
- `utility` (`kind` — готовый образец «блока со стратегиями», 21 значение);
- `summon`, `shape`, payload (`save`/`damage`/`heal`/…).

### 3.9. Не выделяются
- `economy` (`restrictions`, стоимость выданных действий, `extraAction`/`extraMovement`/`extraAttacks`/`disengage`) — остаётся в `Restrictions` + `GrantedAction` + `utility`;
- `defense` (`conditionImmunities*`, `saveNoDamage`, `deathSaveAdvantage`) — пересекается с `damageHooks`/`effects`;
- `triggers`/`timing` — приводится к одному формату payload + слот (`startOfTurn`/`endOfTurn`/`enter`/`exit`/`onCreate`), отдельным классом не является.

## 4. ValueExpr (DiceRef)

Значения спека (кости, типы, бонусы) — ссылки `ValueExpr`, резолвит компилятор:

- `{ ref: 'cantrip' | 'damage' | 'part' | 'upcastDice' | 'spellDamage' | 'upcastAttack' | 'type0' | 'spellMod' | 'castLevel' | 'characterLevel' | 'choice'; part?; choice?; fallback? }` — данные заклинания, опции каста, выбор из `choices`;
- `{ add: [expr, expr] }` — сложение однотипных костей (`addDiceExpression`: `1d8` + `1d8 + 1d8` → `3d8`, без базы — добавка);
- `{ includes: { of, values } }` — гейт `'1'`/`''` для условных элементов `{ if, then }` (Command: halt/grovel);
- `{ ref: 'part', part, index?, fallback? }` — часть данных по роли и индексу (составной урон: две `main`);
- `{ ref: 'choice', optional? }` — выбор при касте; `optional` — без явного варианта поле опускается (Wall of Sand);
- урон — `DamageSpec`: одиночная часть (`dice`/`types`) или `parts: [{ dice, type }]` (Destructive Wave: `5d6thunder + 5d6radiant` с уникальными типами);
- `{ concat: [...] }` — `${кость}${тип}`: любое нерешённое слагаемое опускает всё поле (`riderDice` у GFB/True Strike);
- `{ tiers: [{ above, value }] }` — литеральные ступени (Magic Weapon: +1/+2/+3 с 1/3/6 круга);
- `{ perLevel: { base, per, above } }` — `base + per × (круг − above)` (Cordon: 4 + 2 стрелы за круг);
- `{ spellMod: { base, min } }` — `max(min, base + round(spellMod))` (Healing Spirit: заряды 1 + мод, мин 2);
- `{ scale: { dice, by: 'upcast' | { dice } } }` — кость с шагом апкаста: из данных (Healing Spirit: 1к6 + 1к6/круг) или литеральным (Wall of Ice: появление +2к6, лист +1к6);
- `{ mapped: { of, values, fallback? } }` — отображение значения по таблице (Fire Shield: warm → сопротивление холоду, ответ огнём);
- литералы; `undefined` — поле опускается, обязательное нерезолвленное — ошибка компиляции (`mustValue`).

Рантайм `AutomationDice.dice` получает уже разрешённую строку — компилятор, а не исполнитель.

## 5. Стабильные имена и патч-пути

- Блоки — объектные ключи (`zone`, `loadout`, `selection`, …).
- Массивы — коллекции с `id`: `effects.<id>`, `zone.actions.<id>`, `grantedActions.<id>`, `choices.<id>`, `triggers.<slot>`. Патч адресует узел по имени, а не по индексу.
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

Проектная матрица; каждая клетка либо поддержана резолвером, либо даёт ошибку валидации (никаких «молча игнорируется»):

| Блок | attack | save | auto | effect | utility | summon | manual |
|---|---|---|---|---|---|---|---|
| `loadout.rider` | ✓ | — | — | — | — | — | — |
| `loadout.augment/inject/grant` | — | — | ✓ | ✓ | — | — | — |
| `damageHooks` | ✓ | ✓ | ✓ | ✓ | — | — | — |
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

Обязательные условия: `attack` требует `attack` (или `weaponAttack`); `effect` — непустой `effects`; `utility` — `utility.kind`; `summon` — `summon`; `manual` — только `byDesign`-замки и отложенный контент.

## 7. Компиляция и миграция

1. `compileSpec(spec, opts): AutomationDef` — резолв `extends`/`patch` → подстановка `choices` → резолв `DiceRef`/скейлов → сборка `AutomationDef`. Рантайм (`dispatchKind`, `executeAutomation`) не меняется.
2. Шаблоны (`zoneStorm`, `weaponAttack`, `chain`, `teleportAfter`, `summon`) — конструкторы спеков, не отдельная модель.
3. Миграция — батчами по классам (сначала каталог + билдеры на `loadout`/`uses`/`choices`, затем `damageHooks`/`movement`/`selection`/`vision`), под характеризационным замком: хэши производных не меняются, кроме осознанных правок.
4. `CUSTOM:`-каталог и UI конструктора — после стабилизации компилятора; тогда же deploy-инварианты (достижимость полей, i18n/иконки копий).
5. Ручной слой (149 manual) не мигрируем — остаётся `manual`/`byDesign`.

## 8. Принятые решения и открытые вопросы

Принято:
- спелл — композиция блоков с одной ведущей веткой; `primary` ∈ `AutomationResolution`, `shape` только с `save`;
- стабильные `id` у массивов; патч по именам; неизвестный путь — ошибка;
- выделяются `loadout`, `damageHooks`, `uses`, `movement`, `choices`, `selection`, `vision`;
- `mark`/`markTarget`/`markSaved` остаются в `effects`; `retarget` — в `selection`;
- `economy`/`defense` не выделяются; `triggers` — единый формат payload + слот;
- шаблоны — конструкторы над композицией;
- `ValueExpr` (ref/tiers/add/concat) — реализован; пилот `loadout` (10 спеков: GFB/Booming Blade, True Strike, Shillelagh, Magic/Elemental Weapon, Flame Arrows, Shadow Blade, Magic Stone, Flame Blade) компилируется из `AUTOMATION_SPECS`, равенство вывода билдерам — замок `automation.spec.test.ts`;
- блок `uses` (charges/consumeOnAttack/misdirect) — реализован; мигрированы Resistance, Elemental Bane, Zephyr Strike, Mirror Image; спеки перехватывают и каталог, и билдеры (`derive.ts`);
- блок `zone` + `PayloadSpec` — реализованы (pass-through + ValueExpr); мигрированы Guardian of Faith, Cordon of Arrows, Healing Spirit: `uses` закрыт;
- батч `choices`: `ModifierSpec` (ссылки в value/filter), условия/`retaliate`/`takesExtraDamage`/действия со ссылками, `{ if, then }`, `add/includes/mapped`; мигрированы 10 заклинаний выбора (26 спеков);
- батч составного урона и базовых стен: `DamageSpec.parts`, `part.index`, `choice.optional`, `zone.area: { wall: 'spell' }`; мигрированы Destructive Wave, Wall of Fire, Blade Barrier, Wall of Sand (30 спеков). Тонкие стены (Ice/Force/Stone: `zone.wall` + `breach`), Wall of Light (`shrinkFeet`), Wall of Thorns — следующим шаблоном `wallZone`;
- батч стен через `wallZone`: параметрические габариты (`WallDims | { from: 'spell' }`, `wallAreaOf`), секции с `breach`, литеральный `scale.by`, `ActionSpec` (`count`/`shrinkFeet`/`defKey`); мигрированы Thorns, Ice, Force, Stone, Light (35 спеков, все 9 стен).

Открыто (решить при реализации шага 2–3):
- формат `CUSTOM:`-снимка (отдельный JSON рядом с `spells.json` или data-модуль) — шаг 4;
- имена стратегий `loadout`/`movement` (проверить на миграции первых 10 спеков);
- нужен ли `choices.default` для копий, меняющих набор вариантов.

## 9. Правила общности и дублирования (контроль)

Спек должен оставаться параметризуемым, а не «захардкоженным заклинанием»:

1. Значения — `ValueExpr` (данные заклинания, опции, выборы, ступени); литералы — только fallback и RAW-константы (`SPELL_BASES`), с комментарием.
2. Производные — ссылки, не копии: `above:'spell'`, `{ ref: 'cantrip' | 'upcastDice' | 'part' | ... }`; число в спеке допустимо там, где его нет в `spells.json`.
3. Выбор при касте — `choices`, не булевы флаги и не отдельные спеки-двойники.
4. Компилятор не знает конкретных ключей (никаких `spell.key ===`); различия выражаются полями спека.
5. Новый механизм — блок (`loadout`/`uses`/`choices`/`zone`/`PayloadSpec`/…), а не разовое поле; pass-through полей — только временный шаг батча.
6. Каждая механика проверяется копией: `extends`+`patch` меняет поведение без кода (`automation.spec.test.ts`).
7. Дублирование: после закрытия батча билдеры мигрированных заклинаний, их вызовы и старые каталожные записи удаляются; замок равенства билдерам — временный инструмент миграции (постоянные замки — характеризация и поведенческие тесты).
