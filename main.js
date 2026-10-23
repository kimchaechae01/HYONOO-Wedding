// Moves .stage[data-state] along the beats defined in tokens.css.
// CSS owns every position and duration; this file only decides *when*.
(() => {
  const stage = document.querySelector(".stage");
  const scene = document.querySelector(".scene");
  const pauseButton = document.querySelector(".pause");
  if (!stage || !scene || !pauseButton) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let plan = [];      // [ms into the loop, state]
  let period = 0;     // one full loop, dissolve included
  let origin = 0;     // performance.now() at the start of the current loop
  let timer = 0;
  let pausedAt = null;

  const ms = (name) => parseFloat(getComputedStyle(stage).getPropertyValue(name)) || 0;

  // The calendar is authored at full-zoom size; until step 6 it is shrunk to card size.
  // scale = (card-size width) / (full-zoom width, 7.8 cells) — needs real pixels.
  function fit() {
    const { width, height } = stage.getBoundingClientRect();
    const envelopeWidth = Math.min(0.66 * width, 0.47 * height);
    const cell = 0.53 * width;
    const cardWidth = ms("--cal-card") * envelopeWidth;
    stage.style.setProperty("--cal-scale", (cardWidth / (7.8 * cell)).toFixed(4));
  }

  function buildPlan() {
    const lift = ms("--beat-lift");
    const loop = ms("--beat-loop");
    plan = [
      [0, "s1"],
      [ms("--beat-open"), "s2"],
      [lift - ms("--dur-peek"), "s3"],
      [lift, "s4a"],
      [lift + ms("--dur-lift"), "s4"],
      [ms("--beat-cover"), "s5"],
      [ms("--beat-zoom"), "s6"],
      [loop, "reset"],
    ];
    period = loop + ms("--dur-dissolve");
  }

  function setState(state) {
    if (stage.dataset.state !== state) stage.dataset.state = state;
  }

  // Jump to a state with no transition (tab return, reduced motion).
  function snap(state) {
    stage.classList.add("is-instant");
    setState(state);
    void stage.offsetWidth;
    stage.classList.remove("is-instant");
  }

  // Apply whichever step the clock is in, then sleep until the next one.
  function tick() {
    let elapsed = performance.now() - origin;
    if (elapsed >= period) {
      origin += Math.floor(elapsed / period) * period;
      elapsed = performance.now() - origin;
    }
    let current = plan[0];
    let nextAt = period;
    for (const step of plan) {
      if (step[0] <= elapsed) current = step;
      else {
        nextAt = step[0];
        break;
      }
    }
    setState(current[1]);
    timer = setTimeout(tick, Math.max(0, nextAt - elapsed));
  }

  function stop() {
    clearTimeout(timer);
  }

  // Only the reel's own transitions freeze — not the "tap to play" label fading in.
  function setPaused(paused) {
    const running = scene.getAnimations ? scene.getAnimations({ subtree: true }) : [];
    pauseButton.setAttribute("aria-pressed", String(paused));
    if (paused) {
      stop();
      pausedAt = performance.now();
      running.forEach((animation) => animation.pause());
    } else {
      origin += performance.now() - pausedAt;
      pausedAt = null;
      running.forEach((animation) => animation.play());
      tick();
    }
  }

  function start() {
    stop();
    pausedAt = null;
    pauseButton.setAttribute("aria-pressed", "false");
    if (reduceMotion.matches) {
      pauseButton.hidden = true;
      stage.classList.add("is-static");
      snap("s5");
      return;
    }
    pauseButton.hidden = false;
    stage.classList.remove("is-static");
    buildPlan();
    snap("s1");
    origin = performance.now();
    tick();
  }

  pauseButton.addEventListener("click", () => setPaused(pausedAt === null));

  document.addEventListener("visibilitychange", () => {
    if (pausedAt !== null) return; // a reel the guest paused stays paused
    if (document.hidden) stop();
    else start();
  });
  reduceMotion.addEventListener("change", start);

  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  else window.addEventListener("resize", fit);

  // Hold the first frame until the three faces are in, so nothing swaps mid-reel.
  const faces = ['400 1em "Pinyon Script"', '400 1em "Bodoni Moda"', '400 1em "Waiting for the Sunrise"'];
  const fontsIn = document.fonts
    ? Promise.all(faces.map((face) => document.fonts.load(face))).catch(() => {})
    : Promise.resolve();
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  Promise.race([fontsIn, timeout]).then(() => {
    stage.classList.add("is-ready");
    start();
  });
})();
