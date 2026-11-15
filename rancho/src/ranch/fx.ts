// Efectos visuales de los combates, dibujados por código: proyectiles, impactos, ondas, chispas y números.
import { Container, Graphics, Text } from "pixi.js";

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
  wave(color: number, at: Point, radius: number): void {
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

  /** Texto flotante: el daño de un golpe, "falló"… */
  text(content: string, at: Point, color: number): void {
    const label = new Text({
      text: content,
      style: { fontFamily: "Rubik Variable, sans-serif", fontSize: 8, fontWeight: "700", fill: color, stroke: { color: 0xffffff, width: 2 } },
      resolution: 6,
    });
    label.anchor.set(0.5);
    this.add(label, 0.9, (t) => {
      label.position.set(at.x, at.y - 10 - 14 * t);
      label.alpha = t < 0.7 ? 1 : (1 - t) / 0.3;
    });
  }
}
