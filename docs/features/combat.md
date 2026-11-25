# Combat, effects, damage and reactions

Назад: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Боевой ход, эффекты и состояния, урон, OA и реакции. Детали правил остаются в `shared/src/rules`, серверные переходы — в `server/src/socket`.

## Анимация броска игрока

`Player.rollAnimChance` (0–100), событие `player:rollAnimChance`, приватный `roll:anim` с d20 (`shared/src/socket/contract.ts`), сервер `socket/rollAnim.ts` (`maybeRollAnim` из `attackResolve.rollPreparedAttack`,
проверки `dice.ts`, utility check `automation.ts`, «Выпутаться» `actions.ts`, взлом `doors.ts`), клиент `store/slices/rollAnim.ts`, `components/RollOverlay.tsx` (не блокирует; `ThreeD20 variant='roll'`), ползунок в
`DiceMenu.tsx`

## Эффекты и состояния

`shared/src/rules/effects.ts` + `conditions.ts`; сервер `room/effects.ts` (`applyEffect`/`removeEffect`/`tickEffects`; `tokenConditionImmunities` — иммунитеты к состояниям из эффектов и статблока-бестиария;
`checkRollParts`/`combineRollMode` — модификаторы проверок), `socket/effects.ts` (`tickEffectTriggers`/`tickEndTurnEffectTriggers` — срабатывания эффектов в начале хода (Heroism, смайты) и в конце (отложенный урон
Vitriolic, одноразово)), `socket/effectsApply.ts`, `socket/tokenRemove.ts` (единое полное удаление токена: `token:remove` и изгнанные навсегда); фильтр `condition` у спасброска (Protection from Poison), `damageLink`
(Warding Bond — перенос урона в `socket/damage.ts`), `escape` («Выпутаться/Собраться»: проверка или спас, `kind/label/iconKey`), `saveSuccess` (эффекты при успешном сейве — Irresistible Dance), `seesInvisible` (See
Invisibility), `ward` (Primordial Ward: реакция на урон типа из списка — иммунитет с возвратом спровоцировавшего урона, `applyWardReaction`), `breakOn` (`removeBrokenEffects`: обрыв Invisibility броском атаки
`attackResolve` или кастом `spells.ts`) и `banish` (Banishment: `rounds:10`+концентрация, скрытие токена и возврат в исходную/ближайшую свободную клетку, экстрапланетные по истечении срока удаляются; `isBanished`
исключает из таргетинга/зон/занятости); клиент `EffectChips`/`ConditionChips`/`ConditionsOverlay`/`ConditionsForm`/`ConditionImmunitiesForm` (статблок), `lib/visibility.ts` (`useBanishView`)

## Урон, HP, смерти

`server/src/socket/damage.ts` (`applyDamage`/`hasHpTracking`; составной урон — `parts: {damageType?, amount}[]`, защиты по каждой части через `applyDamageToParts`, части без типа наследуют основной; магические физтипы
`magicalSlashing`/`magicalPiercing`/`magicalBludgeoning` — Magic Weapon ставит флаг `magicWeapon`, `attackResolve` подменяет тип), `room/effects.ts` (`adjustTokenHp` — temp HP списываются первыми, `grantTempHp`,
`wakeOnDamage`), `socket/context.ts` (`applyHp`); крит-диапазон — `rules/combat.ts` (`critRangeFor`) + `dice.ts` (`isCriticalHit(roll, minFace)`); составной урон заклинаний — типизированные кости в `dice` (`5d6fire +
5d6radiant`; части карточек — `spellDamageParts` по ролям `damage.parts` данных: все `main`, либо `main` + `trigger` другого типа); всплеск вокруг цели — `AutomationDef.burst` (Ice Knife: спас 5 фт вне зависимости от
попадания; в ветке сейва — вокруг каждой цели; `runBurst` в `socket/automation/execute.ts`, райдеры смайтов — `socket/smites.ts`); временные хиты — утилита `tempHp` (False Life, `rules/automation.ts`) и
`AutomationDef.undeadTempHp` (Negative Energy Flood: нежить без спасброска получает половину броска врем. хитами); убитый Negative Energy Flood поднимается враждебным `XMM:Zombie` (`spawnZombie` в
`socket/automation/core.ts`); UI — `TokenMenu.tsx`, `ResourcesPanel.tsx`

Смерть и стабилизация: `resources:deathSave` (`server/src/socket/resources.ts`), `hp.deathSuccesses`/`deathFailures`, `hp.stable`; 3 успеха — стабилен (броски не нужны до получения урона), 3 провала — смерть; урон по лежачему добавляет провал (крит — два), лечение выше 0 сбрасывает счётчики. UI — `ResourcesPanel`/`TokenMenu`.

## Бой, ход, движение, OA

`server/src/socket/combat.ts` (`combat:setMovement`, `tickActiveTurn`), `room/combat.ts`, `socket/conditions.ts`; базовые действия `rules/actions.ts` + `rules/automationActions.ts` (Помощь: `wake` — будит «сонные»
эффекты `wakeOnDamage` в 5 фт); поиск пути `rules/movement.ts` (`findPath`: 5-10-5, сложная местность ×2, зоны `movementCost` ×4 (Wall of Thorns), `steps` — стоимость шага из маршрута для списания движения, стены/двери),
клиент `store/slices/tokens.ts` (`startTokenWalk`), `TokenView.tsx` (призрак, маршрут, анимация 150 мс/клетка, `token:walk`), `InitiativeBar`, `ActionPanel`

## Реакции (Counterspell, Absorb, OA)

`shared/src/rules/reactions.ts`, `server/src/socket/reactions/*` (`queue.ts` — окна строго **по одному офферу, в порядке инициативы** (вне боя — порядок карты): `apply(choice)` применяется сразу при ответе и может
прервать цепочку, `done` — после последнего; окна образуют **стек**: реакция, порождённая броском (Guided Strike/Shield на промахе OA), отыгрывает до продолжения родительского окна, `stop` — предикат досрочного
завершения (двигатель повержен); окно рассылается **всем** с `active: true` только реактору и DM, таймаут оффера 30 с; `windows.ts` — общие окна `attackMiss`/`attackHit` для оружия и заклинательных атак (если
Shield/Режущие слова превратили попадание в промах, открывается дочернее окно `attackMiss` — Направленный удар и другие), OA и ответные атаки черт (Riposte/Retaliation) идут полным `resolveWeaponAttackWithReactions`,
подключено и в `automation.runWeaponAttacks`; `internal.ts` — `reactionOfferAllowed` (офферы реакций «по существу, которое видишь»: дистанция `withinFeet` + стены/тьма/сенсы + невидимость и `seesInvisible`); оффер
`kind:'effect'` — Primordial Ward (`ward`-эффект + `applyWardReaction`, возврат спровоцировавшего урона)), клиент `ReactionPrompt.tsx` (зрителям — «{name} реагирует…» без кнопок), `store/slices/reactions.ts`
(`reactionOffer: ReactionOffer \| null`); OA-источники (`opportunity.ts`): у персонажа с листом — только настоящее ближнее оружие (без «Без дистанции» и записей с нелепой досягаемостью >15 фт), мёртвый реактор не бьёт и
не получает оффер
