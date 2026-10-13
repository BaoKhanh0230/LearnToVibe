/* App-specific vanilla JS adaptations of React Bits BlurText, CountUp and
 * SpotlightCard. Upstream: David Haz, https://github.com/DavidHDev/react-bits.
 * License: src/vendor/react-bits-LICENSE.md. Vanta NET remains upstream code. */
const metrics = new Map();
const scriptLoads = new Map();
let active = false;

export function normalizeMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function updateMetric(element, value, fromZero = false) {
  if (!element) return;
  const target = normalizeMetric(value);
  element.dataset.metricValue = String(target);
  element.setAttribute("aria-label", String(target));
  const previous = metrics.get(element);
  previous?.tween?.kill();
  const state = { value: fromZero ? 0 : previous?.value ?? target, target };
  metrics.set(element, state);
  if (!active || !window.gsap || document.documentElement.dataset.motion === "reduced") {
    state.value = target;
    element.textContent = String(target);
    return;
  }
  state.tween = window.gsap.to(state, {
    value: target, duration: 0.9, ease: "power3.out",
    onUpdate: () => { element.textContent = String(Math.round(state.value)); },
    onComplete: () => { element.textContent = String(target); state.tween = null; },
  });
}

function loadScript(path) {
  if (scriptLoads.has(path)) return scriptLoads.get(path);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(path, import.meta.url).href;
    script.async = true;
    const timer = setTimeout(fail, 12000);
    function fail() { clearTimeout(timer); script.remove(); scriptLoads.delete(path); reject(new Error("Không tải được hiệu ứng.")); }
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.append(script);
  });
  scriptLoads.set(path, promise);
  return promise;
}

function initializeNetwork() {
  const host = document.querySelector("#page-background");
  if (!host) return () => {};
  const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)");
  let alive = true;
  let visible = host.getBoundingClientRect().bottom > 0 && host.getBoundingClientRect().top < window.innerHeight;
  let effect;
  let contextLostHandler;
  let pending = false;
  let failed = false;
  let generation = 0;

  function destroy() {
    generation++;
    if (effect) {
      const renderer = effect.renderer;
      renderer?.domElement.removeEventListener("webglcontextlost", contextLostHandler);
      effect.linesMesh?.geometry?.dispose();
      effect.linesMesh?.material?.dispose();
      effect.destroy();
      renderer?.dispose();
      renderer?.forceContextLoss();
      effect = null;
    }
    host.dataset.effect = "static";
  }
  const allowed = () => alive && visible && !document.hidden && desktop.matches && !failed;
  async function sync() {
    if (!allowed()) { destroy(); return; }
    if (effect || pending) return;
    pending = true;
    const version = generation;
    try {
      if (!window.THREE) await loadScript("./vendor/three.min.js");
      if (!window.VANTA?.NET) await loadScript("./vendor/vanta.net.min.js");
      if (!allowed() || version !== generation) return;
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) { failed = true; return; }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      effect = window.VANTA.NET({
        el: host, THREE: window.THREE, mouseControls: true, touchControls: false, gyroControls: false,
        minHeight: 100, minWidth: 100, points: 7, spacing: 17, maxDistance: 22,
        color: 0x416fba, backgroundColor: 0x0b1020, showDots: true,
        scale: Math.max(2, window.devicePixelRatio || 1), scaleMobile: 2,
      });
      if (!effect.renderer) { effect.destroy(); effect = null; failed = true; return; }
      contextLostHandler = () => { failed = true; destroy(); };
      effect.renderer.domElement.addEventListener("webglcontextlost", contextLostHandler);
      host.dataset.effect = "vanta";
    } catch { failed = true; destroy(); }
    finally {
      pending = false;
      if (alive && !effect && allowed() && version !== generation) sync();
    }
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { rootMargin: "80px" });
  observer.observe(host);
  document.addEventListener("visibilitychange", sync);
  desktop.addEventListener("change", sync);
  sync();
  return () => { alive = false; observer.disconnect(); document.removeEventListener("visibilitychange", sync); desktop.removeEventListener("change", sync); destroy(); };
}

function initializeSpotlights() {
  let card;
  let frame;
  let point;
  const finePointer = window.matchMedia("(pointer: fine)");
  function clear() { card?.classList.remove("spotlight-active"); card = null; }
  function paint() {
    frame = null;
    if (!card || !point) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${point.x - rect.left}px`);
    card.style.setProperty("--spot-y", `${point.y - rect.top}px`);
    card.classList.add("spotlight-active");
  }
  function move(event) {
    if (!finePointer.matches || event.pointerType === "touch") return;
    const target = event.target.closest?.("[data-spotlight]");
    if (target !== card) { clear(); card = target; }
    point = { x: event.clientX, y: event.clientY };
    if (card && !frame) frame = requestAnimationFrame(paint);
  }
  function focus(event) {
    const target = event.target.closest?.("[data-spotlight]");
    if (!target) return;
    clear(); card = target;
    const rect = target.getBoundingClientRect();
    point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    paint();
  }
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerleave", clear);
  document.addEventListener("focusin", focus);
  document.addEventListener("focusout", clear);
  return () => {
    document.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", clear);
    document.removeEventListener("focusin", focus); document.removeEventListener("focusout", clear);
    cancelAnimationFrame(frame); clear();
    document.querySelectorAll("[data-spotlight]").forEach(element => { element.style.removeProperty("--spot-x"); element.style.removeProperty("--spot-y"); });
  };
}

export function initializeDesignEffects() {
  active = true;
  const networkCleanup = initializeNetwork();
  const spotlightCleanup = initializeSpotlights();
  document.querySelectorAll("[data-count-up]").forEach(element => updateMetric(element, element.dataset.metricValue ?? element.textContent, true));
  const textTween = window.gsap?.fromTo(".hero-word", { filter: "blur(8px)", y: 12, opacity: 0 }, {
    filter: "blur(0px)", y: 0, opacity: 1, duration: 0.65, delay: 0.35, stagger: 0.08, ease: "power3.out", clearProps: "filter,transform,opacity",
  });
  return () => {
    active = false;
    networkCleanup(); spotlightCleanup(); textTween?.kill();
    window.gsap?.set(".hero-word", { clearProps: "filter,transform,opacity" });
    for (const [element, state] of metrics) {
      state.tween?.kill(); state.value = state.target; state.tween = null; element.textContent = String(state.target);
      if (!element.isConnected) metrics.delete(element);
    }
  };
}
