import { S } from './state.mjs';
import { check } from '../lib/check.mjs';
import { findButton, waitFor } from '../lib/e2e-helpers.mjs';

// D1: кнопки экономики действий должны использовать общие правила shared
// (`attackAvailable`/`slotSpendable` + `restrictionsFor`). Проверяем реальный
// клиент: воин 5 (Extra Attack) в активном бою, Slow (`oneAttackOnly`) гасит
// повторную атаку. Комната создаётся с нуля; в полный прогон НЕ входит —
// запуск по требованию: `$env:E2E_ONLY='11'; npm run e2e`.

// 1. Комната (как 01-join).
await S.page.goto(S.BASE, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('[data-testid="join-card"]');
const nameInputs = await S.page.$$('[data-testid="join-card"] input');
await nameInputs[0].type('Мастер');
await S.page.goto(`${S.BASE}?admin=1`, { waitUntil: 'networkidle0' });
await S.page.waitForSelector('[data-testid="admin-card"]');
const createBtn = await findButton(S.page, '[data-testid="join-actions"] button', 'Создать новую игру');
await createBtn.click();
await S.page.waitForSelector('[data-testid="table-screen"]');
await waitFor(S.page, () => !!(window.__vtt && window.__vtt.getState().roomCode));

// 2. Карта через файловый инпут панели токенов (как 02-map-grid).
const fileInputs = await S.page.$$('input[type=file]');
await fileInputs[0].uploadFile(S.mapPath);
await waitFor(S.page, () => window.__vtt.getState().scene.maps.length === 1, 8000);

// 3. Воин 5 с оружием, токен в активном бою.
const setup = await S.page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitState = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return;
      await sleep(50);
    }
    throw new Error('timeout setup');
  };
  const s0 = window.__vtt.getState();
  const socket = s0.socket;
  socket.emit('library:add', {
    name: 'Воин-Экономика',
    imageUrl: '',
    cells: 1,
    round: false,
    description: '',
    initiativeBonus: '',
    isPlayerToken: true,
  });
  await waitState(() => window.__vtt.getState().library.some((i) => i.name === 'Воин-Экономика'));
  const item = window.__vtt.getState().library.find((i) => i.name === 'Воин-Экономика');
  const set = await new Promise((res) => socket.emit('player:setCharacter', { libraryItemId: item.id }, res));
  const mapId = window.__vtt.getState().viewMapId ?? window.__vtt.getState().scene.maps[0].id;
  const before = window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens.length;
  socket.emit('token:add', { mapId, libraryItemId: item.id, x: 250, y: 250 });
  await waitState(() => window.__vtt.getState().scene.maps.find((m) => m.id === mapId).tokens.length > before);
  const token = window.__vtt
    .getState()
    .scene.maps.find((m) => m.id === mapId)
    .tokens.find((t) => t.libraryItemId === item.id);
  socket.emit('sheet:update', {
    name: 'Воин-Экономика',
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: '3',
    saves: {},
    skills: {},
    attacks: [
      { name: 'Меч', hit: 'd20+6', damage: '1d8+4', rangeType: 'melee', rangeNormal: 5, rangeLong: 0, damageType: 'slashing' },
    ],
    classes: [{ className: 'fighter', level: 5 }],
    spells: [],
  });
  await waitState(() => window.__vtt.getState().sheet?.classes?.[0]?.className === 'fighter');
  await waitState(() =>
    window.__vtt.getState().scene.maps.find((m) => m.id === mapId)?.tokens.some((t) => t.attacks.length > 0)
  );
  socket.emit('combat:add', { mapId, tokenId: token.id });
  socket.emit('combat:start', { mapId });
  await waitState(() => {
    const map = window.__vtt.getState().scene.maps.find((m) => m.id === mapId);
    return !!(map?.combat?.active && map.combat.entries.length === 1);
  });
  const entry = window.__vtt.getState().scene.maps.find((m) => m.id === mapId).combat.entries[0];
  return { mapId, tokenId: token.id, entryId: entry.id, ok: !!set && !('error' in set) };
});
check(setup.ok, 'воин создан, токен в активном бою');

// Состояние кнопки атаки (ищем по имени оружия — текст не зависит от языка).
const attackButton = () =>
  S.page.evaluate(() => {
    const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('Меч')
    );
    return b ? { disabled: b.disabled } : null;
  });
const waitAttackDisabled = (expected) =>
  waitFor(
    S.page,
    (exp) => {
      const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
        (x.getAttribute('aria-label') ?? '').includes('Меч')
      );
      return !!b && b.disabled === exp;
    },
    5000,
    expected
  );

// Локальные патчи стора: тестируем решение клиента (та же функция, что зовёт сервер).
const patchTurn = (mapId, entryId, patch) =>
  S.page.evaluate(
    ({ mapId, entryId, patch }) => {
      window.__vtt.setState((s) => ({
        scene: {
          ...s.scene,
          maps: s.scene.maps.map((m) =>
            m.id !== mapId
              ? m
              : {
                  ...m,
                  combat: {
                    ...m.combat,
                    turns: { ...m.combat.turns, [entryId]: { ...m.combat.turns[entryId], ...patch } },
                  },
                }
          ),
        },
      }));
    },
    { mapId, entryId, patch }
  );
const setSlow = (mapId, tokenId, on) =>
  S.page.evaluate(
    ({ mapId, tokenId, on }) => {
      const effect = {
        id: 'e2e-slow',
        name: 'Slow',
        sourceKey: 'XPHB:Slow',
        duration: { type: 'rounds', rounds: 10 },
        modifiers: [],
        restrictions: { oneAttackOnly: true },
      };
      window.__vtt.setState((s) => ({
        scene: {
          ...s.scene,
          maps: s.scene.maps.map((m) =>
            m.id !== mapId
              ? m
              : {
                  ...m,
                  tokens: m.tokens.map((t) =>
                    t.id !== tokenId
                      ? t
                      : {
                          ...t,
                          effects: on
                            ? [...t.effects.filter((e) => e.id !== 'e2e-slow'), effect]
                            : t.effects.filter((e) => e.id !== 'e2e-slow'),
                        }
                  ),
                }
          ),
        },
      }));
    },
    { mapId, tokenId, on }
  );

// 4. Своя фаза: бонусное действие свободно, атака доступна.
await waitAttackDisabled(false);
check((await attackButton())?.disabled === false, 'в свой ход атака доступна');

// 5. Первая атака потрачена, Extra Attack оставляет запас (Slow ещё нет) — кнопка активна.
await patchTurn(setup.mapId, setup.entryId, { actionUsed: true, attacksRemaining: 1 });
await waitAttackDisabled(false);
check((await attackButton())?.disabled === false, 'без Slow остаток мультиатаки оставляет кнопку активной');

// 6. Slow (`oneAttackOnly`): повторная атака гаснет — то, что раньше расходилось с сервером.
await setSlow(setup.mapId, setup.tokenId, true);
await waitAttackDisabled(true);
check((await attackButton())?.disabled === true, 'Slow гасит повторную атаку (oneAttackOnly)');

// 7. Сняли эффект — кнопка снова активна (проверка, что гейт именно в ограничении).
await setSlow(setup.mapId, setup.tokenId, false);
await waitAttackDisabled(false);
check((await attackButton())?.disabled === false, 'снятие Slow возвращает кнопку');
