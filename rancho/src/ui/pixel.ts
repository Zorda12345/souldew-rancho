// Iconos pixelados de 8×8 dibujados como SVG: cada "#" es un píxel.
import { TYPES, type TypeId } from "../data/types.ts";

const TYPE_ICON: Record<TypeId, string> = {
  normal: "..####../.#....#./#......#/#......#/#......#/#......#/.#....#./..####..",
  fire: "...#..../..##..../..###.#./.####.#./.######./##.####./##..###./.#####..",
  water: "...#..../...##.../..###.../..####../.######./.######./.######./..####..",
  grass: "......##/...#####/..#####./.######./.#####../.####.../#.#...../#.......",
  electric: "....###./...###../..###.../.######./...###../..###.../..##..../.#......",
  ice: "...#..../.#.#.#../..###.../#######./..###.../.#.#.#../...#..../........",
  fighting: "......../.#.#.#../.######./.######./#######./#######./.#####../..####..",
  poison: "..####../.######./.#.##.#./.######./..####../..#..#../......../...##...",
  ground: "......../...#..../..###.../.#####../#######./......../########/........",
  flying: ".....##./...####./.######./#######./..####../...###../....#.../........",
  psychic: "..####../.#....#./#..##..#/#.#..#.#/#.#.##.#/#..#...#/.#....#./..####..",
  bug: ".#....#./..#..#../..####../.######./#.####.#/.######./#.####.#/..#..#..",
  rock: "......../..####../.######./.#######/########/########/.######./........",
  ghost: "..####../.######./##.##.##/##.##.##/########/########/########/#.#.#.#.",
  dragon: "#..#..#./#..#..#./##.##.##/.#..#..#/.#..#..#/.##.##.#/..#..#../........",
  dark: "..####../.###..../###...../###...../###...../###....#/.###..#./..####..",
  steel: "..####../.######./###..###/##....##/##....##/###..###/.######./..####..",
};

export const BAG_ICON = "..####../...##.../..####../.######./########/########/########/.######.";

export function pixelSvg(bitmap: string, color: string, size: number): string {
  const rects = bitmap
    .split("/")
    .flatMap((row, y) => [...row].map((ch, x) => (ch === "#" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "")))
    .join("");
  return `<svg class="px" width="${size}" height="${size}" viewBox="0 0 8 8" fill="${color}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/** Cuadradito del color del tipo con su icono (para los movimientos). */
export function typeIcon(type: TypeId): string {
  const t = TYPES[type];
  return `<span class="type-icon" style="background:${t.color}" title="Tipo ${t.name}">${pixelSvg(TYPE_ICON[type], t.ink, 12)}</span>`;
}

/** Pastilla con icono y nombre del tipo (para la cabecera de la ficha). */
export function typeChip(type: TypeId): string {
  const t = TYPES[type];
  return `<span class="type" style="background:${t.color};color:${t.ink}">${pixelSvg(TYPE_ICON[type], t.ink, 12)}${t.name}</span>`;
}
