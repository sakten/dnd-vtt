import { S } from './state.mjs';
import { check, sleep } from '../lib/check.mjs';
import { waitFor, waitMsg } from '../lib/smoke-helpers.mjs';

let playerFog = null;
S.player.on('fog:update', (p) => {
  playerFog = p;
});
const fogState = { size: 50, offsetX: 0, offsetY: 0, hidden: ['2,3', '3,3'] };
S.dm.emit('fog:update', { mapId: S.map1.id, fog: fogState });
await waitFor(() => playerFog && playerFog.fog.hidden.length === 2);
check(playerFog.mapId === S.map1.id, 'туман войны обновляется у игроков');
S.player.emit('fog:update', { mapId: S.map1.id, fog: { ...fogState, hidden: [] } });
await sleep(600);
check(playerFog.fog.hidden.length === 2, 'игрок не может менять туман');

S.player.emit('dice:roll', { expression: 'd20+3' });
const rollMsg = await waitMsg(S.dm, (m) => m.kind === 'roll' && !m.label);
check(rollMsg.roll.total >= 4 && rollMsg.roll.total <= 23, `dice d20+3 total=${rollMsg.roll.total}`);
check(rollMsg.roll.expression === 'd20+3', 'roll expression');

S.player.emit('dice:roll', { expression: 'd20+3+d4', label: 'Атака: Меч' });
const labeledMsg = await waitMsg(S.dm, (m) => m.kind === 'roll' && m.label === 'Атака: Меч');
check(labeledMsg.roll.expression === 'd20+3+d4', 'бросок с кубом-бонусом и меткой');

const svgForm = new FormData();
svgForm.append(
  'image',
  new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'], { type: 'image/svg+xml' }),
  'evil.svg'
);
const svgRes = await fetch(`${S.URL}/api/upload`, {
  method: 'POST',
  headers: { 'X-Room': S.created.room.code, 'X-Player': 'smoke-p1' },
  body: svgForm,
});
check(svgRes.status === 400, 'SVG-загрузки запрещены (400)');

S.player.emit('sheet:update', {
  name: 'Боец',
  abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: '2',
  saves: {},
  skills: {},
  attacks: [
    { name: 'Топор', hit: 'd20+5', damage: '2d6+3' },
    { name: 'Яд', hit: '', damage: '1d4', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
    { name: '', hit: '', damage: '' },
  ],
  classes: [],
});
await sleep(200);
const attackHitP = waitMsg(S.dm, (m) => m.kind === 'roll' && m.label === 'Атака: Топор');
const attackDmgP = waitMsg(S.dm, (m) => m.kind === 'roll' && m.label === 'Урон: Топор');
S.player.emit('dice:attack', { attackIndex: 0 });
const attackHit = await attackHitP;
const attackDmg = await attackDmgP;
check(attackHit.roll.dice[0].sides === 20, 'dice:attack кидает попадание');
check(
  attackDmg.roll.total >= 5 && attackDmg.roll.total <= 30,
  `dice:attack кидает урон (${attackDmg.roll.total})`
);
