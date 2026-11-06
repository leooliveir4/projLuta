import type { ClipId } from './soundCatalog.ts';

import knockout from '../../assets/sounds/fatality.mp3';
import lyraAstralOrb from '../../assets/sounds/combat/lyra-astral-orb.mp3';
import lyraSupernova from '../../assets/sounds/combat/lyra-supernova.mp3';
import vexraPiercingBurst from '../../assets/sounds/combat/vexra-piercing-burst.mp3';
import vexraExplosiveGrenade from '../../assets/sounds/combat/vexra-explosive-grenade.mp3';
import vexraAutoTurretShot from '../../assets/sounds/combat/vexra-auto-turret-shot.mp3';
import dravenorDevastatingBlow from '../../assets/sounds/combat/dravenor-devastating-blow.mp3';
import dravenorEarthRupture from '../../assets/sounds/combat/dravenor-earth-rupture.mp3';
import kaelArcaneBlade from '../../assets/sounds/combat/kael-arcane-blade.mp3';
import kaelDimensionalCut from '../../assets/sounds/combat/kael-dimensional-cut.mp3';
import nyxaraShadowBlade from '../../assets/sounds/combat/nyxara-shadow-blade.mp3';
import nyxaraEclipse from '../../assets/sounds/combat/nyxara-eclipse.mp3';
import vaelithShadowBlade from '../../assets/sounds/combat/vaelith-shadow-blade.mp3';
import vorathAbyssImpact from '../../assets/sounds/combat/vorath-abyss-impact.mp3';
import vorathVoidRupture from '../../assets/sounds/combat/vorath-void-rupture.mp3';
import generalCombatImpact from '../../assets/sounds/combat/general-combat-impact.mp3';

/**
 * Endereço de cada arquivo de som, resolvido pelo Vite no build (funciona no GitHub Pages).
 * Os originais, sem conversão, ficam em `assets-source/audio`.
 */
export const CLIP_URLS: Record<ClipId, string> = {
  'lyra-astral-orb': lyraAstralOrb,
  'lyra-supernova': lyraSupernova,
  'vexra-piercing-burst': vexraPiercingBurst,
  'vexra-explosive-grenade': vexraExplosiveGrenade,
  'vexra-auto-turret-shot': vexraAutoTurretShot,
  'dravenor-devastating-blow': dravenorDevastatingBlow,
  'dravenor-earth-rupture': dravenorEarthRupture,
  'kael-arcane-blade': kaelArcaneBlade,
  'kael-dimensional-cut': kaelDimensionalCut,
  'nyxara-shadow-blade': nyxaraShadowBlade,
  'nyxara-eclipse': nyxaraEclipse,
  'vaelith-shadow-blade': vaelithShadowBlade,
  'vorath-abyss-impact': vorathAbyssImpact,
  'vorath-void-rupture': vorathVoidRupture,
  'general-combat-impact': generalCombatImpact,
  knockout,
};
