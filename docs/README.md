# Документация проекта

Назад: [ARCHITECTURE.md](../ARCHITECTURE.md).

Индекс подробных документов. Корневой `ARCHITECTURE.md` — только карта и ссылки; здесь лежат детали, которые не нужно читать целиком.

## Документы

- [ARCHITECTURE.md](../ARCHITECTURE.md) — индекс и правила навигации.
- [architecture/shared.md](architecture/shared.md) — shared-домены, правила, данные.
- [architecture/server.md](architecture/server.md) — сервер, комнаты, socket-события.
- [architecture/client.md](architecture/client.md) — клиент, стор, стол, панели.
- [architecture/scripts.md](architecture/scripts.md) — сборщики, smoke/e2e, тест-киты.
- [../AUTOMATION.md](../AUTOMATION.md) — индекс AutomationSpec, детали в `architecture/automation/`.
- [../REFACTOR.md](../REFACTOR.md) — индекс открытых карточек, детали в `refactor/`.
- [features/classes.md](features/classes.md) — классы, подклассы, фиты, манёвры, CBT.
- [features/combat.md](features/combat.md) — эффекты, урон, бой, реакции.
- [features/magic.md](features/magic.md) — заклинания, автоматизация, зоны, призывы, формы.
- [features/world.md](features/world.md) — карты, туман, стены, двери, зрение.
- [features/content.md](features/content.md) — виды, бестиарий, оружие, локализация.

## Правило чтения

1. Начать с корневого ARCHITECTURE и этого индекса.
2. Открыть **один** документ по теме; не читать все feature-документы.
3. `PLAN.md`, `AUTOMATION.md` и `REFACTOR.md` читать только через `grep` и нужный раздел.
4. Не читать целиком сгенерированные данные (`shared/src/data/*.json`, `text.ru/*`), `spellIcons.tsx`, `handlers.test.ts` и логи.
5. Новую деталь абилки добавлять в feature-документ, а в корень — только ссылку.
