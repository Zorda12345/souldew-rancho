import { defineConfig, type Plugin } from "vite";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// El rancho se compila a web/rancho/, que el servidor de souldew sirve en /rancho/.
// Los sprites viven ya en web/rancho/sprites/ (no se copian: así no están dos veces en el repo).
const SPRITES = fileURLToPath(new URL("../web/rancho/sprites/", import.meta.url));

/** En `npm run rancho:dev`, sirve /rancho/sprites/... desde web/rancho/sprites/. */
const devSprites = (): Plugin => ({
  name: "rancho-sprites",
  configureServer(server) {
    server.middlewares.use("/rancho/sprites", (req, res, next) => {
      const file = SPRITES + decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
      if (!file.startsWith(SPRITES) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader("Content-Type", file.endsWith(".png") ? "image/png" : file.endsWith(".json") ? "application/json" : "application/xml");
      createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/rancho/",
  publicDir: false,
  plugins: [devSprites()],
  build: {
    outDir: "../web/rancho",
    emptyOutDir: false, // no borrar sprites/; scripts/build-rancho.mjs limpia lo compilado antes
    target: "es2022",
  },
  server: { port: Number(process.env.PORT) || 5173 },
});
