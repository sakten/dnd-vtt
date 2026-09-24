# TODO_SPELLS.md

Аудит автоматизации заклинаний (сессия 24.09.2026). **Только анализ и классификация — код не менялся.**
Источники: снимок `shared/src/data/spells.json`, RU-тексты `shared/src/data/text.ru/spells.json`.
Метод проверки: прямые вызовы `automationForSpell` / `spellAttackCount` / `spellExtraTargets` + сверка с описанием и кодом исполнителя (`server/src/socket/automation.ts`, `shared/src/rules/automation.ts`, `shared/src/rules/spellCast.ts`).

## Сводка

- Всего 420 заклинаний; «зелёных» (`spellAutomated()` = true) — **255**: каталог 64, билдеры 20, призывы 12, деривация из данных 159.
- **94 деривативных — ложно-полные**: стоят с `automation: 'full'` (зелёная иконка), но generic-деривация делает не ту механику.
- Остальные деривативные (65) в основном корректны как урон/спас/атака; ~30 из них частичные (§7).

## Проверено — НЕ дефекты (не переоткрывать)

- **Magic Missile**: апкаст работает, 3→4→5→6→7→8 дротиков (`spellAttackCount`, парсит «creates one more dart for each spell slot level above 1»).
- **Scorching Ray** 3→5 лучей, **Eldritch Blast** 1→4 луча (уровни персонажа).
- **Bless / Bane / Hold Person / Longstrider / Banishment**: доп. цели апкаста работают (`spellExtraTargets`, клиент `client/src/lib/actionRules.ts:205`, тесты `shared/src/rules/spellCast.test.ts:289`).
- **Flame Blade** — корректен: грантованный attack-action с `abilityMod:true`.
- **Armor of Agathys** (`tempHp` + `retaliate`), **Heroism** (temp HP в начале хода), **Heal** (70 +10/круг), **Heat Metal** (повтор бонусным действием + апкаст), **Otto's Irresistible Dance** (`escapeDc` = `stats.dc`), **Stinking Cloud / Hunger of Hadar** (состояния в зонах каталога), **Hellish Rebuke** (реакция работает), **Silvery Barbs/Shield** — ок.
- **XPHB/SRD-апкаст костей** (Fireball `8d6 + 1d6`, Melf's Acid Arrow `4d4 + 1d4`) — работает.

## A. Наездник на попадание — `attackRiders` (✅ механизм есть: Searing/Ensnaring, `SMITE_SPELLS`) — 13

Сейчас у всех неверный резолв: мгновенный `save`/`auto`/заклинательная атака вместо урона оружием + наездника.

| Заклинания | Дефект |
|---|---|
| `TCE:Booming Blade`, `TCE:Green-Flame Blade`, `XPHB:True Strike` | атака заклинанием 1d8 без урона оружия; нет наездника (движение/всплеск/выбор типа) |
| `XPHB:Divine Smite`, `XPHB:Thunderous Smite`, `XPHB:Wrathful Smite`, `XPHB:Blinding Smite`, `XPHB:Shining Smite`, `XPHB:Staggering Smite`, `XPHB:Banishing Smite` | «сразу после попадания»: +урон, спас и состояние; сейчас мгновенный save/auto |
| `XPHB:Hail of Thorns`, `XPHB:Lightning Arrow` | после попадания/промаха оружием; цель + существа в 5/10 фт |
| `XGE:Zephyr Strike` | наездник 1d8 + перемещение без OA + преимущество; сейчас auto-урон |

## B. Баффы оружия/себя — `effect`-модификаторы — 21

| Группа | Механизм |
|---|---|
| `XPHB:Divine Favor`, `XPHB:Elemental Weapon`, `XGE:Flame Arrows`, `XPHB:Crusader's Mantle`, `TCE:Spirit Shroud`, `XPHB:Conjure Minor Elementals`, `XGE:Holy Weapon` | ✅ `damage:add`/`attack:add` c `weapon:true` (как Magic Weapon), выбор типа — `variant` |
| `XPHB:Fire Shield`, `XGE:Shadow of Moil` | ✅ `retaliate` (как Armor of Agathys) |
| `XGE:Shadow Blade` | ⚠️ создание оружия: грантованный attack-action (как Flame Blade), метание/возврат бонусным действием |
| `XGE:Guardian of Nature`, `XGE:Tenser's Transformation`, `XPHB:Alter Self`, `XPHB:Enlarge/Reduce`, `XGE:Investiture of Flame`, `XGE:Investiture of Ice`, `XGE:Investiture of Wind`, `XPHB:Fount of Moonlight` | ⚠️ наборы модификаторов/режимов (`variant` + effects + granted actions) |
| `XPHB:Shillelagh` | ⚠️ замена кости оружия и характеристики атаки — отдельного модификатора нет |
| `XGE:Magic Stone` | ⚠️ «три камня» как расходуемый ресурс; +мод к урону |
| `XGE:Absorb Elements` | ⚠️ реакция-поглощение уже есть (`ABSORB_SPELL_TYPES`); нет «+1d6 к следующему попаданию» |

## C. Зоны / ловушки / повтор — `zone` + триггеры (✅ есть; точечные доработки) — 28

- **Зоны с триггерами:** `XGE:Create Bonfire`, `XPHB:Cloud of Daggers`, `XPHB:Spike Growth`, `TCE:Tasha's Caustic Brew` (урон в начале хода), `XGE:Sickening Radiance` (истощение), `XPHB:Wind Wall`, `XPHB:Evard's Black Tentacles` (опутан), `XGE:Maelstrom` (pull), `XGE:Dawn`, `XPHB:Insect Plague`, `XPHB:Conjure Animals`, `XGE:Storm Sphere` (⚡ + бонус-действие), `XPHB:Wall of Fire`, `XGE:Wall of Light`, `XPHB:Wall of Ice`, `XPHB:Blade Barrier` (стены), `XGE:Wrath of Nature`, `XPHB:Yolande's Regal Presence` (push), `XGE:Dust Devil` (push), `XGE:Maximilian's Earthen Grasp` (опутан), `XGE:Healing Spirit` (лимит лечений ⚠️), `XPHB:Cordon of Arrows`, `XPHB:Glyph of Warding` (ловушки/заряды ⚠️).
- **Повтор на цели (эффект-триггеры/грантованные действия):** `XPHB:Witch Bolt`, `XPHB:Melf's Acid Arrow`, `XGE:Immolation`, `XGE:Enervation` (leech + 4d8 на провале вместо текущих 2d8), `XGE:Melf's Minute Meteors` (6 зарядов).

## D. Составной урон и несколько целей — ⚠️ нужна схема частей/мультицели — 10

| Заклинание | Дефект |
|---|---|
| `XPHB:Flame Strike` | смешанный тип одним броском: 5d6 вместо 5d6 огнём + 5d6 излучением |
| `XPHB:Destructive Wave` | 5d6 вместо 5d6 звуком + 5d6 излучением/некротикой |
| `XPHB:Wall of Thorns` | 7d8 вместо 7d8 колющим + 7d8 рубящим |
| `XPHB:Jallarzi's Storm of Radiance` | 2d10 вместо 2d10 излучением + 2d10 звуком |
| `XPHB:Ice Storm` | 2d10 вместо 2d10 дробящего + 4d6 холодом |
| `XPHB:Ice Knife` | только 1d10 атакой; нет 2d6 холодом спасом |
| `XPHB:Vitriolic Sphere` | 10d4, нет второй порции 5d4 |
| `XPHB:Spiritual Weapon` | 1d8 без +модификатора, урон не от позиции оружия |
| `XPHB:Steel Wind Strike` | 6d10 в одну цель вместо до 5 целей + телепорт |
| `XPHB:Chain Lightning` | 10d8 в одну цель, без 3 перескоков |

## E. Временные хиты — ✅ `effect.tempHp` — 2

- `XPHB:False Life` — сейчас обычное лечение `2d4 + 4` вместо Временных хитов; апкаст +5/круг.
- `XGE:Negative Energy Flood` — ветка нежити (5d12 половиной временными хитами) отсутствует.

## F. Духи-атаки — ⚠️ грантованный attack-action (как Flame Blade/Spiritual Weapon) — 2

- `XPHB:Conjure Elemental`, `XPHB:Conjure Fey` — сейчас прямой save/auto-урон; должны быть дух + повторяющаяся атака.

## G. Перемещение — ✅ `utility.teleport` — 2

- `XPHB:Dimension Door` — ⚠️ + пассажир.
- `XGE:Thunder Step` — ⚠️ телепорт + урон в точке выхода (сейчас save по цели).

## H. Особая логика / нет типа автоматизации — 16

**Нет типа — нужен новый движок или остаётся manual (13):**

| Заклинание | Причина |
|---|---|
| `XPHB:Phantasmal Force` | иллюзия + расследование |
| `XPHB:Control Water`, `XGE:Transmute Rock` | смена среды, несколько режимов |
| `XGE:Elemental Bane` | «утрата сопротивления» — модификатора нет |
| `XPHB:Ray of Enfeeblement` | «половина урона от атак» — механики нет |
| `XGE:Life Transference` | самоурон → двойное лечение — спец-цепочка |
| `XPHB:Meld into Stone` | нарратив/укрытие |
| `XPHB:Forbiddance` | ритуал, запрет телепортации в область |
| `XGE:Create Homunculus` | крафт спутника |
| `XPHB:Dream` | нарратив |
| `XPHB:Contact Other Plane` | нарратив + риск безумия |
| `XPHB:Geas` | нарратив/очарование на 30 дней |
| `XGE:Soul Cage` | 6 использований |

**Почти выразимо существующими механизмами (3):**

| Заклинание | Что нужно |
|---|---|
| `XPHB:Bestow Curse` | выбор на касте (`variant`): помеха к проверкам/спасам характеристики, помеха атак по вам, запрет действий; 4-й режим (+1d8 некротикой вашими атаками) — attack rider |
| `XPHB:Bigby's Hand` | 5 режимов — грантованные actions, нужен объём |
| `XPHB:Heroes' Feast` | 1 час пира: temp/max HP, иммунитеты — effects + спец-тайминг |

## 7. Частичные (остаются зелёными, вне 94)

- **Состояния (✅ эффекты):** `XGE:Earth Tremor`, `XGE:Tidal Wave` (ничком), `XPHB:Ray of Sickness`, `XPHB:Contagion` (отравлен), `XGE:Mental Prison`, `XPHB:Synaptic Static`, `XPHB:Phantasmal Killer`, `XGE:Bones of the Earth`, `XPHB:Grasping Vine`, `XPHB:Blight` (растения), `XPHB:Harm` (max HP ⚠️ модификатора нет).
- **Толчок (✅ `force`):** `XPHB:Thunderwave`, `TCE:Lightning Lure`.
- **Выбор типа / кантрипы:** `XPHB:Chromatic Orb`, `XGE:Chaos Bolt`, `XPHB:Sorcerous Burst` (✅ `variant`), `XPHB:Toll the Dead` (d12).
- **Мелочи (✅):** `XPHB:Guiding Bolt` (преимущество), `XPHB:Vicious Mockery` (помеха), `XPHB:Mind Sliver` (−1d4), `XGE:Frostbite`, `XPHB:Starry Wisp`, `XGE:Infestation` (сдвиг), `XPHB:Dissonant Whispers` (реакция-движение), `TCE:Tasha's Mind Whip` (ограничения действий), `XPHB:Chill Touch` (⚠️ запрет лечения).

## 8. Системные (не per-spell)

1. **Апкаст не-SRD:** `higherLevel` пишется только для `srd52` (`shared/src/rules/spells.ts:405`) → нет апкаста XGE/TCE и XPHB без srd52 (Arms of Hadar, Hail of Thorns, смайты, Cloud of Daggers, Conjure Barrage, Lightning Arrow, Hunger of Hadar, Snilloc's, Chaos Bolt…). Regex `upcastDice` не знает «for every» (Spiritual Weapon).
2. **Скейл кантрипов** зависит от `higherLevel` → не растут: Mind Sliver, Toll the Dead, Thorn Whip, Thunderclap, Word of Radiance (и XGE/TCE-кантрипы).
3. **Мульти-кости:** `spellDamageExpression` берёт `dice[0]` → теряются части урона и связь кость↔тип (см. D); в схеме `AutomationDice` только одна строка.
4. **Лечение без +мода:** Cure Wounds, Healing Word, Mass Healing Word, Mass Cure Wounds. Флаг `abilityMod` в схеме есть, деривация не ставит; `withSpellAbilityMod` смотрит только `def.damage?.abilityMod`.
5. **Каталог:** `XPHB:Resistance` (`save+1d4` вместо −1d4 к урону раз в ход), `XPHB:Guidance` (все проверки вместо выбранного навыка), `XPHB:Aid` (+5/круг), `XPHB:Cloudkill` (зона 5d8 без апкаста).
6. **Лимит «1 минута» — ✅ реализовано:** спеллы длительностью ровно 1 минута получают `maxRounds: 10` (`spellMaxRounds`), эффекты и зоны гаснут на 10-м ходу носителя/источника, даже если не сняты спасом/концентрацией; больше минуты (10 минут/час) не лимитируется, instant не затрагивается. Счётчик — `EffectInstance.maxRounds`/`ZoneInstance.maxRounds`, тик — `tickEffects`/`tickZones`.

## Инвентарь по типам (для планирования)

| Тип | Кол-во | Статус механизма |
|---|---|---|
| attackRiders (наездники) | 13 | ✅ есть, нужен вход от «после попадания» |
| effect-баффы | 21 | ✅/⚠️ (weapon:true, retaliate, actions, variant) |
| zone/повтор | 28 | ✅ есть, ⚠️ стены/заряды/push |
| составной урон/мультицель | 10 | ⚠️ схема частей, есть лучи/`targets` |
| temp HP | 2 | ✅ есть |
| духи-атаки | 2 | ⚠️ granted actions |
| перемещение | 2 | ✅ есть, ⚠️ пассажир/совмещение с уроном |
| особая логика / нет типа | 16 | ❌ 13 без типа, 3 почти выразимы |
| **Итого** | **94** | |
