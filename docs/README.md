# Документация проекта

Назад: [README.md](../README.md) · [ARCHITECTURE.md](../ARCHITECTURE.md).

Индекс подробных документов. Корневой `ARCHITECTURE.md` — только карта и ссылки; здесь лежат детали, которые не нужно читать целиком.

## Документы

- [ARCHITECTURE.md](../ARCHITECTURE.md) — индекс и правила навигации.
- [architecture/shared.md](architecture/shared.md) — shared-домены, правила, данные.
- [architecture/server.md](architecture/server.md) — сервер, комнаты, socket-события.
- [architecture/client.md](architecture/client.md) — клиент, стор, стол, панели.
- [architecture/scripts.md](architecture/scripts.md) — сборщики, smoke/e2e, тест-киты.
- [../ROADMAP.md](../ROADMAP.md) — текущее направление и фокус.
- [../TODO.md](../TODO.md) — ближайшая очередь, максимум 10 пунктов.
- [backlog/spells.md](backlog/spells.md) — длинный хвост по заклинаниям.
- [backlog/classes.md](backlog/classes.md) — очередь классов.
- [backlog/docs.md](backlog/docs.md) — работы по документации.
- [decisions.md](decisions.md) — журнал принятых решений.
- [../AUTOMATION.md](../AUTOMATION.md) — индекс AutomationSpec, детали в `architecture/automation/`.
- [../REFACTOR.md](../REFACTOR.md) — индекс открытых карточек, детали в `refactor/`.
- [features/classes.md](features/classes.md) — классы, подклассы, фиты, манёвры, CBT.
- [features/combat.md](features/combat.md) — эффекты, урон, бой, реакции.
- [features/magic.md](features/magic.md) — заклинания, автоматизация, зоны, призывы, формы.
- [features/world.md](features/world.md) — карты, туман, стены, двери, зрение.
- [features/content.md](features/content.md) — виды, бестиарий, оружие, локализация.

Операционные документы (`AGENTS.md`, `PLAN.md`, `SESSION.md`, `DEPLOY.md`, `ISSUES_RELEASE.md`, `Legal_TODO.md`, `Load_test.md`) ведутся локально и в репозиторий не входят.

## Правило чтения

1. Статус и очередь — `ROADMAP.md` + `TODO.md`; детали — **один** файл `docs/backlog/<тема>.md`.
2. Карта кода — `ARCHITECTURE.md`; дальше **один** раздел `docs/architecture/*` или `docs/features/*`.
3. `PLAN.md` — локальный архив, не читать; `AUTOMATION.md`/`REFACTOR.md` — только через `grep` и нужный раздел.
4. Не читать целиком сгенерированные данные (`shared/src/data/*.json`, `text.ru/*`), `spellIcons.tsx`, `handlers.test.ts` и логи.
5. Новую деталь абилки добавлять в feature-документ, а в корень — только ссылку.
