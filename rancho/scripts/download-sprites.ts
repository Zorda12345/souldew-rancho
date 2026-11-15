// Descarga de PMD Collab (SpriteCollab) SOLO los sprites de las especies del mock:
// andar, quieto y dormir + AnimData.xml, a web/rancho/sprites/<número>/ (los shiny, a <número>/shiny/).
// También escribe web/rancho/sprites/manifest.json (qué hay disponible) y CREDITS.md.
// Uso: npm run sprites
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SaveSchema } from "../src/data/schema.ts";
import { SPECIES } from "../src/data/species.ts";

const REPO = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master";
const FILES = ["Walk-Anim.png", "Idle-Anim.png", "Sleep-Anim.png", "AnimData.xml"];
const root = new URL("../", import.meta.url);

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const save = SaveSchema.parse(JSON.parse(readFileSync(new URL("data/mock-save.json", root), "utf8")));
const everyone = [...save.party, ...save.boxes.flatMap((b) => b.pokemon)];
// Clave = carpeta local: "6" (normal) o "130/shiny".
const wanted = [...new Set(everyone.map((p) => (p.shiny ? `${p.species}/shiny` : `${p.species}`)))];

// Tabla id de autor -> nombre y contacto.
const authors = new Map<string, { name: string; contact: string }>();
try {
  for (const line of (await get(`${REPO}/credit_names.txt`)).toString("utf8").split("\n").slice(1)) {
    const [name, id, contact] = line.trim().split("\t");
    if (id) authors.set(id, { name: name || id, contact: contact ?? "" });
  }
} catch (e) {
  console.warn("No se pudo leer credit_names.txt:", (e as Error).message);
}

const ok: string[] = [];
const failed: string[] = [];
const credits: string[] = [];

for (const key of wanted) {
  const [num, variant] = key.split("/");
  const dex = num.padStart(4, "0");
  // En el repositorio: sprite/<dex>/ es la forma normal; /0000/0001/ es forma base + shiny.
  const remote = `${REPO}/sprite/${dex}${variant === "shiny" ? "/0000/0001" : ""}`;
  const dir = new URL(`../web/rancho/sprites/${key}/`, root);
  try {
    const blobs = await Promise.all(FILES.map((f) => get(`${remote}/${f}`)));
    mkdirSync(dir, { recursive: true });
    FILES.forEach((f, i) => writeFileSync(new URL(f, dir), blobs[i]));
    // Animaciones de combate (opcionales). Si una reutiliza la hoja de otra (CopyOf), se descarga esa.
    const xml = blobs[FILES.indexOf("AnimData.xml")].toString("utf8");
    for (const name of ["Attack", "Hurt"]) {
      const block = xml.match(new RegExp(`<Name>${name}</Name>[\\s\\S]*?</Anim>`))?.[0] ?? "";
      const file = `${block.match(/<CopyOf>(\w+)<\/CopyOf>/)?.[1] ?? name}-Anim.png`;
      try {
        writeFileSync(new URL(file, dir), await get(`${remote}/${file}`));
      } catch {
        console.warn(`      ${key}: sin animación ${name}`);
      }
    }
    ok.push(key);
    console.log(`OK    ${key}`);
  } catch (e) {
    failed.push(key);
    console.warn(`FALLO ${key}: ${(e as Error).message}`);
    continue;
  }
  // Créditos: una línea por aportación -> fecha, id de autor, estado, licencia, animaciones.
  const names = new Set<string>();
  try {
    for (const line of (await get(`${remote}/credits.txt`)).toString("utf8").split("\n")) {
      const id = line.split("\t")[1];
      if (!id) continue;
      const a = authors.get(id);
      const link = a?.contact.startsWith("http") ? `[${a.name}](${a.contact})` : (a?.name ?? id);
      names.add(link);
    }
  } catch {
    names.add("(créditos no disponibles: consultar el repositorio)");
  }
  const label = `${SPECIES[Number(num)]?.name ?? "?"} (#${num}${variant ? ", shiny" : ""})`;
  credits.push(`- **${label}**: ${[...names].join(", ")}`);
}

writeFileSync(new URL("../web/rancho/sprites/manifest.json", root), JSON.stringify({ ok, failed }, null, 2) + "\n");

writeFileSync(
  new URL("CREDITS.md", root),
  `# Créditos

## Sprites
Los sprites de estilo Mundo Misterioso proceden del proyecto comunitario
[PMD Collab — SpriteCollab](https://github.com/PMDCollab/SpriteCollab) ([sprites.pmdcollab.org](https://sprites.pmdcollab.org/)),
publicados bajo licencia [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/):
uso no comercial y con reconocimiento a los autores. Este proyecto es personal y privado.

Autores por especie (según el \`credits.txt\` de cada sprite; CHUNSOFT = sprites originales de los juegos):

${credits.join("\n")}

## Pokémon
Pokémon y sus personajes son © Nintendo / Creatures Inc. / GAME FREAK inc. Pokémon Mundo Misterioso es © Spike Chunsoft.
Proyecto de fan sin ánimo de lucro ni afiliación oficial.

_Archivo generado por \`npm run sprites\`._
`,
);

console.log(`\n${ok.length} descargados, ${failed.length} fallidos${failed.length ? `: ${failed.join(", ")}` : ""}`);
