// Un Pokémon del rancho: su dibujo y su pequeña "máquina de estados".
import { friction } from "../battle/motion.ts";
import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import type { Pokemon } from "../data/schema.ts";
import type { AnimName, SpriteSet } from "./sprites.ts";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Ellipse { x: number; y: number; rx: number; ry: number }
/** Lo que el rancho comparte con todos los Pokémon. night: 0 de día … 1 de noche cerrada. */
export interface Environment { night: number }

export const insideEllipse = (e: Ellipse, x: number, y: number) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1;
/** Punto al azar dentro de una elipse (scale < 1 lo aleja del borde). */
export function pointInEllipse(e: Ellipse, scale = 1): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * scale;
  return { x: e.x + Math.cos(angle) * e.rx * r, y: e.y + Math.sin(angle) * e.ry * r };
}

type State = "walk" | "idle" | "sleep" | "meet";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const MIN_SPEED = 18; // píxeles del mundo por segundo

export class Critter {
  readonly view = new Container();
  private sprite: Sprite | null = null;
  private stars: Graphics[] = [];
  private emote: Text;
  private label: Container | null = null; // cartelito con mote y nivel, se crea al pasar el ratón
  private labelY: number;
  private hovered = false;
  private controlled = false; // true mientras lo dirige un combate: deja de decidir por su cuenta
  private once = false; // la animación actual se reproduce una sola vez…
  private faint = -1; // segundos que le quedan de parpadeo antes de desaparecer (-1 = no está cayendo)
  private after: AnimName = "Idle"; // …y luego pasa a esta
  private hpBar: Graphics | null = null;
  private crown: Graphics | null = null;
  private topY: number; // altura de la cabeza, para colocar la barra de PS y la corona

  private state: State = "idle";
  private timer = 0; // segundos que quedan en el estado actual
  private cooldown = rand(3, 15); // segundos hasta poder volver a saludar a alguien
  private target = { x: 0, y: 0 };
  private partner: Critter | null = null;
  private speed = rand(MIN_SPEED, 26);
  private dir = 0; // fila de la hoja: 0 abajo, 2 derecha, 4 arriba, 6 izquierda (y diagonales)
  private animName: AnimName = "Idle";
  private frame = 0;
  private frameTicks = 0;
  private age = rand(0, 10);
  private knock = { vx: 0, vy: 0 }; // empujón de un golpe (px/s), se frena solo
  private flashTime = 0; // segundos que le quedan del destello al recibir un golpe

  readonly pokemon: Pokemon;
  readonly set: SpriteSet | null;
  private ring: Graphics;
  private zone: Rect;
  private home: Ellipse | null; // sitio favorito según su tipo (estanque, hierba alta)
  private avoid: Ellipse | null; // sitio al que no va por gusto (el agua, si no es de agua)
  private env: Environment;

  /** Cambia su sitio favorito y el que evita (al cambiar el escenario de la caja). */
  setPlaces(home: Ellipse | null, avoid: Ellipse | null): void {
    this.home = home;
    this.avoid = avoid;
  }

  constructor(pokemon: Pokemon, set: SpriteSet | null, zone: Rect, home: Ellipse | null, avoid: Ellipse | null, env: Environment) {
    this.pokemon = pokemon;
    this.set = set;
    this.zone = zone;
    this.home = home;
    this.avoid = avoid;
    this.env = env;
    const body = set?.body ?? { x: -10, y: -10, w: 20, h: 20 };
    this.labelY = body.y - 9;
    this.topY = body.y;
    const r = 5 + (set?.shadow ?? 1) * 3;
    this.view.addChild(new Graphics().ellipse(0, 4, r, r / 2).fill({ color: 0x000000, alpha: 0.22 }));
    // Aro que marca al Pokémon seleccionado.
    this.ring = new Graphics().ellipse(0, 4, r + 4, (r + 4) / 2).stroke({ width: 1.5, color: 0xffffff });
    this.ring.visible = false;
    this.view.addChild(this.ring);
    // Clicable: solo cuenta la zona donde hay dibujo.
    this.view.eventMode = "static";
    this.view.cursor = "pointer";
    this.view.hitArea = new Rectangle(body.x, body.y, body.w, body.h);
    this.view.on("pointerover", () => this.hover(true));
    this.view.on("pointerout", () => this.hover(false));

    if (set) {
      this.sprite = new Sprite(set.anims.Idle.frames[0][0]);
      this.sprite.anchor.set(0.5);
      this.view.addChild(this.sprite);
    } else {
      // Marcador provisional: un círculo con el número de la especie.
      this.view.addChild(new Graphics().circle(0, 0, 10).fill(0xe8e8e8).stroke({ width: 1.5, color: 0x555555 }));
      const label = new Text({ text: String(pokemon.species), style: { fontFamily: "sans-serif", fontSize: 8, fontWeight: "bold", fill: 0x333333 }, resolution: 6 });
      label.anchor.set(0.5);
      this.view.addChild(label);
    }

    if (pokemon.shiny) {
      // Destellos repartidos sobre el dibujo del sprite.
      for (const [fx, fy] of [[0.1, 0.15], [0.9, 0.3], [0.25, 0.8], [0.8, 0.9]]) {
        const star = new Graphics().star(0, 0, 4, 5, 1.8).fill(0xffffff);
        star.position.set(body.x + fx * body.w, body.y + fy * body.h);
        this.stars.push(star);
        this.view.addChild(star);
      }
    }

    this.emote = new Text({ text: "♥", style: { fontFamily: "sans-serif", fontSize: 9, fill: 0xff5a7a, stroke: { color: 0xffffff, width: 2 } }, resolution: 6 });
    this.emote.anchor.set(0.5);
    this.emote.y = body.y - 5;
    this.emote.visible = false;
    this.view.addChild(this.emote);

    const start = this.pickTarget();
    this.view.position.set(start.x, start.y);
    const asleep = pokemon.status === "sleep" || Math.random() < env.night * 0.7; // de noche, muchos ya duermen
    this.enter(asleep ? "sleep" : Math.random() < 0.5 ? "idle" : "walk");
  }

  set selected(value: boolean) {
    this.ring.visible = value;
  }

  /** ¿Está libre para acercarse a saludar a otro? */
  get canMeet(): boolean {
    return !this.controlled && this.cooldown <= 0 && (this.state === "walk" || this.state === "idle");
  }

  /** emote: lo que muestra al encontrarse (corazón entre buenos amigos, nota musical si no). */
  startMeet(partner: Critter, x: number, y: number, seconds: number, emote: "♥" | "♪"): void {
    this.emote.text = emote;
    this.emote.style.fill = emote === "♥" ? 0xff5a7a : 0x3d7be0;
    this.state = "meet";
    this.partner = partner;
    this.target = { x, y };
    this.timer = seconds;
    this.setAnim("Walk");
  }

  update(dt: number): void {
    this.timer -= dt;
    this.cooldown -= dt;
    this.age += dt;
    if (this.knock.vx !== 0 || this.knock.vy !== 0) {
      // Retroceso: se desliza hacia atrás frenando, sin salirse del prado.
      this.view.x = Math.min(this.zone.x + this.zone.w, Math.max(this.zone.x, this.view.x + this.knock.vx * dt));
      this.view.y = Math.min(this.zone.y + this.zone.h, Math.max(this.zone.y, this.view.y + this.knock.vy * dt));
      this.knock.vx = friction(this.knock.vx, dt);
      this.knock.vy = friction(this.knock.vy, dt);
      if (Math.hypot(this.knock.vx, this.knock.vy) < 4) this.knock = { vx: 0, vy: 0 };
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.sprite) this.sprite.tint = this.flashTime > 0 ? 0xff7a7a : 0xffffff;
      this.view.scale.set(this.flashTime > 0 ? 1.08 : 1, this.flashTime > 0 ? 0.92 : 1); // se aplasta un poco
    }
    if (this.faint >= 0) {
      // Derrotado: parpadea cada vez más cerca del final y desaparece.
      this.faint -= dt;
      this.view.visible = this.faint > 0 && Math.floor(this.faint / 0.08) % 2 === 0;
    }

    if (!this.controlled) switch (this.state) {
      case "walk":
        if (this.moveToTarget(dt)) this.enter("idle");
        break;
      case "idle":
        // De día se duerme poco (15 %); de noche, casi siempre (hasta 75 %).
        if (this.timer <= 0) this.enter(Math.random() < 0.15 + 0.6 * this.env.night ? "sleep" : "walk");
        break;
      case "sleep":
        if (this.timer <= 0) this.enter("idle");
        break;
      case "meet":
        if (this.moveToTarget(dt) && this.partner) {
          // Ya ha llegado: se queda quieto mirando al otro.
          this.setAnim("Idle");
          this.face(this.partner.view.x - this.view.x, this.partner.view.y - this.view.y);
          this.emote.visible = true;
        }
        if (this.timer <= 0) {
          this.emote.visible = false;
          this.partner = null;
          this.cooldown = rand(15, 30);
          this.enter("walk");
        }
        break;
    }

    this.animate(dt);
    this.view.zIndex = this.view.y + (this.hovered ? 1000 : 0); // los de más abajo, por delante; el señalado, encima de todos
    this.stars.forEach((star, i) => {
      const glow = Math.max(0, Math.sin(this.age * 3 + i * 2.1));
      star.alpha = glow;
      star.scale.set(glow);
    });
  }

  private enter(state: State): void {
    this.state = state;
    if (state === "walk") {
      this.target = this.pickTarget();
      this.setAnim("Walk");
    } else if (state === "idle") {
      this.timer = rand(1.5, 4);
      this.setAnim("Idle");
    } else if (state === "sleep") {
      this.timer = rand(8, 16) * (1 + 2 * this.env.night); // de noche los sueños duran más
      this.setAnim("Sleep");
    }
  }

  /** Elige adónde ir: a menudo a su sitio favorito; si no, a cualquier punto que no sea el que evita. */
  private pickTarget(): { x: number; y: number } {
    if (this.home && Math.random() < 0.65) return pointInEllipse(this.home, 0.85);
    let point = { x: 0, y: 0 };
    for (let tries = 0; tries < 6; tries++) {
      point = { x: rand(this.zone.x, this.zone.x + this.zone.w), y: rand(this.zone.y, this.zone.y + this.zone.h) };
      if (!this.avoid || !insideEllipse(this.avoid, point.x, point.y)) break;
    }
    return point;
  }

  private hover(on: boolean): void {
    this.hovered = on;
    if (on && !this.label) {
      const text = new Text({
        text: `${this.pokemon.nickname}  Nv. ${this.pokemon.level}`,
        style: { fontFamily: "IBM Plex Sans, sans-serif", fontSize: 7, fontWeight: "600", fill: 0xebe6da },
        resolution: 6,
      });
      text.anchor.set(0.5);
      const bg = new Graphics()
        .roundRect(-text.width / 2 - 3, -text.height / 2 - 1.5, text.width + 6, text.height + 3, 3)
        .fill({ color: 0x222128, alpha: 0.94 })
        .stroke({ width: 1, color: 0x0f0e12 });
      this.label = new Container();
      this.label.addChild(bg, text);
      this.label.y = this.labelY;
      this.view.addChild(this.label);
    }
    if (this.label) this.label.visible = on;
  }

  /** Avanza hacia el objetivo. Devuelve true cuando ha llegado. */
  private moveToTarget(dt: number): boolean {
    const dx = this.target.x - this.view.x;
    const dy = this.target.y - this.view.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step) {
      this.view.position.set(this.target.x, this.target.y);
      return true;
    }
    this.face(dx, dy);
    this.view.x += (dx / dist) * step;
    this.view.y += (dy / dist) * step;
    return false;
  }

  /** Convierte un vector de movimiento en una de las 8 filas de la hoja. */
  private face(dx: number, dy: number): void {
    const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // -4..4, 0 = derecha
    this.dir = (10 - octant) % 8;
  }

  private setAnim(name: AnimName): void {
    if (name === this.animName) return;
    this.animName = name;
    this.frame = 0;
    this.frameTicks = 0;
  }

  private animate(dt: number): void {
    if (!this.set || !this.sprite) return;
    const current = () => this.set!.anims[this.animName] ?? this.set!.anims.Idle;
    let anim = current();
    this.frameTicks += dt * 60;
    while (this.frameTicks >= anim.durations[this.frame]) {
      this.frameTicks -= anim.durations[this.frame];
      this.frame = (this.frame + 1) % anim.durations.length;
      if (this.frame === 0 && this.once) {
        // Ha terminado una animación de una sola vez (atacar, recibir daño).
        this.once = false;
        this.setAnim(this.after);
        anim = current();
      }
    }
    const row = anim.frames[this.dir] ?? anim.frames[0]; // Sleep solo tiene una fila
    this.sprite.texture = row[this.frame];
  }

  // ---------- Órdenes que le da un combate ----------

  /** Toma o suelta el control del Pokémon. Al soltarlo vuelve a su vida normal. */
  setControlled(on: boolean): void {
    this.controlled = on;
    this.once = false;
    this.partner = null;
    this.emote.visible = false;
    this.faint = -1;
    this.view.visible = true; // los derrotados reaparecen al acabar la pelea
    if (on) {
      this.setAnim("Idle");
    } else {
      this.setHp(null);
      this.enter("idle");
    }
  }

  /** Reproduce una animación; si se indica `then`, lo hace una sola vez y después pasa a esa otra. */
  pose(name: AnimName, then: AnimName | null = null): void {
    this.once = then !== null;
    this.after = then ?? "Idle";
    this.animName = name;
    this.frame = 0;
    this.frameTicks = 0;
  }

  lookAt(x: number, y: number): void {
    this.face(x - this.view.x, y - this.view.y);
  }

  /** Da un paso hacia un punto a la velocidad indicada. Devuelve true si ya ha llegado. */
  stepToward(x: number, y: number, dt: number, speed: number): boolean {
    if (!this.once) this.setAnim("Walk");
    this.target = { x, y };
    const own = this.speed;
    this.speed = speed;
    const arrived = this.moveToTarget(dt);
    this.speed = own;
    return arrived;
  }

  /** Recibe un golpe: empujón (px/s en esa dirección) y destello rojo con un leve aplastamiento. */
  hit(vx: number, vy: number): void {
    this.knock.vx += vx;
    this.knock.vy += vy;
    this.flashTime = 0.14;
  }

  /** ¿Sigue retrocediendo por un golpe? Mientras tanto no puede moverse por su cuenta. */
  get staggered(): boolean {
    return this.knock.vx !== 0 || this.knock.vy !== 0;
  }

  stand(): void {
    if (!this.once) this.setAnim("Idle");
  }

  /** Debilitado, como en Mundo Misterioso: animación de recibir un golpe, parpadeo y desaparece. */
  knockOut(): void {
    this.pose("Hurt");
    this.setHp(null);
    this.faint = 0.9;
  }

  /** Barrita de PS sobre la cabeza (ratio de 0 a 1). Con null se oculta. */
  setHp(ratio: number | null): void {
    if (ratio === null) {
      if (this.hpBar) this.hpBar.visible = false;
      return;
    }
    if (!this.hpBar) {
      this.hpBar = new Graphics();
      this.hpBar.y = this.topY - 5;
      this.view.addChild(this.hpBar);
    }
    const color = ratio > 0.5 ? 0x6fb39b : ratio > 0.2 ? 0xe1b05a : 0xdc7268;
    this.hpBar.visible = true;
    this.hpBar.clear().rect(-10.5, -0.5, 21, 4).fill(0x0f0e12).rect(-10, 0, 20, 3).fill(0x33323b);
    if (ratio > 0) this.hpBar.rect(-10, 0, Math.max(1, 20 * ratio), 3).fill(color);
  }

  /** Corona del rey de la caja. */
  setCrown(on: boolean): void {
    if (on && !this.crown) {
      this.crown = new Graphics()
        .rect(-5, -3, 10, 3).rect(-5, -6, 2, 3).rect(-1, -7, 2, 4).rect(3, -6, 2, 3).fill(0xf2b632)
        .rect(-5, -1, 10, 1).fill(0xc98f1a)
        .rect(-1, -3, 2, 1).fill(0xd9503a);
      this.crown.y = this.topY - 7;
      this.view.addChild(this.crown);
    }
    if (this.crown) this.crown.visible = on;
  }
}
