// Panel de combates: botones "Rey de la caja" y "Duelo", elección de combatientes y registro de la pelea.
import type { Pokemon } from "../data/schema.ts";

export interface BattleActions {
  king(): boolean; // devuelve false si no se puede empezar
  duel(a: Pokemon, b: Pokemon): void;
  stop(): void;
}

export interface BattleUI {
  /** Avisa de que se ha hecho clic en un Pokémon. Devuelve true si el clic era para elegir combatiente. */
  pick(pokemon: Pokemon): boolean;
  log(text: string): void;
  finish(text: string): void;
}

const LOG_LINES = 4;

export function createBattleUI(root: HTMLElement, actions: BattleActions): BattleUI {
  let state: "idle" | "picking" | "fighting" = "idle";
  let picks: Pokemon[] = [];
  let lines: string[] = [];
  let result = "";

  const el = (tag: string, className: string, text: string) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text; // textContent: los motes del archivo nunca se interpretan como HTML
    return node;
  };
  const button = (act: string, text: string) => {
    const b = el("button", "", text) as HTMLButtonElement;
    b.type = "button";
    b.dataset.act = act;
    return b;
  };

  const render = () => {
    root.replaceChildren();
    root.dataset.state = state;
    if (state === "idle") {
      if (result) root.append(el("p", "result", result));
      const row = el("div", "row", "");
      row.append(button("king", "♛ Rey de la caja"), button("duel", "⚔ Duelo"));
      root.append(row);
    } else if (state === "picking") {
      root.append(el("p", "result", `Haz clic en dos Pokémon de esta caja o de tu equipo (${picks.length} de 2).`));
      const row = el("div", "row", "");
      row.append(button("cancel", "Cancelar"));
      root.append(row);
    } else {
      const list = el("ol", "log", "");
      list.setAttribute("aria-live", "polite");
      for (const line of lines) list.append(el("li", "", line));
      const row = el("div", "row", "");
      row.append(button("stop", "Parar"));
      root.append(list, row);
    }
  };

  const fight = () => {
    state = "fighting";
    lines = ["¡Empieza la pelea!"];
    result = "";
    render();
  };

  root.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("button")?.dataset.act;
    if (act === "king") {
      if (actions.king()) fight();
      else {
        result = "Hacen falta al menos dos Pokémon en la caja.";
        render();
      }
    } else if (act === "duel") {
      state = "picking";
      picks = [];
      render();
    } else if (act === "cancel") {
      state = "idle";
      result = "";
      render();
    } else if (act === "stop") {
      actions.stop();
    }
  });

  render();
  return {
    pick(pokemon) {
      if (state !== "picking") return false;
      if (!picks.includes(pokemon)) picks.push(pokemon);
      if (picks.length === 2) {
        fight();
        actions.duel(picks[0], picks[1]);
      } else {
        render();
      }
      return true;
    },
    log(text) {
      if (state !== "fighting") return;
      lines = [...lines, text].slice(-LOG_LINES);
      render();
    },
    finish(text) {
      state = "idle";
      result = text;
      render();
    },
  };
}
