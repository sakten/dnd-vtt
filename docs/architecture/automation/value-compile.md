# AutomationSpec: ValueExpr, имена, валидатор и компиляция

Назад: [AUTOMATION.md](../../../AUTOMATION.md).

## 4. ValueExpr (DiceRef)

Значения спека (кости, типы, бонусы) — ссылки `ValueExpr`, резолвит компилятор:

- `{ ref: 'cantrip' | 'damage' | 'part' | 'upcastDice' | 'spellDamage' | 'upcastAttack' | 'type0' | 'spellMod' | 'castLevel' | 'characterLevel' | 'choice'; part?; choice?; fallback? }` — данные заклинания, опции каста,
выбор из `choices`;
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
- Массивы — коллекции с `id`: `effects.<id>`, `zone.actions.<id>`, `grantedActions.<id>`, `choices.<id>`, `triggers.<slot>`. Патч адресует узел по имени, а не по индексу (копия может менять и `choices.<id>.options` — в
пределах словаря параметра, см. §3.5).
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

Слои: структура — JSON-Schema (draft 2020-12) в `automation/schema.ts` (`additionalProperties: false` на всех узлах; экспорт `AUTOMATION_SPEC_SCHEMA` / `MATERIALIZED_AUTOMATION_SCHEMA`, второй — запись без `key`/`name`);
валидируется ajv в `automation.schema.test.ts` и при генерации `npm run catalog` (ajv — корневой devDependency, в клиентский бандл не входит; для сервера/скриптов — subpath `shared/automationSchema`). Семантика (матрица
и словари ниже, ссылки `ValueExpr`) — `validateSpec` в `compile.ts`, вызывается `compileSpec` (ошибка — исключение, не молчаливое поле).

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

Обязательные условия: `attack` требует `attack` (или `weaponAttack`); `effect` — непустой `effects`; `utility` — `utility.kind`; `summon` — `summon`; `manual` — только `byDesign`-замки и отложенный контент; `ActionSpec`
с `baseActionId` несовместим с payload-полями (`primary`/`save`/`damage`/`effects`/`utility`/`count`/…) — ошибка валидатора, а не молчаливая потеря.

## 7. Компиляция и миграция

1. `compileSpec(spec, opts): AutomationDef` — резолв `extends`/`patch` → подстановка `choices` → резолв `DiceRef`/скейлов → сборка `AutomationDef`. Рантайм (`dispatchKind`, `executeAutomation`) не меняется. Срез 4.1:
`compileSpec` сам применяет правило данных «длительность ровно 1 минута → 10 раундов» (`spellMaxRounds`), если спек не задал `maxRounds` — запись компилируется без пост-обработки в `automationForSpell`.
2. Шаблоны (`zoneStorm`, `weaponAttack`, `chain`, `teleportAfter`, `summon`) — конструкторы спеков, не отдельная модель.
3. Миграция — батчами по классам (сначала каталог + билдеры на `loadout`/`uses`/`choices`, затем `triggers`/`movement`/`selection`/`vision`), под характеризационным замком: хэши производных не меняются, кроме осознанных
правок.
4. `CUSTOM:`-каталог — срез 5: кастомы живут в комнате (`room.customSpecs`), вход — JSON копии/полной записи, экспорт 1:1 (см. §8); шаг 5 (UI конструктора): К0 — `SpecIssue`-коды вместо сообщений + i18n `error.spec.*`;
К1 — каркас `SpellConstructorModal` (мастер профилей, копия канона/кастома, мета-форма, превью, клиентская валидация, сохранение полной записью); К2 — редакторы автоматизации (эффекты с модификаторами/состояниями,
синхронизация save/attack, manual, переключение простой ветки); К3 — призыв (бестиарий + профиль), утилиты, shape, JSON-вкладка в конструкторе (триггеры/зоны/гейты — там); К3.5 — редакторы сложных блоков прямо в форме
(части урона, зона с флагами и слотами триггеров, аура через общий `EffectListEditor`, `choices`); К3.6 — реакции эффектов (`EffectTriggers`): события × операции (ответ уроном/снижение/доп. урон/перенос/обрыв/повторный
спас/ward/спас носителя…) и тёрн-слоты; форма записи объекта/массива сохраняется, вложенные операции/гейты — JSON; К3.7 — оружейное в форме (`weaponAttack`-райдеры + `effect.loadout`), ссылки `{ref}`/`tiers`/`concat` —
read-only «из данных»; К3.8 — `uses` (заряды/расходы/misdirect) и особые поля эффекта (tempHp/targets/senses/иммунитеты/escape/onEnd/метки/доминирование/banish и др.); К3.9 — продвинутая зона (onCreate через общий
payload-редактор, charges/dealtLimit/anchor/excludeSource/excludeCreatureTypes/movementCost); К3.10 — верхнеуровневое (конверсия урон↔лечение, targets/side/autoTargets,
halfOnMiss/lifesteal/maxHpFromDamage/undeadTempHp/lifeTransfer, successDamage, burst/chain/force); К3.11 — свет эффекта/зоны, ограничения `restrictions` и meta-атаки (`attacks` + `count`); К3.12 — наведение (`targeting`:
вид/дистанция/цели/отсчёт/область) и мгновенная область каста (`area`, в т.ч. `{from:'spell'}`); К3.13 — действия зон (`zone.actions`: перемещение, атака, спас+область) и утилиты (все виды,
пассажир/вспышка/`blockedDamage`/Scatter); К3.14 — модификаторы и реакции `weaponAttack.hitEffect` (общие редакторы эффектов выделены в `EffectModifiersEditor`/`EffectTriggersEditor`); Р1 — мастер конструктора по осям
payload × (атака/спас/авто) × (цели/область/зона/аура) поверх тех же блоков (`client/src/lib/spellKits.ts`, без миграции данных); Р2 — условная форма: для распознанного kit видны только его блоки, payload-ы
(эффект/всплеск) добавляются чипами, нестандартные записи показываются целиком; Р3 — тип зоны (статичная/перемещаемая/аура: `anchor`/`movable`/move-действие), сводка kit в шапке формы и подсказка каста-реакции; тип урона
пишется прямо в поле костей (`3d6fire`) с чат-подсказками (`DamageDiceField`/`lib/damageDice.ts`), чипы типов из блока урона убраны, типы синхронизируются в автоматизацию; блок «Атака и спасбросок» показывает только
разрешение kit (у AoE нет выбора атаки, у атаки — спасброска, у авто — обоих); матрица разрешений по payload (лечение — только «без броска», эффект — спас/авто), блок «Урон/Лечение» по флагу healing, верхнеуровневые
галки — только у своих payload'ов, зона/аура из мастера получает стартовый триггер (enter/startOfTurn) с копией payload'а; апкаст по kit (лучи — урону, цели — эффекту, кости/плоско — урон/лечение/эффект/утилита/оружие, у
призыва скрыт — скейл в профиле), ступени `upcast.tiers` редактируются у оружия; в JSON остаются тонкие стены, Leveled и гейты; кастомы без 5e.tools areaTags считаются областью по `areaSpec` (`spellHasArea`), выбор типа
урона при касте привязывается к урону (`syncChoiceDamage`: литерал ↔ `{ref:'choice'}`, нормализация при импорте и гидрации комнаты); пары «цель × режим» модификаторов ограничены матрицей (`modifierModeAllowed`: защита —
только урон, преимущество — только броски, иначе ошибка `modifierBadMode`); любые ссылки «Из данных» в форме переводятся на «Свои» (кнопка заменяет `ValueExpr` литералом с предпросмотром `fallback`, `ExprField`),
зональные payload'ы распознают ref/parts как «Из данных» (`slotDamageSource`); дальше К4 (e2e-сценарий конструктора).
5. Ручной слой (149 manual) не мигрируем — остаётся `manual`/`byDesign`.
