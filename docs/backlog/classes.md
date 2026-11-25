# Backlog: классы

Индекс — [TODO.md](../../TODO.md) / [ROADMAP.md](../../ROADMAP.md). Справочник механик — [docs/features/classes.md](../features/classes.md).

## CLASS-01

**Celestial Revelation (Aasimar), P2.** Доп. урон PB раз в ход сейчас применяется автоматически на первый урон в ходу. Сделать опциональным окном «применить/нет» для атак и заклинаний, с типом из выбранного облика (radiant/necrotic) и учётом лимита «раз в ход».

Файлы: `shared/src/domain/automation.ts` (`oncePerTurn`), `shared/src/rules/races.ts`, серверные хуки урона; проверки — `shared/src/rules/races.test.ts`.
