import { initializeDesignEffects } from "./design-effects.js";

let chartAnimation;
let motionContext;
let smoothScroll;
let scrollTicker;
let designCleanup;

export function resolveMotionPreference(saved, systemReduced = false) {
  return saved === "full" || saved === "reduced" ? saved : systemReduced ? "reduced" : "full";
}

function motionIsReduced() {
  return document.documentElement.dataset.motion === "reduced";
}

function animationToolsAreReady() {
  return Boolean(window.gsap && window.ScrollTrigger);
}

export function initializeMotion() {
  stopMotion();
  if (!animationToolsAreReady() || motionIsReduced()) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("motion-ready");

  motionContext = gsap.context(() => {
    initializeSmoothScroll(gsap, ScrollTrigger);
    animatePageEntrance(gsap);
    initializeScrollProgress(gsap);
    initializeSectionReveals(gsap);
    initializeHeroParallax(gsap);
    let refreshFrame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    observer.observe(document.querySelector("main"));
    return () => { observer.disconnect(); cancelAnimationFrame(refreshFrame); };
  });
  animateChartBars();
  designCleanup = initializeDesignEffects();
  ScrollTrigger.refresh();
}

function stopMotion() {
  designCleanup?.();
  designCleanup = null;
  chartAnimation?.revert();
  chartAnimation = null;
  motionContext?.revert();
  motionContext = null;
  // Timeline entrance and parallax can share targets. Remove their presentation
  // styles after reverting so a mid-animation toggle cannot leave text hidden.
  window.gsap?.set(".nav, .hero .eyebrow, .hero h1, .hero-copy, .hero .primary-button, .stats article, .hero-content, [data-reveal='up'], [data-reveal='stagger'] > *, .calendar-event-dialog, .command-palette, .calendar-timed-event, .calendar-all-day-event, .entry-card", { clearProps: "transform,opacity,visibility" });
  window.gsap?.set(".scroll-progress span", { clearProps: "transform" });
  if (scrollTicker) window.gsap?.ticker.remove(scrollTicker);
  scrollTicker = null;
  smoothScroll?.destroy();
  smoothScroll = null;
  document.documentElement.classList.remove("motion-ready");
}

export function animateContent(elements, { distance = 12, stagger = 0.035 } = {}) {
  if (!motionContext || motionIsReduced()) return;
  const targets = Array.from(elements?.length === undefined ? [elements] : elements).filter(Boolean);
  if (!targets.length) return;
  motionContext.add(() => {
    window.gsap.fromTo(targets, { y: distance, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.38, ease: "power3.out", stagger: { amount: Math.min(0.16, stagger * (targets.length - 1)) },
      overwrite: true, clearProps: "transform,opacity",
    });
  });
}

export function scrollToTop() {
  const focus = () => document.querySelector(".brand")?.focus({ preventScroll: true });
  if (smoothScroll && !motionIsReduced()) smoothScroll.scrollTo(0, { duration: 1.05, force: true, onComplete: focus });
  else { window.scrollTo({ top: 0, behavior: motionIsReduced() ? "instant" : "smooth" }); focus(); }
}

function initializeSmoothScroll(gsap, ScrollTrigger) {
  if (!window.Lenis || !window.matchMedia("(min-width: 761px) and (pointer: fine)").matches) return;

  smoothScroll = new window.Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 0.9,
    respectReducedMotion: false, // The app has already resolved system versus explicit preference.
    anchors: { offset: 108 },
  });

  smoothScroll.on("scroll", ScrollTrigger.update);
  scrollTicker = (time) => smoothScroll?.raf(time * 1000);
  gsap.ticker.add(scrollTicker);
  gsap.ticker.lagSmoothing(0);

}

function animatePageEntrance(gsap) {
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  timeline
    .fromTo(".nav", { y: -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.65 })
    .fromTo(".hero .eyebrow", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55 }, "-=0.25")
    .fromTo(".hero h1", { y: 44, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.85 }, "-=0.38")
    .fromTo(".hero-copy", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.62 }, "-=0.5")
    .fromTo(".hero .primary-button", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }, "-=0.4")
    .fromTo(".stats article", { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.09, duration: 0.55 }, "-=0.25");
}

function initializeScrollProgress(gsap) {
  gsap.to(".scroll-progress span", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: {
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.15,
    },
  });
}

function initializeSectionReveals(gsap) {
  gsap.utils.toArray("[data-reveal='up']").forEach((element) => {
    gsap.fromTo(element, { y: 28, autoAlpha: 0 }, {
      y: 0,
      autoAlpha: 1,
      duration: 0.75,
      ease: "power3.out",
      scrollTrigger: {
        trigger: element,
        start: "top 92%",
        toggleActions: "play none none reverse",
      },
    });
  });

  gsap.utils.toArray("[data-reveal='stagger']").forEach((container) => {
    gsap.fromTo(container.children, { y: 30, autoAlpha: 0 }, {
      y: 0,
      autoAlpha: 1,
      stagger: 0.1,
      duration: 0.65,
      ease: "power3.out",
      scrollTrigger: {
        trigger: container,
        start: "top 92%",
        toggleActions: "play none none reverse",
      },
    });
  });
}

function initializeHeroParallax(gsap) {
  const media = gsap.matchMedia();
  media.add("(min-width: 761px)", () => {
    gsap.to(".hero-content", {
      yPercent: 12,
      autoAlpha: 0.4,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.65,
      },
    });
  });
}

export function animateChartBars() {
  if (!animationToolsAreReady() || motionIsReduced()) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  chartAnimation?.revert();

  chartAnimation = gsap.fromTo(
    ".chart-bar",
    { scaleY: 0, transformOrigin: "bottom" },
    {
      scaleY: 1,
      duration: 0.7,
      stagger: 0.06,
      ease: "power3.out",
      overwrite: true,
      scrollTrigger: {
        trigger: ".chart-panel",
        start: "top 85%",
        once: true,
      },
    },
  );
}

