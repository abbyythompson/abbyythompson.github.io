/* ===========================================================================
   Abby Thompson, portfolio

   Everything that animates shares one requestAnimationFrame loop and writes a
   style only when the value it computed actually differs from the one already
   on the element. The blobs are large, blurred, screen-blended layers, so a
   redundant transform write is not free: it repaints a full-viewport layer.
   =========================================================================== */

'use strict';

const TAU = Math.PI * 2;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== Ticker ==============================================================
   One loop for the whole page. Two independent rAF loops meant two style
   flushes per frame; a single subscriber list means one. Tasks can ask for a
   lower frame rate, and a task with nothing left to do detaches itself so an
   idle page schedules no callbacks at all. */
const Ticker = (() => {
  const tasks = [];
  const FRAME_SLOP = 4; // ms, so a 30fps task is not skipped by float drift at 60Hz
  let frame = null;

  function loop(now) {
    frame = requestAnimationFrame(loop);
    // Backwards, so a task that detaches itself mid-render cannot make the
    // splice skip its neighbour
    for (let i = tasks.length - 1; i >= 0; i--) {
      const task = tasks[i];
      if (now - task.lastRun < task.minDelta) continue;
      task.lastRun = now;
      task.render(now);
    }
  }

  return {
    add(task) {
      if (tasks.includes(task)) return;
      task.lastRun = -Infinity;
      task.minDelta = task.fps ? 1000 / task.fps - FRAME_SLOP : 0;
      tasks.push(task);
      if (frame === null) frame = requestAnimationFrame(loop);
    },

    remove(task) {
      const index = tasks.indexOf(task);
      if (index === -1) return;
      tasks.splice(index, 1);
      if (tasks.length === 0 && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
})();

/* ===== Icons ===============================================================
   A Lucide-compatible renderer over the vendored icon subset in icons.js.
   The upstream CDN bundle is 417 KB of 2021 icons for the 19 this page draws,
   and it blocked the first paint from a third-party origin. */
const Icons = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const NAME_ATTR = 'data-lucide';
  const BASE_ATTRS = {
    xmlns: SVG_NS,
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };

  const set = (el, attrs) => {
    for (const key in attrs) el.setAttribute(key, String(attrs[key]));
  };

  const toPascalCase = (name) =>
    name.replace(/(^|-)([a-z])/g, (_match, _sep, char) => char.toUpperCase());

  function createElement(iconNode, attrs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    set(svg, { ...BASE_ATTRS, ...attrs });
    for (const [tag, childAttrs] of iconNode) {
      const child = document.createElementNS(SVG_NS, tag);
      set(child, childAttrs);
      svg.append(child);
    }
    return svg;
  }

  // Carries the placeholder's own attributes onto the svg, so class hooks like
  // .meta-icon and any aria-label survive the swap
  function replace(placeholder) {
    const name = placeholder.getAttribute(NAME_ATTR);
    const iconNode = window.lucideIcons?.[toPascalCase(name)];
    if (!iconNode) return;

    const own = {};
    for (const { name: key, value } of placeholder.attributes) own[key] = value;
    const labelled = 'aria-label' in own || 'aria-labelledby' in own;

    const attrs = { ...own, [NAME_ATTR]: name };
    if (!labelled) attrs['aria-hidden'] = 'true';
    attrs.class = ['lucide', `lucide-${name}`, placeholder.className].filter(Boolean).join(' ');

    placeholder.replaceWith(createElement(iconNode, attrs));
  }

  return {
    // Scoped by root: reskinning the modal should not rescan the whole document
    render(root = document) {
      root.querySelectorAll(`[${NAME_ATTR}]`).forEach(replace);
    },
    createElement,
    get(name) {
      return window.lucideIcons?.[name] ?? null;
    },
  };
})();

Icons.render();

/* ===== Navbar: live London clock ========================================== */
(function () {
  const timeEl = document.getElementById('local-time');
  if (!timeEl) return;

  const TICK_MS = 1000;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  let timer = null;

  function tick() {
    timeEl.textContent = formatter.format(new Date());
  }

  function start() {
    tick(); // resyncs immediately, so a backgrounded tab never shows a stale time
    if (timer === null) timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
})();

/* ===== Navbar: live London weather (Open-Meteo, no API key required) ====== */
(function () {
  let iconEl = document.getElementById('weather-icon');
  const textEl = document.getElementById('weather-text');
  if (!iconEl || !textEl) return;

  const LAT = 51.5074;
  const LON = -0.1278;
  const REFRESH_MS = 15 * 60 * 1000;
  const ENDPOINT =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&current=temperature_2m,weather_code,is_day&timezone=Europe%2FLondon';

  // WMO weather codes -> { icon: PascalCase icon name, night, label }
  const WEATHER_CODES = {
    0: { icon: 'Sun', night: 'Moon', label: 'Clear' },
    1: { icon: 'CloudSun', night: 'CloudMoon', label: 'Mostly clear' },
    2: { icon: 'CloudSun', night: 'CloudMoon', label: 'Partly cloudy' },
    3: { icon: 'Cloud', label: 'Overcast' },
    45: { icon: 'CloudFog', label: 'Foggy' },
    48: { icon: 'CloudFog', label: 'Foggy' },
    51: { icon: 'CloudDrizzle', label: 'Drizzle' },
    53: { icon: 'CloudDrizzle', label: 'Drizzle' },
    55: { icon: 'CloudDrizzle', label: 'Drizzle' },
    56: { icon: 'CloudDrizzle', label: 'Freezing drizzle' },
    57: { icon: 'CloudDrizzle', label: 'Freezing drizzle' },
    61: { icon: 'CloudRain', label: 'Rainy' },
    63: { icon: 'CloudRain', label: 'Rainy' },
    65: { icon: 'CloudRain', label: 'Rainy' },
    66: { icon: 'CloudRain', label: 'Freezing rain' },
    67: { icon: 'CloudRain', label: 'Freezing rain' },
    71: { icon: 'CloudSnow', label: 'Snowy' },
    73: { icon: 'CloudSnow', label: 'Snowy' },
    75: { icon: 'CloudSnow', label: 'Snowy' },
    77: { icon: 'CloudSnow', label: 'Snowy' },
    80: { icon: 'CloudRain', label: 'Rain showers' },
    81: { icon: 'CloudRain', label: 'Rain showers' },
    82: { icon: 'CloudRain', label: 'Rain showers' },
    85: { icon: 'CloudSnow', label: 'Snow showers' },
    86: { icon: 'CloudSnow', label: 'Snow showers' },
    95: { icon: 'CloudLightning', label: 'Stormy' },
    96: { icon: 'CloudLightning', label: 'Stormy' },
    99: { icon: 'CloudLightning', label: 'Stormy' },
  };
  const FALLBACK = { icon: 'Cloud', label: 'Cloudy' };

  let currentIcon = null; // London stays overcast for weeks, so most refreshes redraw nothing

  function setIcon(name) {
    if (name === currentIcon) return;
    const iconNode = Icons.get(name);
    if (!iconNode) return;

    const svg = Icons.createElement(iconNode, {
      class: 'lucide meta-icon',
      id: 'weather-icon',
      'aria-hidden': 'true',
    });
    iconEl.replaceWith(svg);
    iconEl = svg;
    currentIcon = name;
  }

  function resolveWeatherDisplay(code, isDay) {
    const info = WEATHER_CODES[code] || FALLBACK;
    return { iconName: !isDay && info.night ? info.night : info.icon, label: info.label };
  }

  async function refresh() {
    if (document.hidden) return; // no point spending a request on a tab nobody is looking at
    try {
      const res = await fetch(ENDPOINT);
      if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`);
      const { current } = await res.json();

      const { iconName, label } = resolveWeatherDisplay(current.weather_code, current.is_day === 1);
      setIcon(iconName);
      textEl.textContent = `${Math.round(current.temperature_2m)}° ${label}`;
    } catch {
      // leave the last known/default value in place on failure
    }
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();

/* ===== Hero headline: randomly rotates through mixed word pairs =========== */
(function () {
  const blankA = document.getElementById('blank-a');
  const blankB = document.getElementById('blank-b');
  if (!blankA || !blankB || REDUCED_MOTION) return;

  const WORDS_A = ['products', 'experiences', 'apps', 'B2B SaaS'];
  const WORDS_B = ['systems thinking', 'AI systems', 'integrated delight', 'data driven insights'];
  const TURN_INTERVAL = 3400; // time between swaps, alternating which blank changes
  const FADE_MS = 650;

  // Offsetting from the current index picks a different word in constant time,
  // rather than rerolling until the random draw happens to miss it
  function pickNext(list, current) {
    if (list.length <= 1) return list[0];
    const index = Math.max(list.indexOf(current), 0);
    const offset = 1 + Math.floor(Math.random() * (list.length - 1));
    return list[(index + offset) % list.length];
  }

  const blanks = [
    { el: blankA, words: WORDS_A, timer: null },
    { el: blankB, words: WORDS_B, timer: null },
  ];

  function swap(blank) {
    if (blank.timer !== null) return; // a throttled tab must not stack fades
    const next = pickNext(blank.words, blank.el.textContent);
    blank.el.classList.add('is-swapping');
    blank.timer = setTimeout(() => {
      blank.el.textContent = next;
      blank.el.classList.remove('is-swapping');
      blank.timer = null;
    }, FADE_MS);
  }

  let turn = 0;
  setInterval(() => swap(blanks[turn++ % blanks.length]), TURN_INTERVAL);
})();

/* ===== Glow fields ========================================================
   The anchored blobs drift and breathe behind the cursor light. They move
   slowly on purpose: a full 41 second drift covers 55px, so at 60fps the
   rendered position is unchanged for most frames. Running at 30fps and
   skipping writes that quantise to the same string keeps a full-viewport
   blurred layer from repainting for no visible gain. */
(function () {
  const els = Array.from(document.querySelectorAll('.glow-field .glow'));
  if (!els.length || REDUCED_MOTION) return;

  const BREATH = 0.045; // scale amplitude of the ambient breathing
  const FPS = 30;

  // The field runs the length of the document, so sleeping is per blob: only the
  // two or three blobs level with the viewport are ever animating
  const awake = new Map(); // element -> blob, so the observer is a lookup not a scan
  const blobs = els.map((el, i) => {
    const blob = {
      el,
      awake: true,
      // Drift is per blob rather than uniform, so an edge blob can slide along
      // its edge instead of wandering into the middle of the composition
      driftX: parseFloat(el.dataset.driftX) || 0,
      driftY: parseFloat(el.dataset.driftY) || 0,
      // Angular frequencies, precomputed: the loop should not redo the same
      // divide and TAU multiply for every blob on every frame
      rateX: TAU / (41 + (i % 5) * 13), // seconds per loop, offset so the drifts never line up
      rateY: TAU / (57 + (i % 7) * 9),
      rateBreath: TAU / (17 + (i % 4) * 5), // seconds per breath
      phase: i * 2.1,
      transform: '',
    };
    awake.set(el, blob);
    return blob;
  });

  const task = {
    fps: FPS,
    render(now) {
      const t = now / 1000;

      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        if (!blob.awake) continue;

        const x = Math.sin(t * blob.rateX + blob.phase) * blob.driftX;
        const y = Math.cos(t * blob.rateY + blob.phase) * blob.driftY;
        const breath = 1 + Math.sin(t * blob.rateBreath + blob.phase) * BREATH;

        const transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${breath.toFixed(3)})`;
        if (transform === blob.transform) continue;

        blob.transform = transform;
        blob.el.style.transform = transform;
      }
    },
  };

  function sync() {
    blobs.some((blob) => blob.awake) ? Ticker.add(task) : Ticker.remove(task);
  }

  Ticker.add(task);

  // The loop only runs while at least one blob is on screen. The margin wakes a
  // blob just before it scrolls in, so it is already mid-drift when it appears
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const blob = awake.get(entry.target);
          if (!blob) return;
          blob.awake = entry.isIntersecting;
          // Promote only what is moving: a dozen blurred, viewport-sized layers
          // held on the compositor at once is a lot of texture for no gain
          blob.el.style.willChange = blob.awake ? 'transform' : 'auto';
        });
        sync();
      },
      { threshold: 0, rootMargin: '20% 0px' }
    );
    els.forEach((el) => observer.observe(el));
  }
})();

/* ===== Cursor glow ========================================================
   One green light that spawns out of nothing wherever the pointer first appears
   and then trails it down the whole page. Each [data-cursor-glow] section holds
   its own copy of the layer, sharing one position in page coordinates: that
   keeps the light clipped to the section and painted under its content, rather
   than a single overlay that would wash across the cards and the footer text. */
(function () {
  const hosts = Array.from(document.querySelectorAll('[data-cursor-glow]'));
  if (!hosts.length) return;

  const HEAD = { stiffness: 0.035, damping: 0.82 }; // < 1 damping, so it drifts past and eases back
  // Trail copies. Weaker springs so they string out behind the head
  const GHOSTS = [
    { size: 0.72, alpha: 0.3, stiffness: 0.018, damping: 0.84 },
    { size: 0.5, alpha: 0.15, stiffness: 0.01, damping: 0.86 },
  ];
  const ALPHA = { dark: 0.65, light: 0.45 }; // the light sections need less, multiply reads stronger
  const LIFT_SPEED = 22;   // px per frame at which the light is at full brightness
  const LIFT_MAX = 0.22;   // how much opacity it gains while being dragged
  const LIFT_EASE = 0.08;  // how quickly the brightness catches up to the drag
  const CONTRACT = 0.42;   // it is a soft wash at rest and tightens into a light as it is dragged
  const BREATH = 0.045;
  const BREATH_RATE = TAU / 17;
  const SPAWN_MS = 620;    // time to grow in from nothing
  const FADE_MS = 340;     // time to shrink back once the cursor leaves the window
  const MAX_DT = 50;       // clamped, so a background tab cannot jump it
  const REST_DT = 16;

  // Nothing chases the pointer under reduced motion; the light just rests in the hero
  const fine = !REDUCED_MOTION && window.matchMedia('(pointer: fine)').matches;
  const specs = fine ? [null, ...GHOSTS] : [null]; // no trail without a real cursor

  const layers = hosts.map((host) => {
    const layer = document.createElement('div');
    layer.className = 'cursor-glow';
    layer.setAttribute('aria-hidden', 'true');

    const orbs = specs.map((spec) => {
      const el = document.createElement('span');
      el.className = spec ? 'cursor-orb cursor-orb--ghost' : 'cursor-orb';
      if (spec) el.style.setProperty('--ghost-size', spec.size);
      layer.append(el);
      return { el, w: 0, h: 0, transform: '', opacity: '' };
    });

    host.prepend(layer);
    return {
      host,
      orbs,
      alpha: ALPHA[host.dataset.cursorGlow] || ALPHA.dark,
      left: 0,
      top: 0,
      active: true,
    };
  });

  const layersByHost = new Map(layers.map((layer) => [layer.host, layer]));

  // One spring per orb, in page coordinates and shared by every layer
  const springs = specs.map((spec) => ({
    stiffness: spec ? spec.stiffness : HEAD.stiffness,
    damping: spec ? spec.damping : HEAD.damping,
    alpha: spec ? spec.alpha : null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));

  let clientX = null; // null until the cursor has been seen in this window
  let clientY = null;
  let spawn = 0;      // 0 at the cursor point, 1 at full size
  let lift = 0;
  let last = null;
  let running = false;
  let needsMeasure = true;
  // Cached rather than read per frame: window.scrollX during the write phase of
  // a frame forces the layout the other tasks just invalidated
  let scrollX = window.scrollX;
  let scrollY = window.scrollY;

  const present = () => clientX !== null;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  function measure() {
    scrollX = window.scrollX;
    scrollY = window.scrollY;
    layers.forEach((layer) => {
      const rect = layer.host.getBoundingClientRect();
      layer.left = rect.left + scrollX;
      layer.top = rect.top + scrollY;
      layer.orbs.forEach((orb) => {
        orb.w = orb.el.offsetWidth;
        orb.h = orb.el.offsetHeight;
      });
    });
    needsMeasure = false;
  }

  // Placing the springs rather than springing them there is what makes the light
  // appear out of the cursor instead of flying across the page to meet it
  function seed(pageX, pageY) {
    springs.forEach((spring) => {
      spring.x = pageX;
      spring.y = pageY;
      spring.vx = 0;
      spring.vy = 0;
    });
    spawn = 0;
    lift = 0;
  }

  function advanceSprings() {
    const targetX = clientX + scrollX;
    const targetY = clientY + scrollY;

    springs.forEach((spring) => {
      spring.vx = (spring.vx + (targetX - spring.x) * spring.stiffness) * spring.damping;
      spring.vy = (spring.vy + (targetY - spring.y) * spring.stiffness) * spring.damping;
      spring.x += spring.vx;
      spring.y += spring.vy;
    });

    // Brightens while it is being dragged, then fades back as it catches up
    const speed = Math.hypot(springs[0].vx, springs[0].vy);
    const targetLift = Math.min(speed / LIFT_SPEED, 1) * LIFT_MAX;
    lift += (targetLift - lift) * LIFT_EASE;
  }

  function paint(grow, scale, drag) {
    const scalePart = ` 0) scale(${scale.toFixed(3)})`;

    layers.forEach((layer) => {
      if (!layer.active) return;

      layer.orbs.forEach((orb, i) => {
        const spring = springs[i];
        const x = spring.x - layer.left - orb.w / 2;
        const y = spring.y - layer.top - orb.h / 2;
        // Head carries the base brightness, the trail only shows while the light is moving
        const alpha =
          spring.alpha === null
            ? (layer.alpha + lift) * grow
            : spring.alpha * (layer.alpha / ALPHA.dark) * drag * grow;

        const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px,${scalePart}`;
        const opacity = alpha.toFixed(3);

        // Skipping an identical write keeps a blurred, screen-blended,
        // viewport-sized layer from being handed back to the compositor
        if (transform !== orb.transform) {
          orb.transform = transform;
          orb.el.style.transform = transform;
        }
        if (opacity !== orb.opacity) {
          orb.opacity = opacity;
          orb.el.style.opacity = opacity;
        }
      });
    });
  }

  function render(now) {
    if (needsMeasure) measure();

    const dt = last === null ? REST_DT : Math.min(now - last, MAX_DT);
    last = now;

    const alive = present();
    spawn = Math.max(0, Math.min(1, spawn + (alive ? dt / SPAWN_MS : -dt / FADE_MS)));
    const grow = easeOut(spawn);

    if (alive) advanceSprings();

    const drag = lift / LIFT_MAX;
    const breath = 1 + Math.sin((now / 1000) * BREATH_RATE) * BREATH;
    paint(grow, grow * breath * (1 - CONTRACT * drag), drag);

    // Fully faded and no pointer to follow: nothing left to compute until one
    // shows up again, so give the frame back rather than spinning on zeroes
    if (!alive && spawn === 0) sync();
  }

  const task = { render };

  function sync() {
    const shouldRun = layers.some((layer) => layer.active) && (present() || spawn > 0);

    if (REDUCED_MOTION) {
      if (shouldRun) render(performance.now()); // one still frame, then nothing moves
      return;
    }
    if (shouldRun === running) return;

    running = shouldRun;
    if (shouldRun) {
      last = null;
      needsMeasure = true;
      Ticker.add(task);
    } else {
      Ticker.remove(task);
    }
  }

  function onPointerMove(e) {
    const first = !present();
    clientX = e.clientX;
    clientY = e.clientY;
    if (first) {
      seed(clientX + scrollX, clientY + scrollY);
      sync();
    }
  }

  function onPointerOut(e) {
    if (e.relatedTarget) return; // still inside the window, just crossing an element
    clientX = null;
    clientY = null;
  }

  if (fine) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
  }
  window.addEventListener(
    'scroll',
    () => {
      scrollX = window.scrollX;
      scrollY = window.scrollY;
    },
    { passive: true }
  );
  window.addEventListener('resize', () => {
    needsMeasure = true;
    sync();
  });

  // Without a cursor to follow there is nothing to spawn from, so the light simply
  // rests low in the hero, where it used to sit
  if (!fine) {
    const rect = hosts[0].getBoundingClientRect();
    seed(rect.left + scrollX + rect.width * 0.2, rect.top + scrollY + rect.height * 0.85);
    clientX = 0; // counts as present, so it grows in; the dead spring keeps it put
    clientY = 0;
    springs.forEach((spring) => (spring.stiffness = 0));
    if (REDUCED_MOTION) spawn = 1; // already full size, nothing to grow
  }

  // Only the sections on screen keep their copy of the light alive
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const layer = layersByHost.get(entry.target);
          if (!layer) return;

          layer.active = entry.isIntersecting;
          if (layer.active) return;
          layer.orbs.forEach((orb) => {
            orb.opacity = '0';
            orb.el.style.opacity = '0';
          });
        });
        sync();
      },
      { rootMargin: '10% 0px' }
    );
    layers.forEach((layer) => observer.observe(layer.host));
  }

  sync();
})();

/* ===== Case study modal: open/close, deep-linkable via #case-study-<slug> == */
(function () {
  const modal = document.getElementById('cs-modal');
  const content = document.getElementById('cs-modal-content');
  if (!modal || !content) return;

  const HASH_PREFIX = '#case-study-';
  let lastFocused = null;

  const isOpen = () => modal.classList.contains('is-open');

  function slugFromHash(hash) {
    return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
  }

  function openCaseStudy(slug, { pushHistory = true } = {}) {
    const template = document.getElementById(`case-study-${slug}`);
    if (!template) return false;

    // replaceChildren drops the old subtree in one pass, where innerHTML = ''
    // made the parser walk a string first
    content.replaceChildren(template.content.cloneNode(true));
    Icons.render(content);

    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cs-modal-open');
    modal.querySelector('.cs-modal-close')?.focus();

    if (pushHistory && window.location.hash !== `${HASH_PREFIX}${slug}`) {
      history.pushState({ caseStudy: slug }, '', `${HASH_PREFIX}${slug}`);
    }
    return true;
  }

  function closeCaseStudy({ updateHistory = true, restoreFocus = true } = {}) {
    if (!isOpen()) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cs-modal-open');

    if (updateHistory && slugFromHash(window.location.hash)) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
    if (restoreFocus && typeof lastFocused?.focus === 'function') lastFocused.focus();
  }

  // Resolves the in-page scroll target for a close control, e.g. the CTA's href="#contact"
  function getCloseScrollTarget(closer) {
    const href = closer.getAttribute('href');
    const isInPageLink = href && href.length > 1 && href.startsWith('#');
    return isInPageLink ? document.querySelector(href) : null;
  }

  // One delegated listener on the grid, rather than one per card
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.js-case-study-trigger');
    if (!trigger) return;
    e.preventDefault();
    openCaseStudy(trigger.dataset.caseStudy);
  });

  modal.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-cs-close]');
    if (!closer) return;
    e.preventDefault();

    const scrollTarget = getCloseScrollTarget(closer);
    closeCaseStudy({ restoreFocus: !scrollTarget });
    if (scrollTarget) {
      requestAnimationFrame(() => scrollTarget.scrollIntoView({ behavior: 'smooth' }));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeCaseStudy();
  });

  window.addEventListener('popstate', () => {
    const slug = slugFromHash(window.location.hash);
    if (slug) {
      openCaseStudy(slug, { pushHistory: false });
    } else {
      closeCaseStudy({ updateHistory: false });
    }
  });

  const initialSlug = slugFromHash(window.location.hash);
  if (initialSlug) openCaseStudy(initialSlug, { pushHistory: false });
})();

// The page runs dark end to end now, so the navbar keeps its dark blur throughout
// and no longer needs the light-section observer that used to watch .experience
