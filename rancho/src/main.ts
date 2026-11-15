// souldew prohíbe eval() en su política de seguridad (CSP): este módulo hace que PixiJS no lo necesite.
import "pixi.js/unsafe-eval";
import { startRanch } from "./ranch/app.ts";
import "@fontsource-variable/pixelify-sans";
import "@fontsource-variable/rubik";
import "./tokens.css";

// Arranque del rancho dentro de souldew: la vista «Rancho» lo carga en un iframe (web/rancho/),
// así sus estilos y su PixiJS no se mezclan con los de la app.
const ranch = await startRanch(document.getElementById("ranch-root")!);
ranch.show();
