import data from '../data/monsterAbilities.json';
import type { ActionDef } from '../domain/actions';
import { normalizeActions } from '../normalize/actions';

/** Глобальная библиотека способностей монстров (сиды; копируются в токен). */
export const MONSTER_ABILITIES: ActionDef[] = normalizeActions(data.abilities);
