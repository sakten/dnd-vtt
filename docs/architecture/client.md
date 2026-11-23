# Client: стол, состояние и транспорт

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Konva-стол, zustand, socket-транспорт, панели и окна. Клиентские проверки — UX; источник истины на сервере.

## Модули

- `net/socket.ts` — создание socket.io; `net/bridge.ts` — транспорт: подписка на события → экшены стора, heartbeat, реконнект, автовход по `?room=`, URL-гигиена; `attachSocketBridge` возвращает `dispose()` (снятие
слушателей/таймера), стор хранит его в `socketDispose` и умеет `disposeSocket()` (HMR/тесты/выход).
- `i18n/` — локализация: `index.ts` (язык по `?lang=`/localStorage/`navigator`, `t()` с фолбэком на EN, `plural`), словари `ru.ts`/`en.ts` (ключ — источник `ru`, паритет 978), `names.ts` (`useNames` — грузит имена
текущего языка до рендера), `useLocalizedText.ts` (ленивая догрузка описаний заклинаний/фитов/черт), `domain.ts`/`rolls.ts`/`system.ts`/`errors.ts`.
- `domain/scene.ts` — чистые переходы сцены (`patchToken`, `replaceToken`, `upsertToken`, `removeTokenById`, `setCombat`, `setFog`, `setGrid`, `resizeGrid`, `withMaps`).
- `store/` — zustand: `types.ts` (GameState и `Slice`), `helpers.ts` (`throttled`, `emitInMap`/`emit`/`emitThrottled*` — socket-эмиты с mapId и троттлингом), `selectors.ts`/`hooks.ts`
(`activeMapOf`/`tokenById`/`characterTokenOf`, `useActiveMap`/`useMapToken`), `uiReset.ts` (`UI_RESET`, `clearTokenUiFor`), `slices/*` (`room`, `maps`, `library`, `combat`, `actions`, `tokens`, `chat`, `sheet`, `view`,
`reactions`), `useGameStore.ts` — композиция.
- `components/` — Konva-стол (`TableTop`, `TokenView`, `GridLayer`, `ZoneLayer` — заливка зон/областей), панели (карты, токены, чат, инициатива, ресурсы, игроки, `ActionPanel`), модалки (`GridSettingsModal`,
`RoomSettingsModal` — режим тестов и кастомные заклинания комнаты: импорт/экспорт JSON 1:1), `CritOverlay`/`ThreeD20` (ленивый three.js), `SpellIcon`/`spellIcons` (420 рукописных иконок; красный кружок у
неавтоматизированных заклинаний, `spellAutomated`; «+» у `CUSTOM:`), `SpellsPanel` (выбор заклинаний), `SpellPopover` (накладывание: круг/апкаст, Adv/Dis, пометка «эффект не автоматизирован»; после попапа — выбор
цели/области на карте), `AimPanel` (режимы выбора цели: `targeting` — клик по токену для любой способности/атаки, `aim` — прицеливание области, `multiTarget` — выбор цели на каждый луч, `scatter` — до 5 целей и точка
назначения на каждую (Scatter); курсор-прицел и подсветка в `TableTop`), `DamageDefensesForm` (сопротивления/иммунитеты/уязвимости юнита), `ConditionIcon`/`ConditionChips`/`ConditionsOverlay`/`ConditionsForm` (состояния:
глифы, чипы над токенами/в инициативе, управление в меню токена), `EffectChips` (активные эффекты Ф8; чипы над токенами и в панелях, снятие в меню токена, концентрация в `ResourcesPanel`). Права в UI — `lib/control.ts`:
`useIsDm`/`isDmWith` (реальный DM или режим тестов), `useIsRealDm` (только реальный DM — настройки комнаты), `canControlTokenWith`/`useCanControl`/`useCanControlId` (общее правило `controlsToken` из shared),
`isCharacterTokenWith` (лист игрока только при привязке через `libraryItemId`), `useCanEndTurn`.
- `screens/` — `JoinScreen`, `AdminScreen`, `TableScreen`. `lib/` — `api.ts` (загрузка), `control.ts` (клиентские проверки контроля — только UX), `sheet.ts`, `spells.ts` (ленивый `loadSpells()`), `useSpells` (канон +
`room.customSpecs`, R16 срез 5), `useImage.ts`, `branding.ts` (иконка/заголовок local/prod), `id.ts` (`newId` с fallback для небезопасного контекста), `gridDetect.ts`/`gridDetectImage.ts` (авто-выравнивание сетки по
изображению), `wallDetect.ts`/`wallDetectImage.ts` (авто-поиск стен по сетке, A++), `los.ts` (видимые клетки), `useVision.ts` (хук зрителей обзора), `useDragSize.ts` (растягивание панелей).
- `styles/` — CSS по фичам, подключается через `styles.css` (`@import` в исходном порядке).
- `window.__vtt` — стор в window для e2e.

## Стол и рендер

`client/src/components/TableTop.tsx` — композиция сцены (5 Konva-слоёв); ввод/камера/кисти/drop — `lib/useMapCamera`/`useFogBrush`/`useAreaBrush`/`useTokenDrop`, чистая геометрия тумана и общий `visibleCell` —
`lib/fog.ts`, слои оверлеев — `components/table/` (`ObjectsLayer`/`AimLayer`/`TokenLayer`/`VeilLayer`); ПКМ (contextmenu) в режиме прицела/выбора цели отменяет взаимодействие; `TokenView`, `ZoneLayer`,
`store/slices/view.ts`
