import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { eventOnce, waitMsg } from '../lib/smoke-helpers.mjs';

// Игрок ставит шанс анимации 100% — его d20-проверка сразу сопровождается roll:anim.
const playersP = eventOnce(S.player, 'players:update');
S.player.emit('player:rollAnimChance', { value: 100 });
const players = await playersP;
const playerName = players.find((p) => p.id === 'smoke-p1')?.name;
check(
  players.find((p) => p.id === 'smoke-p1')?.rollAnimChance === 100,
  'игрок выставил шанс анимации 100%'
);

const animP = eventOnce(S.player, 'roll:anim');
const msgP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'check', 4000);
S.player.emit('dice:roll', { expression: 'd20+5', rollKind: 'check', subject: 'Атлетика' });
const anim = await animP;
const message = await msgP;
check(anim.roll.total === message.roll.total, `анимация пришла сразу со значением броска (${anim.roll.total})`);
check(message.author === playerName, 'сообщение проверки в чате');

// Шанс 0 — анимации нет, бросок обычный.
const playersOffP = eventOnce(S.player, 'players:update');
S.player.emit('player:rollAnimChance', { value: 0 });
await playersOffP;
const got = [];
const onAnim = (p) => got.push(p);
S.player.on('roll:anim', onAnim);
const immediateP = waitMsg(S.player, (m) => m.kind === 'roll' && m.rollKind === 'check', 4000);
S.player.emit('dice:roll', { expression: 'd20', rollKind: 'check', subject: 'Скрытность' });
await immediateP;
await sleep(250);
S.player.off('roll:anim', onAnim);
check(got.length === 0, 'при шансе 0 анимации нет');
