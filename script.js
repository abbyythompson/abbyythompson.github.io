// ===== Icons: render all Lucide icons on the page =====
if (window.lucide) {
  lucide.createIcons();
}

// ===== Navbar: live London clock =====
(function () {
  const timeEl = document.getElementById('local-time');
  if (!timeEl) return;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  function tick() {
    timeEl.textContent = formatter.format(new Date());
  }

  tick();
  setInterval(tick, 1000);
})();

// ===== Navbar: live London weather (Open-Meteo, no API key required) =====
(function () {
  let iconEl = document.getElementById('weather-icon');
  const textEl = document.getElementById('weather-text');
  if (!iconEl || !textEl || !window.lucide) return;

  const LAT = 51.5074;
  const LON = -0.1278;
  const REFRESH_MS = 15 * 60 * 1000;

  // WMO weather codes -> { icon: PascalCase Lucide icon name, label }
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

  function setIcon(name) {
    const iconNode = lucide.icons[name];
    if (!iconNode) return;
    const svg = lucide.createElement(iconNode);
    svg.setAttribute('class', 'lucide meta-icon');
    svg.id = 'weather-icon';
    iconEl.replaceWith(svg);
    iconEl = svg;
  }

  function resolveWeatherDisplay(code, isDay) {
    const info = WEATHER_CODES[code] || { icon: 'Cloud', label: 'Cloudy' };
    const iconName = !isDay && info.night ? info.night : info.icon;
    return { iconName, label: info.label };
  }

  async function refresh() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&timezone=Europe%2FLondon`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather fetch failed');
      const data = await res.json();
      const temp = Math.round(data.current.temperature_2m);
      const isDay = data.current.is_day === 1;
      const { iconName, label } = resolveWeatherDisplay(data.current.weather_code, isDay);

      setIcon(iconName);
      textEl.textContent = `${temp}° ${label}`;
    } catch (err) {
      // leave the last known/default value in place on failure
    }
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();

// ===== Hero headline: randomly rotates through mixed word pairs =====
(function () {
  const blankA = document.getElementById('blank-a');
  const blankB = document.getElementById('blank-b');
  if (!blankA || !blankB) return;

  const wordsA = ['products', 'experiences', 'apps', 'B2B SaaS'];
  const wordsB = ['systems thinking', 'AI systems', 'integrated delight', 'data driven insights'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const TURN_INTERVAL = 3400; // time between swaps, alternating which blank changes
  const FADE_MS = 650;

  function pickNext(list, current) {
    if (list.length <= 1) return list[0];
    let next;
    do {
      next = list[Math.floor(Math.random() * list.length)];
    } while (next === current);
    return next;
  }

  function swap(el, list) {
    const next = pickNext(list, el.textContent);
    el.classList.add('is-swapping');
    setTimeout(() => {
      el.textContent = next;
      el.classList.remove('is-swapping');
    }, FADE_MS);
  }

  let turn = 0;
  setInterval(() => {
    swap(turn % 2 === 0 ? blankA : blankB, turn % 2 === 0 ? wordsA : wordsB);
    turn++;
  }, TURN_INTERVAL);
})();

// ===== Case study modal: open/close, deep-linkable via #case-study-<slug> =====
(function () {
  const modal = document.getElementById('cs-modal');
  const content = document.getElementById('cs-modal-content');
  if (!modal || !content) return;

  const HASH_PREFIX = '#case-study-';
  let lastFocused = null;

  function slugFromHash(hash) {
    return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
  }

  function openCaseStudy(slug, { pushHistory = true } = {}) {
    const template = document.getElementById(`case-study-${slug}`);
    if (!template) return false;

    content.innerHTML = '';
    content.appendChild(template.content.cloneNode(true));
    if (window.lucide) lucide.createIcons();

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
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cs-modal-open');

    if (updateHistory && slugFromHash(window.location.hash)) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
    if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // Resolves the in-page scroll target for a close control, e.g. the CTA's href="#contact"
  function getCloseScrollTarget(closer) {
    const href = closer.getAttribute('href');
    const isInPageLink = href && href.length > 1 && href.startsWith('#');
    return isInPageLink ? document.querySelector(href) : null;
  }

  function bindCaseStudyTriggers() {
    document.querySelectorAll('.js-case-study-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openCaseStudy(trigger.dataset.caseStudy);
      });
    });
  }

  function bindModalCloseControls() {
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
  }

  function bindEscapeKey() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeCaseStudy();
    });
  }

  function bindHistoryNavigation() {
    window.addEventListener('popstate', () => {
      const slug = slugFromHash(window.location.hash);
      if (slug) {
        openCaseStudy(slug, { pushHistory: false });
      } else {
        closeCaseStudy({ updateHistory: false });
      }
    });
  }

  function openCaseStudyFromCurrentHash() {
    const initialSlug = slugFromHash(window.location.hash);
    if (initialSlug) openCaseStudy(initialSlug, { pushHistory: false });
  }

  bindCaseStudyTriggers();
  bindModalCloseControls();
  bindEscapeKey();
  bindHistoryNavigation();
  openCaseStudyFromCurrentHash();
})();

// ===== Sticky navbar: switches from dark-blur to light-blur over light sections =====
(function () {
  const topbar = document.querySelector('.topbar');
  const lightSection = document.querySelector('.experience');
  if (!topbar || !lightSection || !('IntersectionObserver' in window)) return;

  const navHeight = topbar.offsetHeight + 20; // fixed offset + approximate top gap
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        topbar.classList.toggle('topbar--light', entry.isIntersecting);
      });
    },
    { rootMargin: `-${navHeight}px 0px -95% 0px`, threshold: 0 }
  );
  observer.observe(lightSection);
})();
