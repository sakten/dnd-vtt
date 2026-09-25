export { AUTOMATION_ACTIONS } from './header';
export { AUTOMATION_SPELLS, AUTOMATION_ADDITIONS } from './catalog';
export type { AutomationAddition } from './catalog';
export type { AutomationOptions, SpellVariantDef } from './variants';
export { SPELL_VARIANTS, spellVariantDef } from './variants';
export { shadowBladeReturnAction, spellBuiltinAutomated } from './builders';
export { automationForSpell, automationForAction, spellEffectDefs, spellTempHp, spellDamageParts, spellAutomated, spellWeaponOverride } from './derive';
export type { ActionAutomationOptions } from './derive';
