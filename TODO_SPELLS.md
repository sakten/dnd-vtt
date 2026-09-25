# TODO_SPELLS.md

Аудит автоматизации заклинаний (первичный — 24.09.2026; актуализирован 25.09.2026, сессия 12). Здесь только **открытые** пункты: сделанное — в истории git (коммиты сессий 10–12).
Источники: снимок `shared/src/data/spells.json`, RU-тексты `shared/src/data/text.ru/spells.json`.
Метод проверки: прямые вызовы `automationForSpell` / `spellAutomated` / `spellAttackCount` / `spellExtraTargets` + сверка с описанием и кодом исполнителя (`server/src/socket/automation.ts`, `shared/src/rules/automation.ts`, `shared/src/rules/spellCast.ts`).

## Сводка

- Всего 420 заклинаний; «зелёных» (`spellAutomated()` = true) — **255**, красных (`manual`) — **165**.
- Открыто из аудита (94 записи): **B4** (трансформации — 5), **C-доработки** (Healing Spirit, Cordon of Arrows, Glyph of Warding, стены, Storm Sphere), **D** (Jallarzi — 1), **F** (Conjure Elemental/Fey — 2), **G** (Dimension Door / Thunder Step — 2), **H** (16).
- Системные — §8 (скейл кантрипов, каталог, универсальная подсветка).
- **FX-TODO:** анимация Chain Lightning — дуга от кастера и скачки между целями (порядок знает сервер — передавать в `fx:play`), фабрика в `client/src/components/spellFx/`.

## Проверено — НЕ дефекты (не переоткрывать)

- **Magic Missile**: апкаст 3→…→8 дротиков (`spellAttackCount`).
- **Scorching Ray** 3→5 лучей, **Eldritch Blast** 1→4 луча (уровни персонажа).
- **Bless / Bane / Hold Person / Longstrider / Banishment**: доп. цели апкаста (`spellExtraTargets`).
- **Flame Blade** — грантованный attack-action с `abilityMod:true`.
- **Armor of Agathys** (`tempHp` + `retaliate`), **Heroism**, **Heal** (70 +10/круг), **Heat Metal**, **Otto's** (`escapeDc`), **Stinking Cloud / Hunger of Hadar**, **Hellish Rebuke**, **Silvery Barbs / Shield** — ок.
- **XPHB/SRD-апкаст костей** (Fireball `8d6 + 1d6`, Melf's Acid Arrow `4d4 + 1d4`) — ок.

## B4. Трансформации (отложено владельцем) — 5

- `XGE:Guardian of Nature`, `XGE:Tenser's Transformation`, `XPHB:Alter Self`, `XPHB:Enlarge/Reduce`, `XGE:Investiture of Flame/Ice/Wind` — наборы модификаторов/режимов (`variant` + effects + granted actions).

## C. Зоны / ловушки / повтор — открытые доработки

- **Осталось:** `XGE:Healing Spirit` (лимит лечений), `XPHB:Cordon of Arrows`, `XPHB:Glyph of Warding` (ловушки/заряды), `XGE:Storm Sphere` (бонус-действие); стены — `Wall of Fire` / `Wall of Ice` / `Blade Barrier` / `Wall of Light` идут generic-спасом без геометрии стены.
- **Повтор на цели (эффект-триггеры/грантованные действия):** `XPHB:Witch Bolt`, `XPHB:Melf's Acid Arrow`, `XGE:Immolation`, `XGE:Enervation` (leech + 4d8), `XGE:Melf's Minute Meteors` (6 зарядов).
- Остальные зоны с триггерами (Create Bonfire, Cloud of Daggers, Spike Growth, Tasha's Caustic Brew, Sickening Radiance, Wind Wall, Black Tentacles, Maelstrom, Dawn, Insect Plague, Conjure Animals, Wrath of Nature, Yolande, Dust Devil, Maximilian's) — механизм есть, доработок по аудиту не требуют.

## D. Мультицель — 1

- `XPHB:Jallarzi's Storm of Radiance` — ⚠️ отложено: нужна зона + запрет вербальных компонентов («сайленс»).

## F. Духи-атаки — 2

- `XPHB:Conjure Elemental`, `XPHB:Conjure Fey` — сейчас прямой save/auto-урон; нужен дух + повторяющаяся атака (грантованный attack-action, как Flame Blade).

## G. Перемещение — 2

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
| `XPHB:Bestow Curse` | выбор на касте (`variant`): помеха к проверкам/спасам, помеха атак по вам, запрет действий; 4-й режим (+1d8 некротикой) — attack rider |
| `XPHB:Bigby's Hand` | 5 режимов — грантованные actions, нужен объём (кандидат на `targeting.from:'origin'` + заряд) |
| `XPHB:Heroes' Feast` | 1 час пира: temp/max HP, иммунитеты — effects + спец-тайминг |

## 7. Частичные (⚠️ — остаётся)

- `XPHB:Harm` — max HP ⚠️ модификатора нет.
- `XPHB:Chill Touch` — ⚠️ запрет лечения.

## 8. Системные (открыто)

1. **Скейл кантрипов** зависит от `higherLevel` → не растут: Mind Sliver, Toll the Dead, Thorn Whip, Thunderclap, Word of Radiance (и XGE/TCE-кантрипы).
2. **Каталог:** `XPHB:Resistance` (`save+1d4` вместо −1d4 к урону раз в ход), `XPHB:Guidance` (все проверки вместо выбранного навыка), `XPHB:Aid` (+5/круг), `XPHB:Cloudkill` (зона 5d8 без апкаста).
3. **Универсальная подсветка целей:** обобщить механизм Steel Wind Strike/Spiritual Weapon на все режимы выбора. Общие правила уже в `shared/src/rules/targeting.ts` (`creatureTargetIssue`, `cellNearTargetFeet`, `teleportCellsNearTargets`), клиентская подсветка — `TableTop` (`eligibleTargets`/`targetEligible`/`teleportCells`) + `AimLayer`, локальный `blocked` — стор `aimToCursor`. Нужно: единый слой «кандидаты режима» для single-target/multi/area (кто/какие клетки доступны, подсветка кандидатов и выбранных, игнор клика по невалидным); правила — только в shared, клиент — рендер; заодно вынести остальные inline-проверки таргетинга (цель/область/зонные действия).

## Инвентарь (осталось)

| Тип | Осталось |
|---|---|
| effect-баффы | 5 (B4-трансформации) |
| zone/повтор | Healing Spirit, Cordon of Arrows, Glyph of Warding, стены, Storm Sphere |
| составной урон/мультицель | 1 (Jallarzi) |
| духи-атаки | 2 (Conjure Elemental/Fey) |
| перемещение | 2 (Dimension Door, Thunder Step) |
| особая логика / нет типа | 16 |
