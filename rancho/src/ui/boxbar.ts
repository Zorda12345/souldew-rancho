// Barra superior para moverse de caja en caja: flechas, teclas ← → y desplegable.

export interface BoxInfo {
  name: string;
  label: string; // "Caja 2 de 4"
  count: number;
  capacity: number;
}

const STORAGE_KEY = "rancho.caja";

export interface BoxBar {
  /** Muestra en el letrero quién es el rey de una caja (null = nadie). */
  setKing(index: number, name: string | null): void;
}

export function createBoxBar(root: HTMLElement, boxes: BoxInfo[], onChange: (index: number, direction: number) => void): BoxBar {
  const button = (cls: string, text: string, label: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nav ${cls}`;
    b.textContent = text;
    b.setAttribute("aria-label", label);
    return b;
  };
  const prev = button("prev", "◀", "Caja anterior (flecha izquierda)");
  const next = button("next", "▶", "Caja siguiente (flecha derecha)");

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Elegir caja");
  boxes.forEach((box, i) => select.add(new Option(box.name, String(i))));

  const meta = document.createElement("span");
  meta.className = "meta";
  const info = document.createElement("div");
  info.className = "info";
  const count = document.createElement("span");
  count.className = "count";
  count.title = "Pokémon en la caja";
  const king = document.createElement("span");
  king.className = "king";
  info.append(select, meta, king, count);
  root.append(prev, info, next);

  let index = -1;
  const kings: (string | null)[] = boxes.map(() => null);
  const showKing = () => {
    const name = kings[index];
    king.textContent = name ? `♛ ${name}` : "";
    king.hidden = !name;
  };
  const go = (target: number, direction: number) => {
    const wrapped = (target + boxes.length) % boxes.length; // de la última se pasa a la primera
    if (wrapped === index) return;
    index = wrapped;
    const box = boxes[index];
    select.value = String(index);
    meta.textContent = box.label;
    count.textContent = `${box.count}/${box.capacity}`;
    showKing();
    try {
      localStorage.setItem(STORAGE_KEY, String(index)); // recordar para la próxima visita
    } catch {
      // Sin almacenamiento (modo privado estricto, por ejemplo): simplemente no se recuerda.
    }
    onChange(index, direction);
  };

  prev.addEventListener("click", () => go(index - 1, -1));
  next.addEventListener("click", () => go(index + 1, 1));
  select.addEventListener("change", () => {
    const target = Number(select.value);
    go(target, Math.sign(target - index));
  });
  window.addEventListener("keydown", (e) => {
    if (!root.checkVisibility()) return; // en otra pantalla (login, Soul Link) las flechas no tocan el rancho
    if (e.target instanceof HTMLSelectElement) return; // ahí las flechas ya cambian la opción
    if (document.querySelector("dialog[open]")) return; // con un panel abierto encima no se cambia de caja
    if (e.key === "ArrowLeft") go(index - 1, -1);
    if (e.key === "ArrowRight") go(index + 1, 1);
  });

  let saved = 0;
  try {
    saved = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    // Igual que arriba: se empieza por la primera.
  }
  go(saved >= 0 && saved < boxes.length ? Math.floor(saved) : 0, 0);

  return {
    setKing(i, name) {
      kings[i] = name;
      if (i === index) showKing();
    },
  };
}
