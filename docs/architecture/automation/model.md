# AutomationSpec: модель и ветки

Назад: [AUTOMATION.md](../../../AUTOMATION.md).

## 1. Модель

- **Ветка (`primary`)** — как спек разрешается рантаймом; ровно одна. Объявленный `AutomationResolution`: `attack | save | auto | effect | utility | summon | shape | manual`. `shape` допустим только вместе с `save`
(Polymorph); Wild Shape — отдельный socket-flow (`server/src/socket/forms.ts`).
- **Блоки** — механизмы, ортогональные ветке. Существующие: `zone`, `effects`, `summon`, `utility`, payload (`save`/`damage`/`heal`/`successDamage`/`endConditions`/`healTo`/`containment`). Выделяются явно: `loadout`,
`triggers`, `uses`, `movement`, `choices`, `selection`, `vision`.
- **Вложенность**: `GrantedAction.def` — полноценный спек (своя ветка); `zone.triggers.*`, `effect.triggers.*`, `burst`, `zone.onCreate` — общий payload; блок `uses` расходуется событиями.

Обоснование (аудит 420 заклинаний): 66 из 245 зелёных многосоставные — Ice Knife (attack + burst), Jallarzi (save + zone:aura + triggers), Wall of Light (save + zone + granted action), Eyebite (carrier + 3 действия со
своими save), Polymorph (save + shape); механика копий (`extends` + `patch`) требует дерева именованных узлов.

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
