# Classes, subclasses, feats and maneuvers

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Механики классов и подклассов. Данные — в `shared/src/data`, исполнение — в `featureAutomation`/`classActions`.

## Способности классов/подклассов

каталог `shared/src/data/features.json` (`npm run features`, 829 черт ≤20 ур., ключи как у ресурсов), `rules/features.ts` (уровни/поиск), ручные механики `rules/featureAutomation.ts` (`passive`/`active`/`choice`;
`featureChoiceOptions` — выбор варианта при использовании, Обольщающая магия через `action:use.variant`), кнопки `rules/classActions.ts` (в т.ч. `FeatureMechanics.spellKey` — каст заклинания без ячейки за ресурс),
наездники при попадании `rules/attackRiders.ts` + `server/src/socket/attackRiders.ts`, скрытые эффекты-пассивки `server/src/socket/features.ts`, `CharacterSheet.choices`; **боевой мастер** — `data/maneuvers.json` (`npm
run maneuvers`), `rules/maneuvers.ts` (лимит 3/5/7/9, RU-имена, кнопки), пикер `components/ManeuversForm.tsx`, автоматизированы Precision Attack (декларативный `rollBonus` с `selfOnly`), Parry/Riposte (реакции),
Distracting Strike (наездник попадания; `filter.otherThanSource`/`consumeOnIncomingAttack`), Bait and Switch/Знай врага — реестр спецдействий `server/src/socket/specialActions.ts` (обмен — `maneuvers*.ts`; Знай врага — ресурс с `fallbackResourceKey`, кость превосходства), кэнсэй — `server/src/socket/kensei.ts` (проверки, Sharpen the Blade, Agile Parry),
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

## Draconic Sorcery (XPHB)

- Данные: `shared/src/data/features.json`, круговые заклинания — `rules/subclassSpells.ts` (Chromatic Orb … Summon Dragon), механики — `rules/featureAutomation.ts`.
- Draconic Resilience: пассивный `ac`-модификатор `10+dex+cha`; HP — `draconicResilienceHpBonus` в `rules/draconic.ts`, учитывается `effectiveCharacterMaxHp`.
- Elemental Affinity: выбор стихии в «Талантах» (`FeatureChoice` kind `featureOption`, ключ `sorcerer.draconic:elementalAffinity`), сопротивление — пассивный эффект `passiveFeatures(classes, choices)`; +мод. Харизмы к одному броску урона заклинания — `spellResolve` (`elementalAffinityBonus`), раз за каст.
- Dragon Wings: активная черта (бонусное действие, ресурс 1/долгий отдых), эффект `flying` + скорость 60 на 600 раундов; возврат за 3 очка чародейства — вручную.
- Dragon Companion: действие кастует Summon Dragon без ячейки (`spellKey`), ресурс 1/долгий отдых; вариант без концентрации (1 минута) — вручную.
- Проверки: `shared/src/rules/features.test.ts`, `server/src/socket/draconic.test.ts`.

## Чародей — ядро (XPHB)

- Врождённое чародейство: ресурс `sorcerer:innateSorcery` (2/долгий отдых), кнопка на бонусное действие; эффект `class:sorcerer:innateSorcery` на 10 раундов — `spellDc +1` и преимущество на заклинательные атаки; ограничение «только заклинания чародея» — `server/src/socket/spellStats.ts` и `automation/execute.ts`.
- Очки чародейства — пул `sorcerer:sorceryPoints`; метамагия — выбор 2/4/6 опций в «Талантах» (`components/MetamagicForm.tsx`, `rules/metamagic.ts`), при касте — селектор в `SpellPopover` и оплата ОЧ (`socket/spells.ts`).
- Автоматизированы: Subtle, Distant, Quickened, Transmuted, Seeking (переброс промаха за 1 ОЧ), Heightened (помеха спасброскам первой цели), Careful (защита союзников), Extended (длительность ×2 и преимущество на концентрацию) и Twinned 2024 (эффективный уровень +1 и доп. цель). Empowered — вручную (`system.metamagic.manual`).
- Проверки: `server/src/socket/innateSorcery.test.ts`, `server/src/socket/metamagic.test.ts`.
