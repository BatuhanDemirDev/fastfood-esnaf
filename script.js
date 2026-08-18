/* ============================================================
   SOKAK USTASI — scroll-driven assembly engine
   No build tooling, no external assets besides GSAP/ScrollTrigger (CDN)
   and Google Fonts. All art is inline SVG / canvas / CSS.
   ============================================================ */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     Theme toggle (persisted, defaults to system preference)
  --------------------------------------------------------- */
  (function themeInit() {
    const stored = localStorage.getItem('ffe-theme');
    if (stored) root.setAttribute('data-theme', stored);
    const btn = document.getElementById('themeToggle');
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('ffe-theme', next);
      // scene is declared further down but this callback only ever runs on
      // click, long after the whole module has finished executing once.
      if (scene && scene.refreshColors) scene.refreshColors();
    });
  })();

  /* ---------------------------------------------------------
     Nav: scrolled state, mobile toggle, active section link
  --------------------------------------------------------- */
  (function navInit() {
    const nav = document.getElementById('siteNav');
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: (self) => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
      }
    });

    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    menuToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }));

    const navAnchors = document.querySelectorAll('[data-nav]');
    document.querySelectorAll('main > section[id]').forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return;
          navAnchors.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + section.id));
        }
      });
    });
  })();

  /* ---------------------------------------------------------
     Contact "open now" indicator (placeholder hours 10:00-02:00)
  --------------------------------------------------------- */
  (function statusInit() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (!dot || !text) return;
    const hour = new Date().getHours();
    const open = hour >= 10 || hour < 2;
    dot.classList.toggle('closed', !open);
    text.textContent = open
      ? 'Şu an açık olabilir — saatler örnektir'
      : 'Şu an kapalı olabilir — saatler örnektir';
  })();

  /* ---------------------------------------------------------
     Low-level SVG piece builder
  --------------------------------------------------------- */
  function makePiece(container, tag, attrs, data) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    el.classList.add('piece');
    for (const k in data) el.dataset[k] = data[k];
    container.appendChild(el);
    return el;
  }

  function scatterParticles(container, count, opts) {
    const {
      cx, cy, radius = 60, flatten = 0.55, uniformDisk = false,
      size = [3, 3], color = 'var(--red)', posStart = 0.6, posEnd = 0.9,
      distance = 300, rotateRange = 90
    } = opts;
    for (let i = 0; i < count; i++) {
      const angleFinal = Math.random() * Math.PI * 2;
      const rFinal = uniformDisk ? radius * Math.sqrt(Math.random()) : Math.random() * radius;
      const fx = cx + Math.cos(angleFinal) * rFinal;
      const fy = cy + Math.sin(angleFinal) * rFinal * flatten;
      const dirAngle = Math.random() * Math.PI * 2;
      const fromX = Math.cos(dirAngle) * distance;
      const fromY = Math.sin(dirAngle) * distance - distance * 0.2;
      const s = size[0] + Math.random() * (size[1] - size[0]);
      const pos = posStart + Math.random() * (posEnd - posStart);
      makePiece(container, 'circle', { cx: fx.toFixed(1), cy: fy.toFixed(1), r: s.toFixed(1), fill: color }, {
        fromX: fromX.toFixed(1), fromY: fromY.toFixed(1),
        fromRot: (Math.random() * rotateRange * 2 - rotateRange).toFixed(1),
        fromScale: '0', pos: pos.toFixed(3), origin: 'center'
      });
    }
  }

  function scatterFalling(container, count, opts) {
    const {
      originX, originY, landY, landX, spread = 6,
      color = '#FBF6EA', size = [2, 4], posStart = 0.2, posEnd = 0.4
    } = opts;
    for (let i = 0; i < count; i++) {
      const fx = landX[0] + Math.random() * (landX[1] - landX[0]);
      const fy = landY + (Math.random() * spread * 2 - spread);
      const s = size[0] + Math.random() * (size[1] - size[0]);
      const pos = posStart + Math.random() * (posEnd - posStart);
      makePiece(container, 'circle', { cx: fx.toFixed(1), cy: fy.toFixed(1), r: s.toFixed(1), fill: color }, {
        fromX: (originX - fx).toFixed(1), fromY: (originY - fy).toFixed(1),
        fromRot: (Math.random() * 60 - 30).toFixed(1),
        fromScale: '0.3', pos: pos.toFixed(3), origin: 'center'
      });
    }
  }

  function sawtoothCirclePath(cx, cy, rOuter, rInner, points) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  /* ---------------------------------------------------------
     Generic scroll-scrubbed assembly engine
  --------------------------------------------------------- */
  function buildTween(tl, piece, pos) {
    const type = piece.dataset.type || 'piece';
    const dur = parseFloat(piece.dataset.duration || '0.14');
    const origin = piece.dataset.origin || '50% 50%';
    gsap.set(piece, { transformOrigin: origin });

    if (type === 'draw') {
      const len = piece.getTotalLength();
      gsap.set(piece, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
      tl.to(piece, { strokeDashoffset: 0, duration: dur * 1.4, ease: 'power1.inOut' }, pos);
      return;
    }

    const hasTo = piece.dataset.toX !== undefined || piece.dataset.toY !== undefined || piece.dataset.toRot !== undefined;

    if (hasTo) {
      // Currently only the döner meat shavings use data-to-*: give that
      // throw a gravity-like accelerating ease so it reads as heavier,
      // falling meat rather than a generic tween (döner is the flagship
      // item section — this branch is safe to bias toward it specifically).
      const toX = parseFloat(piece.dataset.toX || 0);
      const toY = parseFloat(piece.dataset.toY || 0);
      const toRot = parseFloat(piece.dataset.toRot || 0);
      const toScale = parseFloat(piece.dataset.toScale || 1);
      const toOpacity = parseFloat(piece.dataset.toOpacity !== undefined ? piece.dataset.toOpacity : 1);
      tl.fromTo(piece,
        { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
        { x: toX, y: toY, rotate: toRot, scale: toScale, opacity: toOpacity, ease: 'power2.in', duration: dur },
        pos);
      return;
    }

    const fromX = parseFloat(piece.dataset.fromX || 0);
    const fromY = parseFloat(piece.dataset.fromY || 0);
    const fromRot = parseFloat(piece.dataset.fromRot || 0);
    const fromScale = piece.dataset.fromScale !== undefined ? parseFloat(piece.dataset.fromScale) : 0.5;
    tl.fromTo(piece,
      { x: fromX, y: fromY, rotate: fromRot, scale: fromScale, opacity: 0 },
      { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, ease: 'power2.out', duration: dur },
      pos);
    tl.to(piece, { scale: 1.06, duration: dur * 0.35 }, pos + dur * 0.95)
      .to(piece, { scale: 1, duration: dur * 0.35 }, pos + dur * 1.3);
  }

  function initAssembleSection(section, extra) {
    extra = extra || {};
    const pieces = section.querySelectorAll('.piece');
    const scrollLength = parseInt(section.dataset.scrollLength || '1500', 10);
    // Midground parallax target: the whole illustration wrapper (a level
    // above individual .piece transforms, giving genuine depth separation
    // from both the background blobs and the foreground assembly pieces).
    const illus = section.querySelector('.hero-illustration, .item-illustration');
    // Headline mask-reveal target (see .text-reveal in styles.css).
    const headingWrap = section.querySelector('.text-reveal');
    const heading = headingWrap ? headingWrap.firstElementChild : null;
    // Cinematic section-to-section wipes (see .section-wipe in styles.css).
    const wipeIn = section.querySelector('.wipe-in');
    const wipeOut = section.querySelector('.wipe-out');
    const parallaxMag = window.innerWidth < 760 ? 10 : 24;

    if (REDUCED) {
      pieces.forEach((p) => {
        if (p.dataset.type === 'draw') return;
        const hasTo = p.dataset.toX !== undefined || p.dataset.toY !== undefined || p.dataset.toRot !== undefined;
        if (hasTo) {
          gsap.set(p, {
            x: p.dataset.toX || 0, y: p.dataset.toY || 0, rotate: p.dataset.toRot || 0,
            scale: p.dataset.toScale || 1, opacity: p.dataset.toOpacity !== undefined ? p.dataset.toOpacity : 1
          });
        } else {
          gsap.set(p, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
        }
      });
      // Headings/wipes are left at their CSS defaults (heading fully
      // visible, wipe panels opacity:0) — nothing to do here, that default
      // *is* the correct reduced-motion end state.
      return null;
    }

    const stConfig = {
      trigger: section,
      start: 'top top',
      end: '+=' + scrollLength,
      scrub: 0.6,
      pin: true,
      anticipatePin: 1,
      pinSpacing: true,
      onUpdate(self) {
        if (extra.onUpdate) extra.onUpdate(self);
        if (illus) {
          const p = self.progress;
          gsap.set(illus, {
            y: (p - 0.5) * -parallaxMag,
            scale: 1 + Math.sin(Math.PI * p) * 0.016
          });
        }
      }
    };

    const tl = gsap.timeline({ scrollTrigger: stConfig });

    if (heading) {
      // Deliberately NOT part of the scrubbed pin timeline `tl`: that timeline
      // only advances once the user scrolls *into* the pin, so at rest
      // (progress 0 — which is the page's actual load state for the hero,
      // since it's already pinned at "top top" with nothing scrolled yet)
      // the heading would stay hidden until the visitor started scrolling.
      // A separate one-shot ScrollTrigger reveals it as soon as the section
      // is on screen (immediately, for the hero) and never re-hides it.
      gsap.set(heading, { yPercent: 105, opacity: 0 });
      gsap.to(heading, {
        yPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 85%', toggleActions: 'play none none none' }
      });
    }
    if (wipeIn) {
      gsap.set(wipeIn, { xPercent: 0, opacity: 1 });
      tl.to(wipeIn, { xPercent: -112, duration: 0.1, ease: 'power2.inOut' }, 0)
        .set(wipeIn, { opacity: 0 }, 0.1);
    }
    if (wipeOut) {
      gsap.set(wipeOut, { xPercent: 112, opacity: 0 });
      tl.set(wipeOut, { opacity: 1 }, 0.84)
        .to(wipeOut, { xPercent: 0, duration: 0.12, ease: 'power2.inOut' }, 0.84);
    }

    pieces.forEach((piece, i) => {
      const pos = piece.dataset.pos !== undefined ? parseFloat(piece.dataset.pos) : i * 0.06;
      buildTween(tl, piece, pos);
    });

    return tl;
  }

  /* ---------------------------------------------------------
     Scroll-driven scene backdrop (.bg-scene blobs)
     Each item section already scrubs its own ScrollTrigger via
     initAssembleSection; we piggyback its onUpdate to crossfade a
     themed glow layer in/out (sin(pi*progress): 0 at the pin's start
     and end, peak at its middle) and drift every blob at its own
     --depth on plain page scroll for a cheap parallax layer.
  --------------------------------------------------------- */
  const bgScene = document.getElementById('bgScene');

  const scene = (function () {
    const blobs = {
      hero: document.querySelector('.bg-blob--hero'),
      patates: document.querySelector('.bg-blob--patates'),
      doner: document.querySelector('.bg-blob--doner'),
      pizza: document.querySelector('.bg-blob--pizza'),
      burger: document.querySelector('.bg-blob--burger'),
      kola: document.querySelector('.bg-blob--kola')
    };
    const MAX = { hero: 0.16, patates: 0.24, doner: 0.26, pizza: 0.22, burger: 0.22, kola: 0.28 };

    /* -------------------------------------------------------
       Continuous background morph (charcoal -> mustard-lit ->
       ember-red -> oven-warm -> grease-kraft -> cool teal).
       Colors are resolved from the *current* theme's own tokens
       at runtime (via a hidden probe element + getComputedStyle),
       never hardcoded — so this is automatically correct in both
       [data-theme="light"] and the OS-preference dark default,
       and re-resolves itself on theme toggle (see themeInit above).
    ------------------------------------------------------- */
    const order = ['hero', 'patates', 'doner', 'pizza', 'burger', 'kola'];
    let stops = null;
    let lastKey = 'hero';
    let lastProgress = 0;

    function resolveRgb(varName) {
      const probe = resolveRgb._probe || (resolveRgb._probe = (() => {
        const el = document.createElement('span');
        el.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;';
        document.body.appendChild(el);
        return el;
      })());
      probe.style.color = 'var(' + varName + ')';
      const rgb = getComputedStyle(probe).color;
      const m = (rgb.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
      return { r: m[0] || 0, g: m[1] || 0, b: m[2] || 0 };
    }

    // Mixes a base token with one or two accent tokens at low weights
    // (kept subtle so body text on --text stays readable throughout).
    function mixColors(baseVar, layers) {
      const base = resolveRgb(baseVar);
      let totalAmt = 0;
      layers.forEach((l) => { totalAmt += l[1]; });
      const baseAmt = Math.max(0, 1 - totalAmt);
      const out = { r: base.r * baseAmt, g: base.g * baseAmt, b: base.b * baseAmt };
      layers.forEach((l) => {
        const c = resolveRgb(l[0]);
        out.r += c.r * l[1]; out.g += c.g * l[1]; out.b += c.b * l[1];
      });
      return out;
    }

    function computeStops() {
      stops = {
        hero: resolveRgb('--bg'),
        patates: mixColors('--bg', [['--mustard-light', 0.16]]),
        doner: mixColors('--bg', [['--red-deep', 0.18]]),
        pizza: mixColors('--bg', [['--red-deep', 0.09], ['--mustard', 0.09]]),
        burger: mixColors('--bg', [['--kraft-dark', 0.16]]),
        kola: mixColors('--bg', [['--status-open', 0.18]])
      };
    }
    computeStops();

    function lerpC(c1, c2, t) {
      return { r: c1.r + (c2.r - c1.r) * t, g: c1.g + (c2.g - c1.g) * t, b: c1.b + (c2.b - c1.b) * t };
    }
    function rgbStr(c) {
      return 'rgb(' + c.r.toFixed(0) + ', ' + c.g.toFixed(0) + ', ' + c.b.toFixed(0) + ')';
    }

    // Each pinned section morphs FROM its own stop TO the next item's stop
    // across its own local progress (0->1), so the color is exactly
    // continuous at every pin handoff: end-of-N == start-of-(N+1).
    function applyBg(key, progress) {
      if (!bgScene || !stops || !stops[key]) return;
      const idx = order.indexOf(key);
      if (idx === -1) return;
      const toKey = order[idx + 1] || key;
      const t = Math.min(Math.max(progress, 0), 1);
      bgScene.style.setProperty('--scene-bg', rgbStr(lerpC(stops[key], stops[toKey], t)));
    }
    applyBg('hero', 0);

    function setActive(key, progress) {
      const p = Math.min(Math.max(progress, 0), 1);
      const level = Math.sin(Math.PI * p);
      for (const k in blobs) {
        if (!blobs[k]) continue;
        gsap.set(blobs[k], { opacity: k === key ? level * MAX[key] : 0 });
      }
      if (blobs.pizza) blobs.pizza.classList.toggle('spinning', key === 'pizza' && p > 0.02 && p < 0.98);
      lastKey = key; lastProgress = p;
      applyBg(key, p);
    }

    if (!REDUCED) {
      gsap.set(blobs.hero, { opacity: 0.12 });
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          for (const k in blobs) {
            const el = blobs[k];
            if (!el) continue;
            const depth = parseFloat(el.dataset.depth || '0.05');
            gsap.set(el, { y: -y * depth });
          }
          ticking = false;
        });
      }, { passive: true });
    }

    return {
      setActive,
      refreshColors() { computeStops(); applyBg(lastKey, lastProgress); }
    };
  })();

  /* ---------------------------------------------------------
     HERO
  --------------------------------------------------------- */
  (function heroInit() {
    const particles = document.getElementById('heroParticles');
    scatterParticles(particles, 12, {
      cx: 600, cy: 480, radius: 150, flatten: 0.5,
      size: [2.5, 4], color: 'var(--red)', posStart: 0.66, posEnd: 0.88, distance: 260
    });
    scatterParticles(particles, 9, {
      cx: 600, cy: 500, radius: 160, flatten: 0.5,
      size: [2, 3], color: 'var(--green-dark)', posStart: 0.7, posEnd: 0.92, distance: 240
    });

    const badgePath = document.getElementById('stampPath');
    const p1 = document.createElementNS(SVG_NS, 'path');
    p1.setAttribute('d', sawtoothCirclePath(80, 80, 76, 66, 20));
    p1.setAttribute('fill', 'var(--mustard)');
    p1.setAttribute('stroke', 'var(--ink)');
    p1.setAttribute('stroke-width', '3');
    badgePath.appendChild(p1);
    const p2 = document.createElementNS(SVG_NS, 'circle');
    p2.setAttribute('cx', '80'); p2.setAttribute('cy', '80'); p2.setAttribute('r', '58');
    p2.setAttribute('fill', 'none'); p2.setAttribute('stroke', 'var(--ink)'); p2.setAttribute('stroke-width', '2');
    badgePath.appendChild(p2);

    initAssembleSection(document.getElementById('hero'), {
      onUpdate(self) { scene.setActive('hero', self.progress); }
    });

    if (!REDUCED) {
      gsap.to('.steam', {
        y: -50, opacity: 0.015, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut',
        stagger: { each: 0.9, from: 'random' }
      });
      gsap.to('#stampBadge', { rotate: -6, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%' });
    }
  })();

  /* ---------------------------------------------------------
     PATATES (fries)
  --------------------------------------------------------- */
  (function friesInit() {
    scatterFalling(document.getElementById('saltParticles'), 30, {
      originX: 390, originY: 105, landY: 335, landX: [280, 520], spread: 22,
      color: '#FBF6EA', size: [1.6, 3.2], posStart: 0.24, posEnd: 0.42
    });
    initAssembleSection(document.getElementById('patates'), {
      onUpdate(self) { scene.setActive('patates', self.progress); }
    });
  })();

  /* ---------------------------------------------------------
     DÖNER
  --------------------------------------------------------- */
  (function donerInit() {
    // ---------------------------------------------------------------
    // DÖNER is the flagship item section: it gets the richest, most
    // scroll-reactive treatment on the site (sizzle canvas, dual sheen
    // highlights, knife glint, heavier shaving throws) rather than the
    // same token gesture as patates/pizza/burger/kola.
    // ---------------------------------------------------------------
    const section = document.getElementById('doner');
    const counter = document.querySelector('.doner-counter-text');
    const coneShine = document.getElementById('coneShine');
    const coneShine2 = document.getElementById('coneShine2');
    const knifeGlint = document.getElementById('knifeGlint');
    const photo = document.getElementById('donerPhoto');

    // heat: 0 at pin start, ramps to 1 by ~30% scroll and *stays* there —
    // döner should read as sustained-sizzling through "DİLİMLENİYOR" and
    // still glistening at "HAZIR", not fade back out like the bg blobs do.
    // Shared by the sizzle-canvas closure below — no accessor indirection
    // needed since sizzleCanvas() is defined in this same function scope.
    let heat = 0;

    initAssembleSection(section, {
      onUpdate(self) {
        scene.setActive('doner', self.progress);
        const p = self.progress;
        heat = Math.min(1, p / 0.3);
        if (coneShine) gsap.set(coneShine, { opacity: 0.07 + heat * 0.16 });
        if (coneShine2) gsap.set(coneShine2, { opacity: heat * 0.14 });
        if (knifeGlint) gsap.set(knifeGlint, { opacity: 0.15 + heat * 0.55 });
        // Slow Ken Burns pan across the whole pin, independent of the
        // photo's own one-shot entrance tween (that only ever touches
        // scale/opacity — from/to x and y are both 0 — so writing x/y
        // here every frame doesn't fight it).
        if (photo) gsap.set(photo, { x: (p - 0.5) * -16, y: (p - 0.5) * 12 });
        if (!counter) return;
        if (p < 0.15) counter.textContent = 'ISINIYOR…';
        else if (p < 0.65) counter.textContent = 'DİLİMLENİYOR…';
        else counter.textContent = 'HAZIR! AFİYET OLSUN';
      }
    });

    if (!REDUCED) {
      gsap.to('#coneShine', { x: 140, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('#coneShine2', { x: -140, duration: 3.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('#meatCone', { scaleX: 0.965, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%' });
      document.querySelectorAll('.flame-flecks path').forEach((p, i) => {
        gsap.to(p, { opacity: 0.45, y: -4, duration: 0.5 + Math.random() * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.15 });
      });
      // Knife glint sparkle — fast flicker layered on top of the
      // progress-driven base opacity set in onUpdate above.
      if (knifeGlint) {
        gsap.to(knifeGlint, { attr: { 'stroke-width': 3.4 }, duration: 0.18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
    }

    /* -------------------------------------------------------------
       Sizzle canvas: fake "video background" for the döner pin.
       Three cheap layers, all scaling with `heat`:
       - heat-shimmer bands (a handful of translucent warm strips with
         sinusoidal x-jitter — no per-pixel distortion/feTurbulence)
       - embers (radial-gradient glow, count+speed scale with heat)
       - smoke wisps (soft, slow, low-alpha, thicken with heat)
       Gated by IntersectionObserver so the flagship treatment doesn't
       cost anything once the user has scrolled past döner.
    ------------------------------------------------------------- */
    (function sizzleCanvas() {
      const canvas = document.getElementById('doner-heat-canvas');
      if (!canvas || REDUCED) return;
      const ctx = canvas.getContext('2d');
      let w, h, embers = [], smoke = [];

      function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        w = canvas.width = Math.max(1, Math.round(rect.width));
        h = canvas.height = Math.max(1, Math.round(rect.height));
      }
      function spawnEmber() {
        return {
          x: w * 0.32 + Math.random() * w * 0.36,
          y: h * 0.5 + Math.random() * h * 0.3,
          vy: -(0.5 + Math.random() * 1.1),
          vx: (Math.random() - 0.5) * 0.5,
          r: 1.2 + Math.random() * 2.4,
          seed: Math.random() * 100,
          life: Math.random() * 60,
          maxLife: 50 + Math.random() * 70
        };
      }
      function spawnSmoke() {
        return {
          x: w * 0.3 + Math.random() * w * 0.4,
          y: h * 0.45 + Math.random() * h * 0.25,
          vy: -(0.15 + Math.random() * 0.25),
          vx: (Math.random() - 0.5) * 0.15,
          r: 14 + Math.random() * 22,
          life: Math.random() * 140,
          maxLife: 120 + Math.random() * 100
        };
      }
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('load', resize);

      let tabVisible = true;
      document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; });

      let inView = false;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((e) => { inView = e.isIntersecting; });
        }, { rootMargin: '200px' }).observe(section);
      } else {
        inView = true;
      }

      function tick(now) {
        requestAnimationFrame(tick);
        if (!tabVisible || !inView) return;
        ctx.clearRect(0, 0, w, h);
        if (heat <= 0.015) return;

        // heat-shimmer bands
        const bandCount = 6;
        for (let i = 0; i < bandCount; i++) {
          const by = h * 0.42 + (h * 0.4 * i) / bandCount;
          const jitter = Math.sin(now * 0.0018 + i * 1.3) * 6 * heat;
          ctx.fillStyle = 'rgba(242, 169, 59, ' + (0.035 * heat).toFixed(3) + ')';
          ctx.fillRect(jitter - 4, by, w + 8, h * 0.4 / bandCount + 2);
        }

        // smoke wisps (thicken with heat)
        const smokeTarget = Math.round(2 + heat * 9);
        while (smoke.length < smokeTarget) smoke.push(spawnSmoke());
        if (smoke.length > smokeTarget) smoke.length = smokeTarget;
        smoke.forEach((s) => {
          s.x += s.vx; s.y += s.vy * (0.7 + heat * 0.6); s.life++;
          const t = s.life / s.maxLife;
          const alpha = Math.sin(Math.PI * Math.min(t, 1)) * 0.1 * heat;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
          g.addColorStop(0, 'rgba(90, 74, 58, ' + alpha.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(90, 74, 58, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
          if (t >= 1) Object.assign(s, spawnSmoke());
        });

        // embers (glow, count + speed scale with heat)
        const emberTarget = Math.round(8 + heat * 40);
        while (embers.length < emberTarget) embers.push(spawnEmber());
        if (embers.length > emberTarget) embers.length = emberTarget;
        embers.forEach((e) => {
          e.x += e.vx * (0.6 + heat); e.y += e.vy * (0.6 + heat * 1.5); e.life++;
          const t = e.life / e.maxLife;
          const twinkle = 0.6 + 0.4 * Math.sin(now * 0.01 + e.seed);
          const alpha = Math.sin(Math.PI * Math.min(t, 1)) * (0.3 + heat * 0.5) * twinkle;
          const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
          g.addColorStop(0, 'rgba(255, 210, 130, ' + alpha.toFixed(3) + ')');
          g.addColorStop(0.4, 'rgba(242, 169, 59, ' + (alpha * 0.6).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(225, 78, 44, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2); ctx.fill();
          if (t >= 1) Object.assign(e, spawnEmber());
        });
      }
      requestAnimationFrame(tick);
    })();
  })();

  /* ---------------------------------------------------------
     PIZZA
  --------------------------------------------------------- */
  (function pizzaInit() {
    // The pizza is now one real overhead photo (see index.html) with its
    // own pepperoni/cheese/herbs already baked in, so there's no separate
    // vector or photo pepperoni layer scattered on top of it anymore —
    // that would just double up toppings the photo already shows. Herb
    // flecks stay as a light vector accent since they read fine at this
    // tiny size and complement rather than duplicate the photo's basil.
    scatterParticles(document.getElementById('pizzaHerbs'), 16, {
      cx: 400, cy: 400, radius: 210, flatten: 1, uniformDisk: true,
      size: [2, 3.5], color: 'var(--green-dark)', posStart: 0.76, posEnd: 0.92, distance: 200
    });

    const tl = initAssembleSection(document.getElementById('pizza'), {
      onUpdate(self) { scene.setActive('pizza', self.progress); }
    });
    if (tl) tl.to('#pizzaGroup', { rotate: '+=380', duration: 0.16, ease: 'power1.inOut' }, 0.88);
  })();

  /* ---------------------------------------------------------
     BURGER
  --------------------------------------------------------- */
  (function burgerInit() {
    scatterFalling(document.getElementById('pickleParticles'), 5, {
      originX: 350, originY: 640, landY: 660, landX: [260, 440], spread: 6,
      color: 'var(--green)', size: [5, 7], posStart: 0.5, posEnd: 0.56
    });
    scatterFalling(document.getElementById('sesameParticles'), 16, {
      originX: 350, originY: 400, landY: 505, landX: [220, 480], spread: 30,
      color: '#F4E9D8', size: [3, 4.5], posStart: 0.66, posEnd: 0.78
    });
    initAssembleSection(document.getElementById('burger'), {
      onUpdate(self) { scene.setActive('burger', self.progress); }
    });
  })();

  /* ---------------------------------------------------------
     KOLA
  --------------------------------------------------------- */
  (function kolaInit() {
    const iceGroup = document.getElementById('iceGroup');
    const icePositions = [[205, 420], [265, 470], [230, 560], [290, 610], [250, 350]];
    icePositions.forEach((pos, i) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.classList.add('piece');
      g.dataset.fromY = -520 - i * 20;
      g.dataset.fromRot = (Math.random() * 200 - 100).toFixed(0);
      g.dataset.fromScale = '0.6';
      g.dataset.pos = (0.32 + i * 0.045).toFixed(3);
      g.dataset.origin = 'center';
      // real cropped/background-removed ice cube photo (desaturated to
      // pull the drink's blue tint back to clear) instead of a flat-color
      // rounded-rect + gloss line
      const img = document.createElementNS(SVG_NS, 'image');
      img.setAttribute('href', 'assets/photos/kola/ice.png');
      img.setAttribute('x', pos[0]); img.setAttribute('y', pos[1]);
      img.setAttribute('width', '32'); img.setAttribute('height', '32');
      img.setAttribute('opacity', '0.94');
      g.appendChild(img);
      iceGroup.appendChild(g);
    });

    scatterParticles(document.getElementById('dropletParticles'), 10, {
      cx: 250, cy: 480, radius: 90, flatten: 2.2,
      size: [3, 5], color: 'var(--surface)', posStart: 0.62, posEnd: 0.84, distance: 30
    });

    const bubbleGroup = document.getElementById('bubbleGroup');
    const bubbles = [];
    for (let i = 0; i < 8; i++) {
      const b = document.createElementNS(SVG_NS, 'circle');
      const bx = 190 + Math.random() * 120;
      b.setAttribute('cx', bx); b.setAttribute('cy', 750); b.setAttribute('r', 3 + Math.random() * 3);
      b.setAttribute('fill', '#ffffff'); b.setAttribute('opacity', '0');
      bubbleGroup.appendChild(b);
      bubbles.push(b);
    }
    let bubblesTl = null;
    if (!REDUCED) {
      bubblesTl = gsap.timeline({ paused: true, repeat: -1 });
      bubbles.forEach((b, i) => {
        bubblesTl.fromTo(b, { attr: { cy: 750 }, opacity: 0 },
          { attr: { cy: 280 }, opacity: 0.8, duration: 2.4, ease: 'sine.out' }, i * 0.35)
          .to(b, { opacity: 0, duration: 0.3 }, i * 0.35 + 2.1);
      });
    }

    const tl = initAssembleSection(document.getElementById('kola'), {
      onUpdate(self) {
        scene.setActive('kola', self.progress);
        if (bubblesTl) { if (self.progress > 0.5) bubblesTl.play(); else bubblesTl.pause(0); }
      }
    });
    if (tl) {
      tl.fromTo('#kolaFill', { attr: { height: 0, y: 760 } },
        { attr: { height: 480, y: 280 }, duration: 0.46, ease: 'power1.inOut' }, 0.04);
    } else {
      gsap.set('#kolaFill', { attr: { height: 480, y: 280 } });
    }
  })();

  /* ---------------------------------------------------------
     Ambient smoke / ember canvas background
  --------------------------------------------------------- */
  (function smokeCanvas() {
    const canvas = document.getElementById('smoke-canvas');
    if (REDUCED) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles;
    const COUNT = window.innerWidth < 700 ? 22 : 42;

    function isDark() {
      const t = root.getAttribute('data-theme');
      if (t) return t === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    function makeParticles() {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        speed: 0.12 + Math.random() * 0.28,
        drift: (Math.random() - 0.5) * 0.25,
        alpha: 0.08 + Math.random() * 0.18
      }));
    }
    resize();
    makeParticles();
    window.addEventListener('resize', () => { resize(); });

    let visible = true;
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      const color = isDark() ? '245,238,223' : '32,24,18';
      particles.forEach((p) => {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    tick();
  })();

  /* ---------------------------------------------------------
     Refresh ScrollTrigger on resize / late font swap
  --------------------------------------------------------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
  });
})();
