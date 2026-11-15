// CONTRATO DE DATOS del rancho.
// Lo cumplen data/mock-save.json (datos de prueba) y lo que se construye desde una run de souldew (data/souldew.ts).
import { z } from "zod";
import { NATURES } from "./stats.ts";

const byte = z.number().int().min(0).max(255);

const statBlock = (each: z.ZodNumber) =>
  z.object({ hp: each, atk: each, def: each, spa: each, spd: each, spe: each });

export const MoveSchema = z
  .object({
    name: z.string().min(1),
    pp: z.number().int().min(0),
    ppMax: z.number().int().min(1).max(64),
  })
  .refine((m) => m.pp <= m.ppMax, { message: "pp no puede superar ppMax" });

export const PokemonSchema = z.object({
  species: z.number().int().min(1).max(649), // número de la Pokédex nacional (hasta la 5ª gen)
  nickname: z.string().min(1).max(10),
  level: z.number().int().min(1).max(100),
  nature: z.enum(NATURES),
  shiny: z.boolean(),
  gender: z.enum(["male", "female", "genderless"]),
  ability: z.string().min(1),
  item: z.string().min(1).nullable(), // null = sin objeto
  stats: statBlock(z.number().int().min(1).max(999)),
  ivs: statBlock(z.number().int().min(0).max(31)),
  evs: statBlock(byte).refine(
    (e) => Object.values(e).reduce((a, b) => a + b, 0) <= 510,
    { message: "los EVs no pueden sumar más de 510" },
  ),
  moves: z.array(MoveSchema).max(4), // vacío si no se conocen (datos estimados)
  friendship: byte,
  status: z.enum(["none", "sleep", "poison", "badPoison", "burn", "freeze", "paralysis"]),
  /**
   * true = viene de souldew, que no da naturaleza, IVs, EVs, habilidad, sexo, amistad ni movimientos: esos campos llevan
   * valores neutros solo para poder calcular, y la interfaz NO los muestra (la ficha avisa de que son estimados).
   */
  estimated: z.boolean().optional(),
});

export const BoxSchema = z.object({
  name: z.string().min(1).max(8),
  pokemon: z.array(PokemonSchema).max(30),
});

export const SaveSchema = z.object({
  schemaVersion: z.literal(1),
  trainer: z.object({
    name: z.string().min(1).max(7),
    id: z.number().int().min(0).max(65535),
  }),
  party: z.array(PokemonSchema).max(6),
  boxes: z.array(BoxSchema).max(14),
});

// Los tipos de TypeScript se deducen del esquema: una sola fuente de verdad.
export type Move = z.infer<typeof MoveSchema>;
export type Pokemon = z.infer<typeof PokemonSchema>;
export type Box = z.infer<typeof BoxSchema>;
export type Save = z.infer<typeof SaveSchema>;
