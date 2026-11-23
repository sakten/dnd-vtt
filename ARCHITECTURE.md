# Architecture

Короткий индекс проекта. Детали — в `docs/`; открывать только раздел по теме, не читать все документы.

## Как читать

1. Начать с этого файла и `docs/README.md`.
2. Выбрать **один** документ по задаче; для незнакомой области вначале `grep`, затем точечный `Read`.
3. `PLAN.md`, `AUTOMATION.md` и `REFACTOR.md` читать только нужным разделом, не целиком.
4. Новую деталь конкретной абилки добавлять в `docs/features/*`, а здесь — только ссылку.

## Карта по задачам

| Тема | Точка входа | Детали |
|---|---|---|
| Новое socket-событие, протокол | `shared/src/socket/contract.ts` → `server/src/socket/*` → `guards.ts` → `context.ts` | [server](docs/architecture/server.md) |
| Каст и автоматизация заклинаний | `SpellPopover.tsx` → `socket/spells.ts` → `spellResolve.ts` → `automation/` | [magic](docs/features/magic.md), [AUTOMATION.md](AUTOMATION.md) |
| Классы, подклассы, манёвры, фиты | `rules/classActions.ts`, `rules/featureAutomation.ts`, `rules/attackRiders.ts` | [classes](docs/features/classes.md) |
| Эффекты, урон, бой, OA, реакции | `rules/effects.ts`, `rules/conditions.ts`, `socket/attackResolve.ts`, `socket/reactions/*` | [combat](docs/features/combat.md) |
| Зоны, призывы, формы, FX | `socket/zones.ts`, `socket/summons.ts`, `room/shape.ts`, `components/spellFx/*` | [magic](docs/features/magic.md) |
| Карты, туман, сетка, стены, двери, зрение | `socket/map.ts`, `socket/doors.ts`, `rules/vision.ts`, `client/src/components/TableTop.tsx` | [world](docs/features/world.md) |
| Бестиарий, виды, оружие, локализация | `data/*.json`, `rules/bestiary.ts`, `rules/races.ts`, `rules/text.ts` | [content](docs/features/content.md) |
| Лист, ресурсы, библиотека | `socket/sheet.ts`, `socket/resources.ts`, `socket/library.ts`, `client/src/components/*Panel.tsx` | [server](docs/architecture/server.md), [content](docs/features/content.md) |
| Клиент: стор, транспорт, стол | `client/src/store/*`, `client/src/net/bridge.ts`, `client/src/components/*` | [client](docs/architecture/client.md) |
| Скрипты, данные, тесты | `scripts/*`, `shared/src/data/*.json`, `server/src/test/*` | [scripts](docs/architecture/scripts.md) |

## Маршруты

- **Каст:** `SpellPopover` → `spell:cast` → `validateSpellCast` → `resolveSpellCastWithReactions` → `resolveSpellCast` → `executeAutomation`.
- **Движение:** `TokenView.onDragEnd` → `finalizeTokenMove` → `token:move` → `handleMovementZones`, OA → `maps:update`.
- **Конец хода:** `combat:endTurn` → `tickActiveTurn('end')` → `endTurn` → `tickActiveTurn('start')`.

## Слои

- **shared** — контракт, домен, нормализация, правила и данные. [shared.md](docs/architecture/shared.md)
- **server** — Express/Socket.IO, `RoomManager`, права, регистраторы и рассылка. [server.md](docs/architecture/server.md)
- **client** — Konva-стол, zustand, транспорт и панели. [client.md](docs/architecture/client.md)
- **scripts** — сборщики данных, smoke/e2e/shots и тест-киты. [scripts.md](docs/architecture/scripts.md)

## Инварианты

- Новое socket-событие: тип в `shared` + регистратор + `ctx.on` + права (`isDm`/`canControlToken`) + `visibleToken`/`visibleLibrary`.
- Источник истины для правил и прав — `shared`/`server`; клиентские проверки только UX.
- Туман сервером не фильтруется — это клиентский UX; статы скрываются по `showStats` и контролю владения.
- Детали механик не дублировать в этом файле: feature-документ + короткая ссылка из карты.
