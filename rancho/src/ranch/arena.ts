// Pelea en tiempo real sobre el prado. Aquí se decide quién ataca a quién y cuándo;
// cuánto daño hace cada golpe lo calculan las reglas de battle/damage.ts.
import { calcDamage, createFighter, effectiveStat, isPhysical, resolveAttack, type Fighter } from "../battle/damage.ts";
import { DASH, hitstop, knockback, moveSpeed, shake, type HitInfo } from "../battle/motion.ts";
import { MOVES, type Move } from "../data/moves.ts";
import type { StatKey } from "../data/stats.ts";
import { TYPES, effectivenessAgainst, type TypeId } from "../data/types.ts";
import type { Critter, Rect } from "./critter.ts";
import type { Fx } from "./fx.ts";

const MELEE = 24; // distancia de un golpe cuerpo a cuerpo (píxeles del mundo)
const SHOT = 120; // alcance de un ataque a distancia
const QUAKE = 66; // radio de un ataque de área
const STAMINA = 3; // aguante: los PS de combate son el triple de los reales (ajuste del rancho, no del juego)
const MAX_SECONDS = 150; // por si una pelea no acabara nunca
// Si un Pokémon no tiene ningún ataque conocido, pelea con un golpe básico.
const STRUGGLE: Move = { type: "normal", power: 40, accuracy: 100 };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const typeColor = (type: TypeId) => parseInt(TYPES[type].color.slice(1), 16);

interface Plan { name: string; move: Move }
interface Point { x: number; y: number }
interface Unit {
  critter: Critter;
  fighter: Fighter;
  name: string;
  target: Unit | null;
  plan: Plan; // el movimiento que está preparando
  cooldown: number; // segundos hasta poder actuar
  busy: number; // segundos que le quedan de la animación en curso
  retarget: number; // segundos hasta replantearse el rival
  heals: number; // curas usadas (máximo 2 por pelea)
  dash: number; // segundos que le quedan de dash (0 = no está dasheando)
  dashDir: Point; // dirección del dash (vector unitario)
  dashReady: number; // segundos hasta poder volver a dashear
  recover: number; // segundos sin poder atacar (tras un dash o al recibir un golpe)
}

export interface ArenaHooks {
  log(text: string): void;
  end(winner: Critter | null): void;
  /** Hace temblar la imagen (píxeles de pantalla) en los golpes fuertes. */
  shake(amount: number): void;
}

export class Arena {
  active = false;
  private units: Unit[] = [];
  private pending: { at: number; run(): void }[] = []; // cosas que pasarán dentro de un momento (impactos)
  private time = 0;
  private freeze = 0; // pausa de impacto: mientras dure, la pelea se congela un instante
  private endTimer = -1;
  private winner: Unit | null = null;
  private fx: Fx;
  private zone: Rect;
  private hooks: ArenaHooks;

  constructor(fx: Fx, zone: Rect, hooks: ArenaHooks) {
    this.fx = fx;
    this.zone = zone;
    this.hooks = hooks;
  }

  start(critters: Critter[]): void {
    this.active = true;
    this.time = 0;
    this.endTimer = -1;
    this.winner = null;
    this.pending = [];
    this.units = critters.map((critter) => {
      critter.setControlled(true);
      critter.setHp(1);
      const fighter = createFighter(critter.pokemon);
      // Con los PS reales una pelea dura dos golpes; se multiplican para que dé tiempo a verla.
      fighter.stats = { ...fighter.stats, hp: fighter.stats.hp * STAMINA };
      fighter.hp = fighter.stats.hp;
      const unit: Unit = {
        critter, fighter, name: critter.pokemon.nickname,
        target: null, plan: { name: "Forcejeo", move: STRUGGLE }, cooldown: rand(0.6, 1.6), busy: 0, retarget: 0, heals: 0,
        dash: 0, dashDir: { x: 0, y: 0 }, dashReady: rand(1, DASH.cooldown), recover: 0,
      };
      return unit;
    });
  }

  /** Corta la pelea sin ganador. */
  stop(): void {
    this.finish(null);
  }

  update(dt: number): void {
    if (this.freeze > 0) {
      this.freeze -= dt; // golpe: todo se para un instante (los empujones siguen, los mueve cada Pokémon)
      return;
    }
    this.time += dt;
    const due = this.pending.filter((p) => p.at <= this.time);
    this.pending = this.pending.filter((p) => p.at > this.time);
    for (const p of due) p.run();

    if (this.endTimer >= 0) {
      this.endTimer -= dt; // unos segundos para ver al ganador antes de volver a la calma
      if (this.endTimer < 0) this.finish(this.winner);
      return;
    }
    const alive = this.alive();
    if (this.time > MAX_SECONDS) {
      this.declare([...alive].sort((a, b) => b.fighter.hp / b.fighter.stats.hp - a.fighter.hp / a.fighter.stats.hp)[0]);
      return;
    }

    for (const unit of alive) {
      unit.cooldown -= dt;
      unit.busy -= dt;
      unit.retarget -= dt;
      unit.dashReady -= dt;
      unit.recover -= dt;
      if (unit.dash > 0) {
        unit.dash -= dt;
        this.dashStep(unit, dt);
        continue;
      }
      if (unit.critter.staggered) continue; // aún retrocede por un golpe
      if (!unit.target || unit.target.fighter.hp <= 0 || unit.retarget <= 0) this.pickTarget(unit);
      const target = unit.target;
      if (!target || unit.busy > 0) continue;

      const { move } = unit.plan;
      const me = unit.critter.view;
      const foe = target.critter.view;
      const range = this.rangeOf(move);
      const dist = Math.hypot(foe.x - me.x, foe.y - me.y);
      const towards = { x: (foe.x - me.x) / (dist || 1), y: (foe.y - me.y) / (dist || 1) };

      // Dash para acercarse (solo los de cuerpo a cuerpo y si aún está lejos) o para alejarse
      // si un atacante a distancia tiene encima a uno de cuerpo a cuerpo. Se decide poco a poco (dt), no cada fotograma.
      if (unit.dashReady <= 0 && Math.random() < dt * 1.5) {
        if (range === MELEE && dist > MELEE + 60) {
          this.startDash(unit, towards);
          continue;
        }
        if (range === SHOT && dist < MELEE * 1.6 && this.rangeOf(target.plan.move) === MELEE) {
          this.startDash(unit, { x: -towards.x, y: -towards.y });
          continue;
        }
      }

      if (dist > range) {
        // Aún está lejos: se acerca a su ritmo (según su Velocidad base).
        const x = Math.min(this.zone.x + this.zone.w, Math.max(this.zone.x, foe.x));
        const y = Math.min(this.zone.y + this.zone.h, Math.max(this.zone.y, foe.y));
        unit.critter.stepToward(x, y, dt, moveSpeed(unit.fighter));
      } else {
        unit.critter.stand();
        unit.critter.lookAt(foe.x, foe.y);
        if (unit.cooldown <= 0 && unit.recover <= 0) this.act(unit, target);
      }
    }
  }

  private rangeOf(move: Move): number {
    return move.power === 0 ? Infinity : move.area ? QUAKE * 0.7 : isPhysical(move.type) ? MELEE : SHOT;
  }

  /** Empieza un dash en una dirección: impulso corto, recarga larga y un momento sin poder atacar. */
  private startDash(unit: Unit, dir: Point): void {
    const len = Math.hypot(dir.x, dir.y) || 1;
    unit.dashDir = { x: dir.x / len, y: dir.y / len };
    unit.dash = DASH.seconds;
    unit.dashReady = DASH.cooldown;
    unit.recover = Math.max(unit.recover, DASH.seconds + DASH.recovery);
    this.fx.dust({ x: unit.critter.view.x, y: unit.critter.view.y }, unit.dashDir);
  }

  private dashStep(unit: Unit, dt: number): void {
    const me = unit.critter.view;
    const far = 40; // un punto por delante en la dirección del dash (dentro del prado)
    const x = Math.min(this.zone.x + this.zone.w, Math.max(this.zone.x, me.x + unit.dashDir.x * far));
    const y = Math.min(this.zone.y + this.zone.h, Math.max(this.zone.y, me.y + unit.dashDir.y * far));
    unit.critter.stepToward(x, y, dt, moveSpeed(unit.fighter) * DASH.multiplier);
  }

  /** Ante un ataque que viene, a veces lo esquiva con un dash de lado (más a menudo cuanto más rápido es). */
  private maybeDodge(unit: Unit, from: Point): void {
    if (unit.dashReady > 0 || unit.dash > 0 || unit.busy > 0 || unit.critter.staggered) return;
    if (Math.random() > 0.15 + Math.min(0.25, moveSpeed(unit.fighter) / 300)) return;
    const me = unit.critter.view;
    const side = Math.random() < 0.5 ? 1 : -1;
    const dx = me.x - from.x;
    const dy = me.y - from.y;
    this.later(0.08, () => {
      if (unit.fighter.hp > 0) this.startDash(unit, { x: -dy * side, y: dx * side }); // perpendicular al ataque
    });
  }

  private alive(): Unit[] {
    return this.units.filter((u) => u.fighter.hp > 0);
  }

  private later(seconds: number, run: () => void): void {
    this.pending.push({ at: this.time + seconds, run });
  }

  private pickTarget(unit: Unit): void {
    const me = unit.critter.view;
    const others = this.alive()
      .filter((u) => u !== unit)
      .sort((a, b) => Math.hypot(a.critter.view.x - me.x, a.critter.view.y - me.y) - Math.hypot(b.critter.view.x - me.x, b.critter.view.y - me.y));
    // Casi siempre va a por el más cercano; a veces cambia de idea.
    unit.target = others.length === 0 ? null : Math.random() < 0.7 ? others[0] : others[Math.floor(Math.random() * others.length)];
    unit.retarget = rand(4, 7);
    if (unit.target) unit.plan = this.choose(unit, unit.target);
  }

  /** Elige el próximo movimiento: curarse si va mal, a veces subirse estadísticas y, si no, el ataque que más daño haría. */
  private choose(unit: Unit, target: Unit): Plan {
    const known = unit.fighter.pokemon.moves.map((m) => ({ name: m.name, move: MOVES[m.name] })).filter((p) => p.move !== undefined);
    const heal = known.find((p) => p.move.heal);
    if (heal && unit.heals < 2 && unit.fighter.hp < unit.fighter.stats.hp * 0.4 && Math.random() < 0.7) return heal;
    const boost = known.find((p) => p.move.boost && Object.keys(p.move.boost).some((k) => (unit.fighter.stages[k as StatKey] ?? 0) < 2));
    if (boost && Math.random() < 0.18) return boost;

    const attacks = known.filter((p) => p.move.power > 0);
    if (attacks.length === 0) return { name: "Forcejeo", move: STRUGGLE };
    if (Math.random() < 0.2) return attacks[Math.floor(Math.random() * attacks.length)]; // un poco de variedad
    const expected = ({ move }: Plan) => {
      const physical = isPhysical(move.type);
      return calcDamage({
        level: unit.fighter.level, power: move.power,
        attack: effectiveStat(unit.fighter, physical ? "atk" : "spa"),
        defense: effectiveStat(target.fighter, physical ? "def" : "spd"),
        stab: unit.fighter.types.includes(move.type),
        effectiveness: effectivenessAgainst(move.type, target.fighter.types),
        critical: false, roll: 92,
      }) * ((move.accuracy ?? 100) / 100);
    };
    return attacks.reduce((best, p) => (expected(p) > expected(best) ? p : best));
  }

  private act(unit: Unit, target: Unit): void {
    const { name, move } = unit.plan;
    const me = { x: unit.critter.view.x, y: unit.critter.view.y };
    const foe = { x: target.critter.view.x, y: target.critter.view.y };
    unit.critter.pose("Attack", "Idle");
    unit.busy = 0.5;
    // La velocidad marca el ritmo: un Pokémon rápido ataca más a menudo.
    const pause = Math.min(2.3, Math.max(1, 2.5 - effectiveStat(unit.fighter, "spe") / 110));
    unit.cooldown = pause * (move.priority ? 0.6 : 1);

    if (move.power === 0) {
      this.later(0.2, () => this.selfEffect(unit, move));
    } else if (move.area) {
      this.later(0.25, () => {
        this.fx.wave(typeColor(move.type), me, QUAKE);
        const reached = this.alive().filter((u) => u !== unit && Math.hypot(u.critter.view.x - me.x, u.critter.view.y - me.y) <= QUAKE);
        for (const victim of reached) this.strike(unit, victim, name, move, reached.length > 1);
      });
    } else if (isPhysical(move.type)) {
      this.maybeDodge(target, me);
      this.later(0.25, () => {
        // Si se ha apartado a tiempo (dash), el golpe da en el aire.
        const now = target.critter.view;
        if (Math.hypot(now.x - unit.critter.view.x, now.y - unit.critter.view.y) > MELEE * 1.7) {
          this.fx.text("esquiva", { x: now.x, y: now.y }, 0xebe6da);
          return;
        }
        this.fx.impact(typeColor(move.type), { x: now.x, y: now.y });
        this.strike(unit, target, name, move, false);
      });
    } else {
      const travel = Math.hypot(foe.x - me.x, foe.y - me.y) / 200;
      this.maybeDodge(target, me);
      this.later(0.2, () => this.fx.projectile(typeColor(move.type), { x: me.x, y: me.y - 4 }, { x: foe.x, y: foe.y - 4 }, move.power >= 110 ? 4 : 3, travel));
      this.later(0.2 + travel, () => {
        this.fx.impact(typeColor(move.type), foe);
        // El proyectil va adonde estaba: si se ha movido lo bastante, no le da.
        const now = target.critter.view;
        if (Math.hypot(now.x - foe.x, now.y - foe.y) > 16) {
          this.fx.text("esquiva", { x: now.x, y: now.y }, 0xebe6da);
          return;
        }
        this.strike(unit, target, name, move, false);
      });
    }
    if (unit.target) unit.plan = this.choose(unit, unit.target); // ya va pensando el siguiente
  }

  private selfEffect(unit: Unit, move: Move): void {
    if (unit.fighter.hp <= 0) return;
    const at = { x: unit.critter.view.x, y: unit.critter.view.y - 8 };
    if (move.heal) {
      unit.heals++;
      unit.fighter.hp = Math.min(unit.fighter.stats.hp, unit.fighter.hp + Math.floor(unit.fighter.stats.hp * move.heal));
      unit.critter.setHp(unit.fighter.hp / unit.fighter.stats.hp);
      this.fx.sparkle(0x7fdc6a, at);
    } else if (move.boost) {
      for (const [key, amount] of Object.entries(move.boost) as [StatKey, number][]) {
        unit.fighter.stages[key] = Math.min(6, (unit.fighter.stages[key] ?? 0) + amount);
      }
      this.fx.sparkle(0xff7a5a, at);
    }
  }

  /** Un golpe llega a su víctima: se tiran los dados y se aplica el resultado. */
  private strike(attacker: Unit, victim: Unit, name: string, move: Move, spread: boolean): void {
    if (!this.active || victim.fighter.hp <= 0 || this.endTimer >= 0) return;
    const at = { x: victim.critter.view.x, y: victim.critter.view.y };
    const result = resolveAttack(attacker.fighter, victim.fighter, move, Math.random, spread);
    if (!result.hit) {
      this.fx.text("falló", at, 0x7a5a3e);
      return;
    }
    if (result.effectiveness === 0) {
      this.fx.text("no afecta", at, 0x7a5a3e);
      return;
    }
    victim.fighter.hp = Math.max(0, victim.fighter.hp - result.damage);
    victim.critter.setHp(victim.fighter.hp / victim.fighter.stats.hp);
    this.fx.text(String(result.damage), at, result.effectiveness > 1 ? 0xc8402f : result.effectiveness < 1 ? 0x7a5a3e : 0x3b2416);
    if (result.effectiveness > 1) this.fx.text("¡Muy eficaz!", { x: at.x, y: at.y - 9 }, 0xc8402f);
    else if (result.critical) this.fx.text("¡Crítico!", { x: at.x, y: at.y - 9 }, 0xb07d12);

    // Que se note el golpe: retrocede alejándose del atacante, parpadea, todo se congela un instante y la imagen tiembla.
    const hit: HitInfo = { damage: result.damage, maxHp: victim.fighter.stats.hp, effectiveness: result.effectiveness, critical: result.critical };
    const from = attacker.critter.view;
    const dx = at.x - from.x;
    const dy = at.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const force = knockback(hit) * (spread ? 0.7 : 1);
    victim.critter.hit((dx / len) * force, (dy / len) * force);
    victim.recover = Math.max(victim.recover, 0.2);
    victim.dash = 0; // un golpe corta el dash
    this.freeze = Math.max(this.freeze, hitstop(hit));
    this.hooks.shake(shake(hit));

    if (victim.fighter.hp > 0) {
      if (victim.busy <= 0) victim.critter.pose("Hurt", "Idle");
      return;
    }
    victim.critter.knockOut();
    this.hooks.log(`${attacker.name} derrota a ${victim.name} con ${name}.`);
    const alive = this.alive();
    if (alive.length <= 1) this.declare(alive[0] ?? attacker);
  }

  private declare(winner: Unit): void {
    this.winner = winner;
    this.endTimer = 2.5;
    winner.critter.stand();
  }

  private finish(winner: Unit | null): void {
    if (!this.active) return;
    this.active = false;
    this.endTimer = -1;
    this.pending = [];
    this.fx.clear();
    for (const unit of this.units) unit.critter.setControlled(false);
    this.units = [];
    this.hooks.end(winner?.critter ?? null);
  }
}
