let chartAnimation;

function motionIsReduced() {
  return document.documentElement.dataset.motion === "reduced";
}

function animationToolsAreReady() {
  return Boolean(window.gsap && window.ScrollTrigger);
}

export function initializeMotion() {
  if (!animationToolsAreReady() || motionIsReduced()) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("motion-ready");

  initializeSmoothScroll(gsap, ScrollTrigger);
  animatePageEntrance(gsap);
  initializeScrollProgress(gsap);
  initializeSectionReveals(gsap);
  initializeHeroParallax(gsap);
  animateChartBars();

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

function initializeSmoothScroll(gsap, ScrollTrigger) {
  if (!window.Lenis || !window.matchMedia("(min-width: 761px) and (pointer: fine)").matches) return;

  const lenis = new window.Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 0.9,
    anchors: { offset: 24 },
  });

  lenis.on("scroll", ScrollTrigger.update);
  const update = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(update);
  gsap.ticker.lagSmoothing(0);

}

function animatePageEntrance(gsap) {
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  timeline
    .from(".nav", { y: -18, autoAlpha: 0, duration: 0.65 })
    .from(".eyebrow", { y: 22, autoAlpha: 0, duration: 0.55 }, "-=0.25")
    .from(".hero h1", { y: 44, autoAlpha: 0, duration: 0.85 }, "-=0.38")
    .from(".hero-copy", { y: 24, autoAlpha: 0, duration: 0.62 }, "-=0.5")
    .from(".primary-button", { y: 18, autoAlpha: 0, duration: 0.5 }, "-=0.4")
    .from(".stats article", { y: 26, autoAlpha: 0, stagger: 0.09, duration: 0.55 }, "-=0.25");
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
    gsap.from(element, {
      y: 48,
      autoAlpha: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: element,
        start: "top 88%",
        once: true,
      },
    });
  });

  gsap.utils.toArray("[data-reveal='stagger']").forEach((container) => {
    gsap.from(container.children, {
      y: 30,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.65,
      ease: "power3.out",
      scrollTrigger: {
        trigger: container,
        start: "top 86%",
        once: true,
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
  chartAnimation?.scrollTrigger?.kill();
  chartAnimation?.kill();

  chartAnimation = gsap.fromTo(
    ".chart-bar",
    { scaleY: 0, transformOrigin: "bottom" },
    {
      scaleY: 1,
      duration: 0.7,
      stagger: 0.06,
      ease: "back.out(1.25)",
      overwrite: true,
      scrollTrigger: {
        trigger: ".chart-panel",
        start: "top 85%",
        once: true,
      },
    },
  );
}

