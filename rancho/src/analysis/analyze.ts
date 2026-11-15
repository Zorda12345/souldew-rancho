// Análisis del equipo: solo cálculos, sin nada de pantalla (así se puede probar con tests).
import { attackTypes } from "../data/moves.ts";
import type { Box, Pokemon } from "../data/schema.ts";
import { SPECIES } from "../data/species.ts";
import { TYPES, TYPE_IDS, effectiveness, effectivenessAgainst, type TypeId } from "../data/types.ts";

export interface DefenseRow {
  type: TypeId; // tipo del ataque recibido
  multipliers: number[]; // daño que recibe cada miembro del equipo: 4, 2, 1, 0.5, 0.25 o 0
  weak: number; // cuántos reciben más daño del normal
  resist: number; // cuántos reciben menos (o ninguno)
  problem: boolean; // punto débil del equipo
}

export interface Suggestion {
  pokemon: Pokemon;
  box: string;
  reasons: string[];
}

export interface TeamAnalysis {
  defense: DefenseRow[];
  uncovered: { type: TypeId; best: number }[]; // tipos a los que ningún ataque del equipo pega con ventaja
  suggestions: Suggestion[];
}

const typesOf = (p: Pokemon): TypeId[] => SPECIES[p.species]?.types ?? [];
const attacksOf = (p: Pokemon): TypeId[] => attackTypes(p.moves.map((m) => m.name));

function list(types: TypeId[]): string {
  const names = types.map((t) => TYPES[t].name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0];
}

export function analyzeTeam(party: Pokemon[], boxes: Box[]): TeamAnalysis {
  const defense = TYPE_IDS.map((type): DefenseRow => {
    const multipliers = party.map((p) => effectivenessAgainst(type, typesOf(p)));
    const weak = multipliers.filter((m) => m > 1).length;
    const resist = multipliers.filter((m) => m < 1).length;
    // Punto débil: le duele a dos o más y son más los que sufren que los que aguantan.
    return { type, multipliers, weak, resist, problem: weak >= 2 && weak > resist };
  });

  const teamAttacks = [...new Set(party.flatMap(attacksOf))];
  const uncovered = TYPE_IDS.map((type) => ({
    type,
    best: Math.max(0, ...teamAttacks.map((attack) => effectiveness(attack, type))),
  })).filter((entry) => entry.best <= 1);

  const problems = defense.filter((row) => row.problem).map((row) => row.type);
  const suggestions = boxes
    .flatMap((box) => box.pokemon.map((pokemon) => ({ pokemon, box: box.name })))
    .map(({ pokemon, box }) => {
      const own = typesOf(pokemon);
      const covers = problems.filter((t) => effectivenessAgainst(t, own) < 1);
      const hurts = problems.filter((t) => effectivenessAgainst(t, own) > 1);
      const attacks = attacksOf(pokemon);
      const hits = uncovered.map((u) => u.type).filter((t) => attacks.some((a) => effectiveness(a, t) > 1));

      const reasons: string[] = [];
      if (covers.length) reasons.push(`Aguanta bien los ataques de tipo ${list(covers)}, que le duelen a tu equipo.`);
      if (hits.length) reasons.push(`Sus ataques pegan con ventaja al tipo ${list(hits)}, que ahora no cubres.`);
      if (hurts.length) reasons.push(`Ojo: también es débil a ${list(hurts)}.`);
      return { pokemon, box, reasons, gain: covers.length + hits.length, score: covers.length + hits.length - hurts.length };
    })
    .filter((s) => s.gain > 0 && s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ pokemon, box, reasons }) => ({ pokemon, box, reasons }));

  return { defense, uncovered, suggestions };
}
