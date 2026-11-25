# D&D VTT

Веб-приложение виртуального стола для D&D: карты с сеткой, токены, туман, чат с бросками, автоматизация правил и синхронизация между игроками в реальном времени.

## Стек

- TypeScript, npm workspaces: `shared`, `server`, `client`.
- Сервер — Node.js + Express + Socket.IO.
- Клиент — Vite + React + Konva + zustand.
- Данные — снимки 5e.tools и генераторы в `scripts/`.

## Быстрый старт

```bash
npm ci
npm run dev      # сервер + клиент
```

Прод-сборка:

```bash
npm run build
npm start        # :3001, клиент из client/dist
```

Нужен Node.js >= 22.

## Проверки

- `npm run check:quiet` — тесты, typecheck, lint и `docs:check`.
- `npm run test:coverage` — покрытие v8 по workspace (отчёт в `shared|server|client/coverage`).
- `npm run verify` — deploy-тесты, server, build, e2e и скриншоты (нужен запущенный `npm start` и Chrome).
- `npm test` — все юнит-тесты.

## Документация

- [ROADMAP.md](ROADMAP.md) — текущее направление.
- [TODO.md](TODO.md) — ближайшая очередь.
- [docs/README.md](docs/README.md) — индекс детальных документов.
- [docs/backlog](docs/backlog/) — тематические бэклоги.
- [docs/decisions.md](docs/decisions.md) — журнал решений.
- [ARCHITECTURE.md](ARCHITECTURE.md) — карта кода и маршрутов.
- [AUTOMATION.md](AUTOMATION.md) — AutomationSpec.
- [REFACTOR.md](REFACTOR.md) — архитектурный долг.

Операционные документы (`AGENTS.md`, `PLAN.md`, `SESSION.md`, `DEPLOY.md`, `ISSUES_RELEASE.md`, `Legal_TODO.md`, `Load_test.md`) ведутся локально и в репозиторий не входят.
