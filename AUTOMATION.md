# AUTOMATION.md — AutomationSpec

Короткий индекс спецификации. Детали — по разделам; не читать все сразу.

Спелл — композиция блоков с одной ведущей веткой; `AutomationDef` остаётся целевым форматом, `AutomationSpec` компилируется в него.

## Разделы

- [Модель и ветки](docs/architecture/automation/model.md) — разделы 1–2.
- [Блоки](docs/architecture/automation/blocks.md) — раздел 3: loadout/triggers/uses/движение/выбор/зоны.
- [ValueExpr, имена, валидатор и компиляция](docs/architecture/automation/value-compile.md) — разделы 4–7.
- [Принятые решения](docs/architecture/automation/decisions.md) — раздел 8, «Принято».
- [Открытые вопросы](docs/architecture/automation/open-questions.md) — раздел 8, «Открыто»/«Решено».
- [Контроль общности](docs/architecture/automation/control.md) — раздел 9.

Контракт веток исполнителя — `server/src/socket/automation/dispatch.ts` + `dispatch.test.ts`.
