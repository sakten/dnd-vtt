# Content: races, monsters, equipment and localization

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Контент вне конкретного заклинания: виды, бестиарий, оружие, монстры и текстовые оверлеи.

## Виды (расы PHB 2024)

`shared/src/data/races.json` (10 видов XPHB + кобольд MPMM, `npm run races`), `domain/race.ts`, `rules/races.ts` (`raceChoiceDefs`/`racePassiveEffects`/`raceResourceDefs`/`raceActions`/`raceActionAutomation`/`raceSpellGrants`/`effectiveCharacterMaxHp`),
`CharacterSheet.race`, скрытые эффекты вида через `syncFeatureEffects` (`server/src/socket/features.ts`), активные кнопки вида в `ActionPanel`/`action:use`, ресурсы вида в `autoResourceDefs`, клиент
`components/RaceForm.tsx`, тексты `text.ru/races.json`; кобольд: Draconic Cry через `autoTargets.excludeConditions` (оглохшие), Колдовство — заговор `raceCast:*` в панели заклинаний; состояние «Полёт» — `rules/conditions.ts` + `PlanWalkInput.passThroughUnits` (`rules/movement.ts`, `TokenView.tsx`)

## Способности монстров (конструктор, легендарные)

схема `ActionDef.ability/legendaryCost/recharge/spellKey` + `MonsterAbilityDef` (`domain/actions.ts`), **таргетинг — `actionTargeting(action)` (канон `action.targeting`)**, статблок «Бонус атаки»/«СЛ»
(`domain/token.ts`), деривация `rules/monsterAbility.ts` (`monsterAbilityAutomation`/`monsterStats`/`legendaryOnly`/`minLegendaryCost`), библиотека `data/monsterAbilities.json` (`rules/monsterAbilities.ts`), исполнение
`server/src/socket/actions.ts` (`action:use`: атака/сейв/авто/заклинание, пул и правила слотов, перезарядка) + `socket/automation.ts` (ветки «атака+сейв-на-эффект», «сейв+эффекты», auto), легендарные слоты —
`room/combat.ts` (`distributeLegendarySlots`/`legendarySlotUsable`/`spendLegendary`), клиент `components/MonsterAbilityEditor.tsx`, `StatblockForm.tsx`, `ActionPanel.tsx`, `SpellPopover.tsx` (`abilityAction`), таргетинг
— `domain/interaction.ts` (`aim.actionId`)

## Лист персонажа и ресурсы

`socket/sheet.ts`/`resources.ts`, `shared/src/rules/resources.ts`, клиент `CharacterSheetModal.tsx`, `SpellsPanel.tsx`, `ResourcesPanel.tsx`; отдых — `resources:rest` (`socket/resources.ts`) + `applyRest` (`shared/src/rules/resources.ts`), сбрасывает HP/ресурсы/слоты по типу отдыха

## Оружие, выбор из списка

`shared/src/data/weapons.json` (`npm run weapons`: кость/тип/дистанция, свойства и мастерства; мастерства реализованы — `server/src/socket/masteries.ts`, Cleave/Graze/Nick/Push/Sap/Slow/Topple/Vex, хуки в `server/src/socket/attackResolve.ts`), `rules/weapons.ts` (`weaponAttackEntry` — автоподстановка формул, `findUnarmedAttack`), формулы атак
понимают характеристики (`rules/combat.ts` — `resolveAbilityMods`, `d20+str`), клиент `AttacksForm.tsx` (список + своя атака), переопределение безоружного удара — `socket/actions.ts` (`unarmedStrikeEntry`); оружие монаха
(2024) — `isMonkWeapon`: кость боевых искусств вместо кости оружия и max(Сила/Ловкость) на попадание/урон (в `weaponAttackEntry` и `loadoutOf`/`applyMonkWeapon`; ручные формулы — `manualHit`/`manualDamage` и старые
записи, не совпадающие с авторасчётом, не перетираются)

## Бестиарий (SRD 5.2)

Сборка `npm run bestiary` → `shared/src/data/bestiary.json` (345: 330 XMM `srd52` + 15 XPHB-шаблонов призывов), разбор `scripts/build-bestiary.ts` + чистый `shared/src/rules/bestiary.ts` (`bestiaryEntryFromRaw`:
атаки/сейвы/мультиатака/легендарные/каст/защиты от урона и иммунитеты к состояниям + `appearance`; пометки «from nonmagical attacks» → базовые физтипы, безусловные физзащиты — и магические; `bestiaryTokenFields` — поля
токена, иммунитеты идут в `statblock.conditionImmunities`), иконки — `rules/bestiaryIcon.ts` + `rules/creatureArt.ts` (силуэт из описания), ленивый экспорт `shared/bestiaryData`, контракт и hash — в
`data.deploy.test.ts`; картинки: `GET /api/bestiary/icon|token/<key>` (`server/src/bestiaryIcons.ts`) — файл из `data/bestiary/{icons,tokens}/<slug>.(png|webp|jpg|svg)` (иконка 128, токен 256), иначе сгенерированный SVG;
клиент — `components/BestiaryPanel.tsx` (поиск/фильтры/детали, «В библиотеку» — DM, дальше drag из `TokenPanel`), `lib/bestiary.ts` (ленивый чанк)

## Локализация (UI и контент)

UI: `client/src/i18n/*` — `index.ts` (реестр `LANGS`, `t`, `plural` через `Intl.PluralRules`, фолбэк locale→EN→ключ), `ru.ts`/`en.ts`, `names.ts` (имена контента), `useLocalizedText.ts` (ленивые чанки),
`domain.ts`/`rolls.ts`/`system.ts`; контент: `shared/src/rules/text.ts` — оверлеи `shared/src/data/text.<lang>/` (`names.json` грузится до рендера, `spells.json`/`feats.json`/`features/<класс>.json` — по требованию);
**канон имён фич:** с ресурсом — `CLASSES` (`shared/src/rules/classes.ts`), `names.json` зеркалит его (замок `featureRegistry.test.ts`); без ресурса — `names.json`; пояснения пулов в скобках остаются в метке ресурса (Наложение рук (запас));
**новый язык:** словарь `<lang>.ts` подхватывается i18n автоматически, но для контента нужна регистрация в `CONTENT_LANGS` (`shared/src/rules/text.ts`); одной папки `text.<lang>/` недостаточно; сводка механики — `client/src/lib/spellText.ts`
