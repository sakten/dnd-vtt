# TODO_SPELLS.md

Аудит автоматизации заклинаний (первичный — 24.09.2026; актуализирован 25.09.2026, сессия 14; дополнен классом I — контроль/утилита). Здесь только **открытые** пункты: сделанное — в истории git (коммиты сессий 10–14).
Источники: снимок `shared/src/data/spells.json`, RU-тексты `shared/src/data/text.ru/spells.json`.
Метод проверки: прямые вызовы `automationForSpell` / `spellAutomated` / `spellAttackCount` / `spellExtraTargets` + сверка с описанием и кодом исполнителя (`server/src/socket/automation/`, `shared/src/rules/automation/`, `shared/src/rules/spellCast.ts`).

## Сводка

- Всего 420 заклинаний; «зелёных» (`spellAutomated()` = true) — **230**, красных (`manual`) — **190**.
- Открыто из аудита: **B4** (трансформации — 7 спеллов), **C-доработки** (Healing Spirit, Cordon of Arrows, стены, Storm Sphere), **F** (Conjure Elemental/Fey — 2), **G** (Dimension Door / Thunder Step — 2), **H** (закрыт: «нет типа» не автоматизируем, Ray of Enfeeblement и Arcane Hand отложены), **I** (контроль/утилита — 12; Charm Monster и Compulsion закрыты плашкой с состоянием, Glyph of Warding решено не делать, Watery Sphere отложен владельцем).
- **Manual-замки (сессия 14):** B4 (Guardian of Nature, Tenser's Transformation, Alter Self, Enlarge/Reduce, Investiture of Flame/Ice/Wind), C (Healing Spirit, Cordon of Arrows, Glyph of Warding, Storm Sphere, Wall of Fire/Ice, Blade Barrier, Wall of Light), F (Conjure Elemental/Fey), G (Dimension Door) — деривация из описаний давала ложную/неверную механику (Dimension Door — авто-урон 4d6, Tenser's — спас 2d12, стены — generic-спас без геометрии и т.п.). Вернуть в автоматизацию по мере реализации механик.
- Системные — §8 (каталог Guidance, универсальная подсветка).
- **FX-TODO:** анимация Chain Lightning — дуга от кастера и скачки между целями (порядок знает сервер — передавать в `fx:play`), фабрика в `client/src/components/spellFx/`.
- **После закрытия спелов — R16** (`REFACTOR.md`): декларативный `AutomationSpec` + `extends/patch` для копий с правкой механики. До тех пор правило: база урона — из данных, исключения — в один реестр (не инлайн), новые механики — именованными примитивами `AutomationDef/Effect`.

## Проверено — НЕ дефекты (не переоткрывать)

- **Magic Missile**: апкаст 3→…→8 дротиков (`spellAttackCount`).
- **Scorching Ray** 3→5 лучей, **Eldritch Blast** 1→4 луча (уровни персонажа).
- **Bless / Bane / Hold Person / Longstrider / Banishment**: доп. цели апкаста (`spellExtraTargets`).
- **Flame Blade** — грантованный attack-action с `abilityMod:true`.
- **Armor of Agathys** (`tempHp` + `retaliate`), **Heroism**, **Heal** (70 +10/круг), **Heat Metal**, **Otto's** (`escapeDc`), **Stinking Cloud / Hunger of Hadar**, **Hellish Rebuke**, **Silvery Barbs / Shield** — ок.
- **XPHB/SRD-апкаст костей** (Fireball `8d6 + 1d6`, Melf's Acid Arrow `4d4 + 1d4`) — ок.
- **Скейл кантрипов (5/11/17)**: все уронные кантрипы растут (Mind Sliver, Toll the Dead, Thorn Whip, Thunderclap, Word of Radiance, XGE/TCE — сверено с 5e.tools); `XGE:Magic Stone` не растёт, и это по правилам (upgrade-клаузы нет). Флаг §8.1 был из-за вызова без `characterLevel`.
- **Повтор на цели (сделано, известные упрощения):** Witch Bolt/Enervation — обрыв по дистанции/полному укрытию не отслеживается; Enervation: успех — отдельный бросок 2к8 (`successDamage`), провал 4к8, повтор действием 4к8, всё +1к8/круг; «другое действие обрывает спелл» не механизировано; Minute Meteors — по одному метеору за бонус-действие (пара — вручную), бросок при касте не автоматизирован. Immolation: «пепел» и запрет немагического тушения — нарратив.
- **Данные костей (сессия 14):** в снимке `spells.json` у 26 заклинаний есть `damage.parts` — кость+типы+роль (`main`/`success`/`repeat`/`trigger`/`choice`), роли размечает сборка (`npm run spells`), рантайм текст не парсит; билдеры берут части по роли. Константы класса C (Heal, False Life, Resistance, Mirror Image, Elemental Bane, Heroes' Feast, d4 Bless/Bane/Guidance) — в реестре `SPELL_BASES` (`automation/bases.ts`). **Ice Storm:** в источнике апкаст-тег `{@scaledamage 2d8|4-9|1d10}` (ведущая `2d8` — опечатка), растёт только bludgeoning на 1d10 — код по правилам.

## B4. Трансформации (отложено владельцем) — 7

- `XGE:Guardian of Nature`, `XGE:Tenser's Transformation`, `XPHB:Alter Self`, `XPHB:Enlarge/Reduce`, `XGE:Investiture of Flame/Ice/Wind` — наборы модификаторов/режимов (`variant` + effects + granted actions). Сейчас manual-замок (деривация давала ложный урон/спас).

## C. Зоны / ловушки / повтор — открытые доработки

- **Осталось:** `XGE:Healing Spirit` (лимит лечений), `XPHB:Cordon of Arrows`, `XGE:Storm Sphere` (бонус-действие); стены — `Wall of Fire` / `Wall of Ice` / `Blade Barrier` / `Wall of Light` (нужна геометрия стены). Все — manual-замок до реализации.
- **Решено не делать (сессия 14):** `XPHB:Glyph of Warding` — остаётся manual-замком.
- Остальные зоны с триггерами (Create Bonfire, Cloud of Daggers, Spike Growth, Tasha's Caustic Brew, Sickening Radiance, Wind Wall, Black Tentacles, Maelstrom, Dawn, Insect Plague, Conjure Animals, Wrath of Nature, Yolande, Dust Devil, Maximilian's) — механизм есть, доработок по аудиту не требуют.

## F. Духи-атаки — 2

- `XPHB:Conjure Elemental`, `XPHB:Conjure Fey` — нужен дух + повторяющаяся атака (грантованный attack-action, как Flame Blade). Сейчас manual-замок (был ложный прямой урон).

## G. Перемещение — 2

- `XPHB:Dimension Door` — ⚠️ + пассажир. Сейчас manual-замок (был авто-урон 4d6 из клаузы провала).
- `XGE:Thunder Step` — ⚠️ телепорт + урон в точке выхода (сейчас save по цели).

## H. Особая логика — 0 открыто

**«Нет типа» — не автоматизируем (решение владельца, сессия 13):** `XPHB:Phantasmal Force`, `XPHB:Control Water`, `XGE:Transmute Rock`, `XPHB:Meld into Stone`, `XPHB:Forbiddance`, `XGE:Create Homunculus`, `XPHB:Dream`, `XPHB:Contact Other Plane`, `XPHB:Geas`, `XGE:Soul Cage` — в `AUTOMATION_SPELLS` явные manual-записи (иначе деривация из данных давала ложный спас/авто-урон). **Не переоткрывать.**

**Отложено:** `XPHB:Ray of Enfeeblement` — «половина урона от атак» (механики нет; выключен как manual). `XPHB:Bigby's Hand` (в данных — Arcane Hand) — 4 режима-действия (кулак/толчок/захват/укрытие) + рука с HP/КЗ; у зон нет HP, нужен отдельный срез (решение владельца, сессия 13).

## I. Контроль / дебафф / утилита (дополнено 25.09.2026) — 12

Manual: `automationForSpell` → `resolution:'manual'`. Часть опирается на существующие движки (состояния, зоны, геометрия стен, `creatureTypeOf`).

**Сделано (сессия 14):** `XPHB:Charm Monster` — `chipSpell` (ручная механика `byDesign`): каст вешает состояние **Charmed** (реальный condition, не только чип), механику ведёт мастер, красный маркер не рисуется. `XPHB:Compulsion` — то же + 4 выданных бонусных действия «Вверх/Вниз/Влево/Вправо»; выбранное направление видно стрелкой над целью до конца её хода, движение ведёт мастер.

| Ур. | Заклинание | Что нужно |
|---|---|---|
| 2 | `XPHB:Crown of Madness` | очарование + вынужденная атака и поддержка контролем действием (движка принуждения нет) |
| 2 | `XPHB:Gust of Wind` | зона-линия 10×60: толчок 15 фт и повтор спасброска в конце хода, ×2 движение против ветра, бонус-смена направления |
| 3 | `XPHB:Dispel Magic` | оканчивает заклинания ≤3 круга, для 4+ — проверка характеристики; движка снятия чужих эффектов/зон нет |
| 3 | `XGE:Enemies Abound` | спас Инт. + «все вокруг враги» (случайные цели, провокации, повтор спасброска при уроне) |
| 3 | `XPHB:Magic Circle` | зона-цилиндр r10 h20 на выбранные типы: запрет входа, очарования, испуга, одержимости |
| 3 | `XGE:Wall of Sand` | стена (обзор заслонён, внутри `blinded`, движение ×3) — геометрии стен нет |
| 4 | `XPHB:Guardian of Faith` | зона-страж: 20 излучением (спас Лов.) при перемещении впервые за ход/начале хода в 10 фт, исчезает после 60 суммарного урона |
| 4 | `XPHB:Otiluke's Resilient Sphere` | сфера-барьер вокруг цели: непроницаема для атак/эффектов, спас Лов., катится действием; нужна механика барьера |
| 5 | `XPHB:Dispel Evil and Good` | бафф против типов (помеха их атакам по вам) + режимы: изгнание на родной план, снятие очарования/испуга/одержимости |
| 5 | `XPHB:Telekinesis` | спас Сил. + перемещение существа/объекта на 30 фт, подвешивание, тонкие манипуляции |
| 5 | `XPHB:Wall of Force` | стена (плиты/сфера/купол): непроницаема, неуязвима, снимается только Дезинтеграцией |
| 5 | `XPHB:Wall of Stone` | стена-камень из плит (КЗ/Хиты, можно сделать постоянной) — геометрии стен нет |

**Отложено владельцем (сессия 14):** `XGE:Watery Sphere` — вне скоупа; при реализации мало чипа: нужно состояние `restrained` + перемещение/сбивание с ног.

## 8. Системные (открыто)

1. **Каталог:** `XPHB:Guidance` (все проверки вместо выбранного навыка; владелец решил оставить как есть).
2. **Универсальная подсветка целей:** обобщить механизм Steel Wind Strike/Spiritual Weapon на все режимы выбора. Общие правила уже в `shared/src/rules/targeting.ts` (`creatureTargetIssue`, `cellNearTargetFeet`, `teleportCellsNearTargets`), клиентская подсветка — `TableTop` (`eligibleTargets`/`targetEligible`/`teleportCells`) + `AimLayer`, локальный `blocked` — стор `aimToCursor`. Нужно: единый слой «кандидаты режима» для single-target/multi/area (кто/какие клетки доступны, подсветка кандидатов и выбранных, игнор клика по невалидным); правила — только в shared, клиент — рендер; заодно вынести остальные inline-проверки таргетинга (цель/область/зонные действия).

## Инвентарь (осталось)

| Тип | Осталось |
|---|---|
| effect-баффы | 7 (B4-трансформации) |
| zone/повтор | Healing Spirit, Cordon of Arrows, стены, Storm Sphere |
| духи-атаки | 2 (Conjure Elemental/Fey) |
| перемещение | 2 (Dimension Door, Thunder Step) |
| отложено | Ray of Enfeeblement, Arcane Hand (H) |
| контроль/утилита (I) | 12 |
