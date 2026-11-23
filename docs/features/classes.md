# Classes, subclasses, feats and maneuvers

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Механики классов и подклассов. Данные — в `shared/src/data`, исполнение — в `featureAutomation`/`classActions`.

## Способности классов/подклассов

каталог `shared/src/data/features.json` (`npm run features`, 829 черт ≤20 ур., ключи как у ресурсов), `rules/features.ts` (уровни/поиск), ручные механики `rules/featureAutomation.ts` (`passive`/`active`/`choice`;
`featureChoiceOptions` — выбор варианта при использовании, Обольщающая магия через `action:use.variant`), кнопки `rules/classActions.ts` (в т.ч. `FeatureMechanics.spellKey` — каст заклинания без ячейки за ресурс),
наездники при попадании `rules/attackRiders.ts` + `server/src/socket/attackRiders.ts`, скрытые эффекты-пассивки `server/src/socket/features.ts`, `CharacterSheet.choices`; **боевой мастер** — `data/maneuvers.json` (`npm
run maneuvers`), `rules/maneuvers.ts` (лимит 3/5/7/9, RU-имена, кнопки), пикер `components/ManeuversForm.tsx`, автоматизированы Precision Attack (декларативный `rollBonus` с `selfOnly`), Parry/Riposte (реакции),
Distracting Strike (наездник попадания; `filter.otherThanSource`/`consumeOnIncomingAttack`), Bait and Switch/Знай врага — реестр спецманёвров `server/src/socket/maneuvers*.ts` (Знай врага — ресурс с `fallbackResourceKey`, кость превосходства),
остальные — ручные кнопки с броском кости; фиты PHB'24 — `data/feats.json` (`npm
run feats`), `rules/feats.ts` (`featChoiceEffects`), выборы заклинаний черт — `rules/spellChoices.ts` (Магические находки), клиент `components/FeatsForm.tsx`

## Воззвания варлока (XPHB)

Каталог `npm run invocations` → `shared/src/data/invocations.json` (28 XPHB: уровень, предпосылки `pact`/`requires`/`cantrip`, лимиты 1–20), домен `domain/invocation.ts`, правила `rules/invocations.ts`
(`invocationIssue`/`invocationLimit`/`invocationAtWillSpells`/`invocationSenses`/`invocationPatches`/`effectiveSpellRangeFeet`), `CharacterSheet.invocations` (`normalize/sheet.ts`); клиент — секция «Воззвания» на вкладке
«Таланты» (`components/InvocationsForm.tsx`); механики: at-will каст без ячейки (`socket/spells.ts` + `CasterInfo.atWillKeys`), Devil's Sight в сенсах (`room/actor.ts`), Eldritch Mind — преимущество на концентрацию
(`room/effects.ts`), Pact of the Chain — гейт особых форм/атак фамильяра (`socket/summons.ts`), Agonizing/Repelling/Eldritch Spear — патчи инвокаций по именованным путям (`INVOCATION_MECHANICS[].patches` →
`automationForSpell({ invocations })`/`effectiveSpellRangeFeet`); остальные 54 инвокации (XGE/TCE/PHB) и RU-локализация — TODO

## Circle of the Symbiote (CBT)

- Данные: `shared/src/data/cbt/features.json`, `shared/src/data/cbt/spells.json`, RU-тексты в `shared/src/data/text.ru`.
- Класс/ресурсы: `shared/src/rules/classes.ts` (`druid.symbiote`), круговые заклинания — `rules/subclassSpells.ts`.
- Активные механики: `rules/featureAutomation.ts`; `FeatureMechanics.spellKey` кастует заклинание через общий `action:use` без ячейки.
- Symbiotic Reflexes: `spellKey: 'XPHB:Haste'` + ресурс PB/long rest + требование активной Symbiotic Transformation; отдельной копии Haste нет.
- Cat's Spring: `CBT:Cat's Spring`; прыжок/OA/телепорт — `server/src/socket/catSpring*.ts`; UI — scatter `catSpring` в `client/src/domain/interaction.ts`.
