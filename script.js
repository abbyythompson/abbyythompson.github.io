/* Three small jobs: glass the header once the page has moved, bring the cards
   in as they reach the viewport, and let the glass catch a highlight wherever
   the pointer is. The load sequence is pure CSS and lives in styles.css.

   Everything that moves is skipped outright when the reader has asked for less
   motion; the CSS ends up in the same finished state either way. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ----- Header ------------------------------------------------------- */

  const topbar = document.getElementById('topbar');

  if (topbar) {
    /* rAF-throttled: scroll fires far more often than the class can
       meaningfully change */
    let ticking = false;

    const update = function () {
      topbar.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }


  /* ----- Closing a case study ------------------------------------------
     The × in the masthead reads as a modal close, so escape has to do the same
     thing. Both are just a link back to the work, and neither exists on the
     home page. */

  const closer = document.querySelector('[data-case-close]');

  if (closer) {
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      window.location.href = closer.getAttribute('href');
    });
  }


  /* ----- Before and after ----------------------------------------------
     The range input under the artwork is the whole control: the browser gives
     it dragging, click to jump and the arrow keys, and all this does is copy
     its value onto the property the clip and the handle are drawn from. */

  document.querySelectorAll('[data-compare]').forEach(function (compare) {
    const range = compare.querySelector('.cs-compare-range');

    if (!range) return;

    const place = function () {
      compare.style.setProperty('--pos', range.value + '%');
    };

    range.addEventListener('input', place);

    /* Firefox restores the old value on a back navigation after the markup has
       been parsed, so the position is read rather than assumed */
    place();
  });


  /* ----- Carousel -------------------------------------------------------
     The scrolling is the browser's, snapping included. This adds the arrows,
     the dots and the caption, and reads the position back off the track rather
     than keeping its own idea of it, so a swipe and a button press cannot
     disagree about which slide is showing. */

  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = Array.prototype.slice.call(
      carousel.querySelectorAll('.cs-slide'));

    if (!track || slides.length < 2) return;

    const prev = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    const caption = carousel.querySelector('[data-carousel-caption]');
    const dotsBox = carousel.querySelector('[data-carousel-dots]');
    const behavior = reduced ? 'auto' : 'smooth';

    const at = function () {
      const width = track.clientWidth;
      if (!width) return 0;
      return Math.max(0, Math.min(slides.length - 1,
        Math.round(track.scrollLeft / width)));
    };

    const go = function (index) {
      track.scrollTo({ left: index * track.clientWidth, behavior: behavior });
    };

    const dots = slides.map(function (slide, index) {
      if (!dotsBox) return null;

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cs-carousel-dot';
      dot.setAttribute('aria-label', 'Go to image ' + (index + 1) +
        ' of ' + slides.length);
      dot.addEventListener('click', function () { go(index); });
      dotsBox.appendChild(dot);
      return dot;
    });

    let current = -1;

    const sync = function () {
      const index = at();

      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;

      /* Everything below rewrites the caption, which is announced, so it only
         runs when the slide has actually changed */
      if (index === current) return;
      current = index;

      dots.forEach(function (dot, i) {
        if (dot) dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });

      const text = slides[index].getAttribute('data-caption');
      if (caption && text) caption.textContent = text;
    };

    if (prev) prev.addEventListener('click', function () { go(at() - 1); });
    if (next) next.addEventListener('click', function () { go(at() + 1); });

    /* rAF-throttled for the same reason the header is: scroll fires far more
       often than the slide can change */
    let pending = false;

    track.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        sync();
      });
    }, { passive: true });

    /* A resize moves the snap points under the scroll position, so the reader
       is put back on the slide they were on */
    window.addEventListener('resize', function () {
      const index = current < 0 ? 0 : current;
      track.scrollLeft = index * track.clientWidth;
    });

    sync();
  });


  /* ----- Arriving on scroll --------------------------------------------
     The work cards on the home page and every block below the masthead of a
     case study come in the same way, so they ride one observer. */

  const cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  const arrivals = cards.concat(
    Array.prototype.slice.call(document.querySelectorAll('.reveal')));

  if (!arrivals.length) return;

  const show = function (el) { el.classList.add('is-in'); };

  if (reduced || !('IntersectionObserver' in window)) {
    arrivals.forEach(show);
  } else {
    let reported = false;

    /* Stagger is counted per batch rather than per card index, so a card that
       scrolls into view on its own arrives immediately instead of waiting out
       a delay it inherited from its position in the grid. */
    const observer = new IntersectionObserver(function (entries) {
      reported = true;

      let step = 0;

      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        observer.unobserve(el);
        setTimeout(function () { show(el); }, step * 90);
        step += 1;
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    arrivals.forEach(function (el) { observer.observe(el); });

    /* Safety net. The observer reports on every card the moment the document
       first renders, so this only ever fires when the page has not rendered at
       all: a background tab, a prerender, a headless screenshot. Those callbacks
       ride the rendering steps, and a hidden page never runs them.

       The work is the point of the page, so it is never allowed to sit at
       opacity 0 waiting for a callback that may not come. Nobody is watching
       when this path runs, so skipping the reveal costs nothing. */
    setTimeout(function () {
      if (reported) return;

      observer.disconnect();
      arrivals.forEach(show);
    }, 2000);
  }


  /* ----- The request stack --------------------------------------------
     Its layers drift on a loop that never ends, so the only thing left to
     decide is when it is worth running. This one keeps observing rather than
     unobserving on first sight: the point is to hand the class back when the
     stack scrolls away again, so the loop costs nothing while nobody is
     looking at it. The CSS pauses on the same class, so a browser without an
     observer just runs the loop, which is the old behaviour and is fine. */

  const stacks = document.querySelectorAll('.rq-stack');

  if (stacks.length && !reduced && 'IntersectionObserver' in window) {
    const live = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-live', entry.isIntersecting);
      });
    });

    Array.prototype.forEach.call(stacks, function (el) { live.observe(el); });
  }


  /* ----- Light on the glass -------------------------------------------
     The pointer writes two custom properties the ::after highlight reads, plus
     the angle of the card's edge gradient. That gradient is bright at both ends
     and dim through the middle, so turning it to face the cursor swings the two
     lit stretches of the border onto the axis the cursor is on.

     Placing and lighting happen in the same handler on purpose. Deferring the
     position to a rAF would let the class land a frame before the coordinates,
     and the glow would show up in the card's top left corner before jumping
     under the cursor. Browsers already coalesce pointermove to one event per
     frame, so there is nothing for a rAF to throttle here anyway. */

  if (reduced || !window.matchMedia('(hover: hover)').matches) return;

  cards.forEach(function (card) {
    card.addEventListener('pointermove', function (event) {
      if (event.pointerType !== 'mouse') return;

      /* One layout read, then only writes, so nothing thrashes */
      const box = card.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;

      card.style.setProperty('--gx', x.toFixed(1) + 'px');
      card.style.setProperty('--gy', y.toFixed(1) + 'px');

      /* The 90deg turn lines CSS gradient angles up with atan2's frame */
      const angle = Math.atan2(y - box.height / 2, x - box.width / 2);
      card.style.setProperty('--edge-angle',
        (angle * 180 / Math.PI + 90).toFixed(1) + 'deg');

      card.classList.add('is-lit');
    });

    card.addEventListener('pointerleave', function () {
      card.classList.remove('is-lit');
      /* Back to the resting angle in styles.css, swept there by the transition
         on --edge-angle rather than snapping */
      card.style.removeProperty('--edge-angle');
    });
  });
})();
