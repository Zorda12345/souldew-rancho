import { Application } from "pixi.js";
import mock from "../../data/mock-save.json";
import { SaveSchema } from "../data/schema.ts";
import { createCard } from "../card/card.ts";
import { createRanch } from "./ranch.ts";
import { SCENES, isSceneId, type SceneId } from "./scenery.ts";
import { loadSprites, spriteKey } from "./sprites.ts";
import { createAnalyzer } from "../ui/analyzer.ts";
import { createBattleUI } from "../ui/battle.ts";
import { createBoxBar } from "../ui/boxbar.ts";
import { createTeam } from "../ui/team.ts";
import "../style.css";

export type RanchApp = { show(): void; hide(): void };

/**
 * Arranca el rancho dentro de `root` (el contenedor con la barra, el equipo, la ficha...).
 * Se llama una sola vez: al salir del rancho se oculta y se pausa, en vez de destruirlo.
 */
export async function startRanch(root: HTMLElement): Promise<RanchApp> {
  // Los datos pasan siempre por el contrato antes de usarse.
  const save = SaveSchema.parse(mock);

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x5fa84a,
    antialias: false,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });
  document.getElementById("app")!.appendChild(app.canvas);

  const cardEl = document.getElementById("card")!;
  const barEl = document.getElementById("boxbar")!;
  const teamEl = document.getElementById("team")!;
  const teamWrap = document.getElementById("team-wrap")!;

  // Los sprites se cargan una vez y los comparten el rancho, la franja del equipo y la ficha.
  const everyone = [...save.party, ...save.boxes.flatMap((box) => box.pokemon)];
  const sprites = await loadSprites(everyone.map(spriteKey));

  // El rancho se encaja en el hueco que dejan la barra (arriba), el equipo (izquierda, si no está oculto)
  // y la ficha (derecha, solo en pantallas anchas).
  let cardOpen = false;
  let teamHidden = false;
  try {
    teamHidden = localStorage.getItem("rancho.equipo") === "oculto";
  } catch {
    // Sin almacenamiento: el equipo empieza visible.
  }
  const fit = () => {
    const right = cardOpen && window.innerWidth >= 700 ? cardEl.offsetWidth : 0;
    const left = teamHidden ? 0 : teamWrap.offsetWidth + 20;
    document.body.style.setProperty("--card-space", `${right}px`);
    document.body.style.setProperty("--team-space", `${left}px`);
    ranch.setInsets(barEl.offsetHeight + 20, right, left);
  };
  window.addEventListener("resize", fit);

  const card = createCard(cardEl, () => {
    ranch.clearSelection();
    team.clearSelection();
    cardOpen = false;
    fit();
  });
  const openCard = (...args: Parameters<typeof card.show>) => {
    card.show(...args);
    cardOpen = true;
    fit();
  };

  // Reyes de cada caja: se guarda la posición del Pokémon dentro de su caja.
  const KINGS_KEY = "rancho.reyes";
  let kings: Record<string, number> = {};
  try {
    kings = JSON.parse(localStorage.getItem(KINGS_KEY) ?? "{}");
  } catch {
    // Sin almacenamiento o dato estropeado: nadie es rey todavía.
  }

  // Escenario de cada caja (prado por defecto), recordado entre visitas.
  const SCENES_KEY = "rancho.escenarios";
  let scenes: SceneId[] = save.boxes.map(() => "prado");
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SCENES_KEY) ?? "[]");
    if (Array.isArray(stored)) scenes = scenes.map((s, i) => (isSceneId(stored[i]) ? stored[i] : s));
  } catch {
    // Sin almacenamiento o dato estropeado: todas en el prado.
  }

  const ranch = createRanch(app, save.boxes, sprites, scenes, {
    onSelect: (critter) => {
      if (battle.pick(critter.pokemon)) {
        ranch.clearSelection(); // el clic era para elegir combatiente, no para abrir la ficha
        return;
      }
      team.clearSelection();
      openCard(critter.pokemon, critter.set);
    },
    onBattleLog: (text) => battle.log(text),
    onBattleEnd: (winner, boxIndex, kind) => {
      if (!winner) {
        battle.finish("Pelea detenida.");
      } else if (kind === "duel") {
        battle.finish(`¡${winner.nickname} gana el duelo!`);
      } else {
        kings[boxIndex] = save.boxes[boxIndex].pokemon.indexOf(winner);
        try {
          localStorage.setItem(KINGS_KEY, JSON.stringify(kings));
        } catch {
          // Sin almacenamiento: la corona dura hasta recargar.
        }
        ranch.setKing(boxIndex, winner);
        bar.setKing(boxIndex, winner.nickname);
        battle.finish(`¡${winner.nickname} es el nuevo rey de ${save.boxes[boxIndex].name}!`);
      }
    },
  });

  const battle = createBattleUI(document.getElementById("battle")!, {
    king: () => ranch.startKing(),
    duel: (a, b) => ranch.startDuel(a, b),
    stop: () => ranch.stopBattle(),
  });

  const team = createTeam(teamEl, save.party, sprites, (pokemon, set) => {
    if (battle.pick(pokemon)) {
      team.clearSelection();
      return;
    }
    ranch.clearSelection();
    openCard(pokemon, set);
  });

  const bar = createBoxBar(
    barEl,
    save.boxes.map((box, i) => ({
      name: box.name,
      label: `Caja ${i + 1} de ${save.boxes.length}`,
      count: box.pokemon.length,
      capacity: 30,
    })),
    (index, direction) => {
      card.close();
      ranch.show(index, direction);
    },
    {
      options: SCENES,
      current: (index) => scenes[index],
      change: (index, id) => {
        if (!isSceneId(id) || scenes[index] === id) return;
        scenes[index] = id;
        ranch.setScene(index, id);
        try {
          localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
        } catch {
          // Sin almacenamiento: dura hasta recargar.
        }
      },
    },
  );
  fit();

  // Coronas guardadas de otras visitas.
  save.boxes.forEach((box, i) => {
    const king = box.pokemon[kings[i]];
    if (king) {
      ranch.setKing(i, king);
      bar.setKing(i, king.nickname);
    }
  });

  createAnalyzer(document.getElementById("analyze")!, document.getElementById("analysis") as HTMLDialogElement, save, sprites);

  // Pestaña para ocultar o mostrar la columna del equipo (se recuerda entre visitas).
  const toggle = document.getElementById("team-toggle")!;
  const analyzeButton = document.getElementById("analyze")!;
  const applyTeam = () => {
    teamWrap.classList.toggle("hidden", teamHidden);
    teamEl.inert = teamHidden; // oculto: tampoco se llega con el teclado
    analyzeButton.inert = teamHidden;
    toggle.textContent = teamHidden ? "▶" : "◀";
    toggle.setAttribute("aria-label", teamHidden ? "Mostrar equipo" : "Ocultar equipo");
    fit();
  };
  toggle.addEventListener("click", () => {
    teamHidden = !teamHidden;
    try {
      localStorage.setItem("rancho.equipo", teamHidden ? "oculto" : "visible");
    } catch {
      // Sin almacenamiento: no se recuerda.
    }
    applyTeam();
  });
  applyTeam();

  // Botones de zoom (también funciona la rueda del ratón sobre el rancho).
  document.getElementById("zoom")!.addEventListener("click", (e) => {
    const action = (e.target as HTMLElement).closest("button")?.dataset.zoom;
    if (action === "in") ranch.zoomBy(1.4);
    if (action === "out") ranch.zoomBy(1 / 1.4);
    if (action === "reset") ranch.resetZoom();
  });

  return {
    show() {
      root.hidden = false;
      app.ticker.start();
      fit();
    },
    hide() {
      root.hidden = true;
      app.ticker.stop(); // fuera de la vista no se anima nada
    },
  };
}
