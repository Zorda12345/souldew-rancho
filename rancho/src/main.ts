// souldew prohíbe eval() en su política de seguridad (CSP): este módulo hace que PixiJS no lo necesite.
import "pixi.js/unsafe-eval";
import { startRanch } from "./ranch/app.ts";
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

followAppTheme();
const ranch = await startRanch(document.getElementById("ranch-root")!);
ranch.show();
