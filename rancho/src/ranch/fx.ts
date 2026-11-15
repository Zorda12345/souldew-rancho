// Efectos visuales de los combates, dibujados por código: proyectiles, impactos, ondas, chispas y números.
import { Container, Graphics, Text } from "pixi.js";
import { TYPES, type TypeId } from "../data/types.ts";

/** Familias de animación: cada tipo se dibuja con una. */
type Style = "burst" | "splash" | "bolt" | "leaf" | "shard" | "ring" | "rock" | "slash";
const STYLE: Record<TypeId, Style> = {
  fire: "burst", dragon: "burst",
  water: "splash", poison: "splash",
  electric: "bolt",
  grass: "leaf", bug: "leaf",
  ice: "shard", steel: "shard",
  psychic: "ring", ghost: "ring", dark: "ring",
  rock: "rock", ground: "rock",
  normal: "slash", fighting: "slash", flying: "slash",
};
const styleOf = (type: TypeId): Style => STYLE[type];
const colorOf = (type: TypeId) => parseInt(TYPES[type].color.slice(1), 16);

interface Point { x: number; y: number }
interface Effect {
  node: Container;
  age: number;
  ttl: number; // segundos que dura
  step(t: number): void; // t va de 0 (nace) a 1 (desaparece)
}

export class Fx {
  readonly layer = new Container();
  private effects: Effect[] = [];

  update(dt: number): void {
    for (const e of this.effects) {
      e.age += dt;
      e.step(Math.min(1, e.age / e.ttl));
    }
    this.effects = this.effects.filter((e) => {
      if (e.age < e.ttl) return true;
      e.node.destroy();
      return false;
    });
  }

  clear(): void {
    for (const e of this.effects) e.node.destroy();
    this.effects = [];
  }

  private add(node: Container, ttl: number, step: (t: number) => void): void {
    this.layer.addChild(node);
    this.effects.push({ node, age: 0, ttl, step });
    step(0);
  }

  /** Ataque a distancia: un bloque del color del tipo, con estela, que vuela de un punto a otro. */
  projectile(color: number, from: Point, to: Point, size: number, ttl: number): void {
    const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / dist;
    const uy = (to.y - from.y) / dist;
    const g = new Graphics();
    for (let i = 3; i >= 1; i--) g.rect(-ux * i * size - size / 2, -uy * i * size - size / 2, size, size).fill({ color, alpha: 0.8 - i * 0.2 });
    g.rect(-size, -size, size * 2, size * 2).fill(color);
    g.rect(-size / 2, -size / 2, size, size).fill({ color: 0xffffff, alpha: 0.85 });
    this.add(g, ttl, (t) => g.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t));
  }

  /** Proyectil con la forma de su tipo: llama, gota, rayo, hoja, cristal, onda… (el resto, el bloque de siempre). */
  shot(type: TypeId, from: Point, to: Point, size: number, ttl: number): void {
    const style = styleOf(type);
    const color = colorOf(type);
    const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / dist;
    const uy = (to.y - from.y) / dist;
    const at = (t: number) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });

    if (style === "bolt") {
      // Rayo: una línea en zigzag que parpadea entre los dos, sin "viajar"
      const g = new Graphics();
      this.add(g, ttl, (t) => {
        g.clear();
        if (Math.floor(t * 12) % 2) return;
        g.moveTo(from.x, from.y);
        for (let i = 1; i < 6; i++) {
          const p = at(i / 6);
          const side = (i % 2 ? 1 : -1) * 4;
          g.lineTo(p.x - uy * side, p.y + ux * side);
        }
        g.lineTo(to.x, to.y).stroke({ width: 2, color: 0xfff6a8 }).stroke({ width: 1, color });
      });
      return;
    }
    const g = new Graphics();
    if (style === "burst") {
      // Bola de fuego con estela de chispas
      for (let i = 4; i >= 1; i--) g.circle(-ux * i * 3, -uy * i * 3, size * (1 - i * 0.18)).fill({ color: 0xffb347, alpha: 0.7 - i * 0.12 });
      g.circle(0, 0, size + 1).fill(color).circle(0, 0, size * 0.5).fill(0xfff1a8);
    } else if (style === "splash") {
      g.circle(0, 0, size).fill(color).moveTo(-ux * size * 2.4, -uy * size * 2.4).lineTo(-uy * size, ux * size).lineTo(uy * size, -ux * size).closePath().fill(color);
      g.circle(-size * 0.3, -size * 0.3, size * 0.35).fill({ color: 0xffffff, alpha: 0.8 });
    } else if (style === "leaf") {
      g.ellipse(0, 0, size + 2, size * 0.6).fill(color).moveTo(-size - 2, 0).lineTo(size + 2, 0).stroke({ width: 0.6, color: 0x2f6b2a });
    } else if (style === "shard") {
      g.moveTo(0, -size - 2).lineTo(size, 0).lineTo(0, size + 2).lineTo(-size, 0).closePath().fill(color);
      g.moveTo(0, -size).lineTo(size * 0.4, 0).lineTo(0, 0).closePath().fill({ color: 0xffffff, alpha: 0.7 });
    } else if (style === "ring") {
      g.circle(0, 0, size + 2).stroke({ width: 1.5, color }).circle(0, 0, size * 0.6).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
    } else {
      this.projectile(color, from, to, size, ttl);
      return;
    }
    this.add(g, ttl, (t) => {
      const p = at(t);
      g.position.set(p.x, p.y);
      if (style === "leaf" || style === "shard") g.rotation = t * 12; // giran mientras vuelan
      if (style === "ring") g.scale.set(1 + Math.sin(t * 20) * 0.15);
    });
  }

  /** Impacto con el estilo de su tipo. */
  hitFx(type: TypeId, at: Point): void {
    const style = styleOf(type);
    const color = colorOf(type);
    if (style === "slash") {
      // Dos zarpazos que se cruzan
      const g = new Graphics();
      g.position.set(at.x, at.y - 4);
      this.add(g, 0.22, (t) => {
        g.clear();
        const len = 12 * Math.min(1, t * 3);
        g.moveTo(-len / 2, -len / 2).lineTo(len / 2, len / 2).moveTo(len / 2, -len / 2).lineTo(-len / 2, len / 2);
        g.stroke({ width: 2, color: 0xffffff, alpha: 1 - t }).stroke({ width: 1, color, alpha: 1 - t });
      });
      this.impact(color, at);
      return;
    }
    if (style === "ring") {
      const g = new Graphics();
      g.position.set(at.x, at.y - 4);
      this.add(g, 0.4, (t) => {
        g.clear().circle(0, 0, 4 + 14 * t).stroke({ width: 2, color, alpha: 1 - t }).circle(0, 0, 2 + 8 * t).stroke({ width: 1, color: 0xffffff, alpha: 1 - t });
      });
      return;
    }
    // El resto: partículas que salen disparadas con la forma de su tipo
    const bits = style === "bolt" ? 6 : 8;
    for (let i = 0; i < bits; i++) {
      const angle = (i / bits) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 14 + Math.random() * 10;
      const g = new Graphics();
      if (style === "burst") g.moveTo(0, -3).lineTo(2, 1).lineTo(-2, 1).closePath().fill(i % 2 ? 0xffd166 : color);
      else if (style === "splash") g.circle(0, 0, 1.6).fill(i % 2 ? 0xd8f0ff : color);
      else if (style === "leaf") g.ellipse(0, 0, 2.4, 1.2).fill(color);
      else if (style === "shard") g.moveTo(0, -2.5).lineTo(1.2, 0).lineTo(0, 2.5).lineTo(-1.2, 0).closePath().fill(i % 2 ? 0xffffff : color);
      else if (style === "rock") g.rect(-1.5, -1.5, 3, 3).fill(i % 2 ? 0x8d7a5a : color);
      else g.rect(-0.8, -2.5, 1.6, 5).fill(0xfff6a8); // bolt: chispas
      const fall = style === "rock" || style === "splash" ? 40 : style === "burst" ? -20 : 0; // lo pesado cae; el fuego sube
      this.add(g, 0.35, (t) => {
        g.position.set(at.x + Math.cos(angle) * speed * t, at.y - 4 + Math.sin(angle) * speed * t * 0.7 + fall * t * t);
        g.rotation = t * 6;
        g.alpha = 1 - t;
      });
    }
    this.impact(color, at);
  }

  /** Golpe: un destello en forma de estrella que crece y se apaga. */
  impact(color: number, at: Point): void {
    const g = new Graphics().star(0, 0, 6, 9, 4).fill(color).star(0, 0, 6, 5, 2).fill(0xffffff);
    g.position.set(at.x, at.y);
    this.add(g, 0.25, (t) => {
      g.scale.set(0.5 + t);
      g.alpha = 1 - t;
    });
  }

  /** Ataque de área: dos anillos que se expanden desde el atacante. */
  wave(type: TypeId, at: Point, radius: number): void {
    const color = colorOf(type);
    if (styleOf(type) === "rock") {
      // Terremoto y similares: además de la onda, piedras que saltan del suelo
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = radius * (0.3 + Math.random() * 0.6);
        const rock = new Graphics().rect(-1.5, -1.5, 3, 3).fill(i % 2 ? 0x8d7a5a : color);
        this.add(rock, 0.5, (t) => {
          rock.position.set(at.x + Math.cos(angle) * d, at.y + Math.sin(angle) * d * 0.6 - Math.sin(t * Math.PI) * 10);
          rock.alpha = 1 - t * t;
        });
      }
    }
    const g = new Graphics();
    g.position.set(at.x, at.y);
    this.add(g, 0.55, (t) => {
      g.clear();
      g.ellipse(0, 0, radius * t, radius * t * 0.6).stroke({ width: 4 * (1 - t) + 1, color, alpha: 1 - t });
      g.ellipse(0, 0, radius * t * 0.6, radius * t * 0.36).stroke({ width: 2, color: 0xffffff, alpha: (1 - t) * 0.7 });
    });
  }

  /** Efecto sobre uno mismo (subir estadísticas, curarse): chispitas que suben. */
  sparkle(color: number, at: Point): void {
    const g = new Graphics();
    for (const [x, y] of [[-8, 2], [-3, -4], [2, 3], [7, -2], [0, 6]]) g.rect(x, y, 2, 2).rect(x - 1, y + 1, 4, 0.8);
    g.fill(color);
    this.add(g, 0.7, (t) => {
      g.position.set(at.x, at.y - 16 * t);
      g.alpha = 1 - t;
    });
  }

  /** Dash: nubecillas de polvo que quedan atrás y se deshacen. */
  dust(at: Point, dir: Point): void {
    const g = new Graphics();
    for (const [x, y, r] of [[0, 0, 3], [-dir.x * 5 - 2, -dir.y * 5 + 1, 2.4], [-dir.x * 9 + 2, -dir.y * 9, 1.8]]) g.circle(x, y, r);
    g.fill({ color: 0xf2ead8, alpha: 0.85 });
    g.position.set(at.x, at.y + 2);
    this.add(g, 0.35, (t) => {
      g.scale.set(1 + t * 0.8);
      g.alpha = 1 - t;
    });
  }

  /** Texto flotante: el daño de un golpe, "falló"… */
  text(content: string, at: Point, color: number): void {
    const label = new Text({
      text: content,
      style: { fontFamily: "IBM Plex Sans, sans-serif", fontSize: 8, fontWeight: "700", fill: color, stroke: { color: 0xffffff, width: 2 } },
      resolution: 6,
    });
    label.anchor.set(0.5);
    this.add(label, 0.9, (t) => {
      label.position.set(at.x, at.y - 10 - 14 * t);
      label.alpha = t < 0.7 ? 1 : (1 - t) / 0.3;
    });
  }
}
