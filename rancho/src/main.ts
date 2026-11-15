// souldew prohíbe eval() en su política de seguridad (CSP): este módulo hace que PixiJS no lo necesite.
import "pixi.js/unsafe-eval";
import { startRanch } from "./ranch/app.ts";
import { loadSource, rememberPlayer, type Source } from "./data/source.ts";
import "./tokens.css";

// Arranque del rancho dentro de souldew: la vista «Rancho» lo carga en un iframe (web/rancho/),
// así sus estilos y su PixiJS no se mezclan con los de la app.

/** Copia el esquema de color de la app (Ajustes › Aspecto) y lo sigue si cambia. */
function followAppTheme() {
  try {
    const app = window.parent.document.documentElement; // mismo origen: se puede leer
    const sync = () => {
      const theme = app.dataset.theme;
      if (theme) document.documentElement.dataset.theme = theme;
      else delete document.documentElement.dataset.theme;
    };
    sync();
    new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ["data-theme"] });
  } catch {
    // Abierto fuera de la app (p. ej. con rancho:dev): esquema por defecto.
  }
}

/** Encima del equipo: de dónde salen los datos y, si la run tiene varios jugadores, de cuál se ven los Pokémon. */
function showSource(source: Source) {
  const el = document.getElementById("source")!;
  const note = document.createElement("p");
  note.textContent = source.label;
  el.append(note);
  if (source.players.length > 1) {
    const label = document.createElement("label");
    label.textContent = "Pokémon de ";
    const select = document.createElement("select");
    for (const p of source.players) select.add(new Option(p.name, p.slot, false, p.slot === source.slot));
    select.addEventListener("change", () => {
      rememberPlayer(select.value);
      location.reload(); // se vuelve a montar el rancho con los del otro jugador
    });
    label.append(select);
    el.append(label);
  }
}

followAppTheme();
const source = await loadSource();
showSource(source);
const ranch = await startRanch(document.getElementById("ranch-root")!, source);
ranch.show();
