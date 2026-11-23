# AutomationSpec: открытые вопросы

Назад: [AUTOMATION.md](../../../AUTOMATION.md).

Открыто (следующие шаги):
- имена стратегий `loadout`/`movement` (проверить на миграции первых 10 спеков);
- нужен ли `choices.default` для копий, меняющих набор вариантов.

Решено (срез 5b — вызовы существ):
- профиль скейла существа хранится **в записи заклинания**: `SummonSpec.profile` → `SummonDef.profile` (`BestiarySummonProfile`: `baseLevel`/`hpPerLevel`/`acPerLevel`/`spellAttack`/`spellDc`/`multiattackHalfLevel`); `npm
run catalog` переносит профиль из бестиария в запись (deploy-инвариант «профиль перенесён»), спавн (`bestiaryTokenFields`) берёт `opts.profile ?? entry.summon`; кастом/копия может патчить `summon.profile.*` по
именованному пути (`CUSTOM:` с `summon.profile.hpPerLevel` — тест). Существо остаётся ключом бестиария/библиотеки — инлайн-статблоки не планируются.
- `PACT_OF_CHAIN_FORMS` удалён из кода: флаг `pactOfChain` пишется парсером бестиария (`rules/bestiary.ts`, курируемый список XPHB-2024) в `data/bestiary.json`; рантайм и клиент читают данные (`entry.pactOfChain`,
`familiarFormAvailable(entry, pactChain)`), deploy-тест фиксирует набор из 7 форм.
