# Server: runtime, комнаты и socket-события

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Express/Socket.IO, `RoomManager`, права, рассылка и регистраторы. Новое событие всегда проходит этот слой.

## Новое socket-событие, правка протокола

`shared/src/socket/contract.ts` → `server/src/socket/<домен>.ts` (`ctx.on`) → права `socket/guards.ts` → рассылка `socket/context.ts` (`visibleToken`/`emitTo`/`broadcast*`)

## Права, «кто это может»

`server/src/socket/guards.ts` (`playerScope`/`scopedToken`/`rejectIfReaction`/`rejectIfIncapacitated`), `context.ts` (`isDm`/`canControlToken`, `testMode`), клиент — `client/src/lib/control.ts`; пометку `isPlayerToken` в
библиотеке меняет DM или автор предмета (`LibraryItem.createdBy`)

## Модули

- `src/index.ts` — Express + Socket.IO, статика `client/dist`, `/api/upload` (проверка magic bytes, лимит файла 50 МБ, подпапка комнаты `uploads/<code>/`, квота комнаты, webp-производные: thumb/token, картам — ещё
`screen` до 4K для стола), health, error-middleware, graceful shutdown (flush комнат).
- `src/config.ts` — конфиг из env: `ROOM_QUOTA_MB` (`VTT_ROOM_QUOTA_MB`, дефолт 500), `SAVE_DEBOUNCE_MS` (`VTT_SAVE_DEBOUNCE_MS`, дефолт 120000), `CHAT_SAVE_DEBOUNCE_MS` (`VTT_CHAT_SAVE_DEBOUNCE_MS`, дефолт 120000).
- `src/store.ts` — персистентность комнат: `data/rooms/<code>.json` (чат — отдельный `<code>.chat.json`, пишется только при изменении), атомарная запись (tmp+rename), debounce из env, `flushSaves`; uploads:
`roomUploadDir`/`removeRoomUploadDir`/`dirSize`.
- `src/rooms.ts` — `RoomManager`: in-memory комнаты, сцена/библиотека/ресурсы/бой, контроллеры, `saveSoon`; `tokenById`/`locateToken`, `controllerOfToken`, `rollSave` (спасбросок с adv/dis и авто-провалом); чистые
`controllerIdOfToken`/`controllerIdOfItem`/`hasResourceFor` экспортируются для резолверов.
- `src/roomNormalize.ts` — `hydrateRoom`: приводит прочитанный `PersistedRoom` к `Room` (дефолты, нормализация листов/контроллеров); покрыт vitest.
- `src/socket.ts` — тонкая обёртка `io.on('connection')`, вызывает регистраторы.
- `src/socket/context.ts` — `ConnCtx`: `roomCode`/`playerId` соединения, безопасные `on`/`onDisconnect` (try/catch на каждое событие), `visibleToken`, `visibleLibrary`,
`broadcast`/`broadcastAll`/`broadcastMaps`/`broadcastLibrary`, `emitToken`, `emitResources` (resources:update конкретному игроку), `notifyPlayers` (`players:update`), `applyHp` (HP через `adjustTokenHp` + рассылка
токенов/ресурсов + проверка концентрации при уроне), `dmRoom`, `isDm`, `canControlToken`. `isDm` учитывает `Room.testMode` (режим тестов: права ведущего у всех игроков комнаты).
- `src/socket/guards.ts` — общая преамбула хендлеров: `playerScope` (игрок+комната), `scopedToken` (типы id, поиск токена, права контролёра/DM, `dmOnly`), `rejectIfReaction`/`rejectIfIncapacitated` (проверки с сообщением
в чат).
- `src/socket/messages.ts` — `pushRollMessage`/`pushTextMessage`: единая сборка и рассылка сообщений чата (структурные `rollKind`+`labelParams`; явный `label` — только повтор из чата).
- `src/spells.ts` — каталог заклинаний на сервере (`findSpell(key, room?)` — сначала кастомы комнаты, затем канон; импорт `shared/spellsData`), резолв кастомов — `src/customSpells.ts` (`importCustomSpell`: JSON-Schema +
`validateSpec` + `compileSpec`, копии `extends`/`patch` от канона или уже импортированной записи); `socket/spells.ts` (`spell:cast`: права, выбор из листа, ячейка/слот, сбор целей по области (`origin`/`direction` +
`tokensInArea`), `validateSpellCast`, шанс провала соматики от `restrictions`; `spell:endConcentration`) + `socket/spellResolve.ts` (`validateSpellCast`/`resolveSpellCast` на `AutomationDef`) + `socket/automation.ts`
(generic-executor `executeAutomation`: utility/effect/attack/save/auto/manual, `applyDefEffects`; им ходят и заклинания, и действия) + `socket/effects.ts` (тик эффектов, проверка концентрации при уроне) +
`socket/zones.ts` (движок зон: `createZoneFromDef`, `tickZones`, `handleMovementZones`, `removeZonesOfSource`; аура/enter-exit/start-endOfTurn, снятие по концентрации) + `socket/effectsApply.ts`
(`applyEffectTo`/`removeZoneEffects`) + `socket/misdirect.ts` (Mirror Image: подмена попадания образами).
- Регистраторы по доменам: `admin`, `room` (`room:create`/`room:join`/`player:remove`/`room:settings` — режим тестов, меняет только реальный DM), `custom` (`custom:import`/`custom:remove` — кастомы комнаты, только DM),
`map`, `doors`, `draw`, `library`, `combat`, `token`, `forms`, `chat`, `sheet`, `resources`, `dice`, `rollAnim`, `actions`, `spells`, `reactions`.
- Правило: новое socket-событие = тип в shared + регистратор + `ctx.on` + проверка прав (`isDm`/`canControlToken`) + рассылка через `visibleToken`/`visibleLibrary`.
- Туман на сервере **не фильтруется** — это клиентский UX (принятый риск, см. ниже). Статы скрываются по `showStats` и контролю владения.
