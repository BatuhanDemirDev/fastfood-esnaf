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
      const toX = parseFloat(piece.dataset.toX || 0);
      const toY = parseFloat(piece.dataset.toY || 0);
      const toRot = parseFloat(piece.dataset.toRot || 0);
      const toScale = parseFloat(piece.dataset.toScale || 1);
      const toOpacity = parseFloat(piece.dataset.toOpacity !== undefined ? piece.dataset.toOpacity : 1);
      tl.fromTo(piece,
        { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
        { x: toX, y: toY, rotate: toRot, scale: toScale, opacity: toOpacity, ease: 'power1.in', duration: dur },
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
      return null;
    }

    const stConfig = {
      trigger: section,
      start: 'top top',
      end: '+=' + scrollLength,
      scrub: 0.6,
      pin: true,
      anticipatePin: 1,
      pinSpacing: true
    };
    if (extra.onUpdate) stConfig.onUpdate = extra.onUpdate;

    const tl = gsap.timeline({ scrollTrigger: stConfig });

    pieces.forEach((piece, i) => {
      const pos = piece.dataset.pos !== undefined ? parseFloat(piece.dataset.pos) : i * 0.06;
      buildTween(tl, piece, pos);
    });

    return tl;
  }

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

    initAssembleSection(document.getElementById('hero'));

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
    initAssembleSection(document.getElementById('patates'));
  })();

  /* ---------------------------------------------------------
     DÖNER
  --------------------------------------------------------- */
  (function donerInit() {
    const section = document.getElementById('doner');
    const counter = document.querySelector('.doner-counter-text');

    initAssembleSection(section, {
      onUpdate(self) {
        if (!counter) return;
        const p = self.progress;
        if (p < 0.15) counter.textContent = 'ISINIYOR…';
        else if (p < 0.65) counter.textContent = 'DİLİMLENİYOR…';
        else counter.textContent = 'HAZIR! AFİYET OLSUN';
      }
    });

    if (!REDUCED) {
      gsap.to('#coneShine', { x: 210, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('#meatCone', { scaleX: 0.965, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%' });
      document.querySelectorAll('.flame-flecks path').forEach((p, i) => {
        gsap.to(p, { opacity: 0.45, y: -4, duration: 0.5 + Math.random() * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.15 });
      });
    }
  })();

  /* ---------------------------------------------------------
     PIZZA
  --------------------------------------------------------- */
  (function pizzaInit() {
    const cheese = document.getElementById('cheeseBlobs');
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.2;
      const r = 205 + Math.random() * 14;
      const fx = 400 + Math.cos(angle) * r;
      const fy = 400 + Math.sin(angle) * r;
      makePiece(cheese, 'circle', { cx: fx.toFixed(1), cy: fy.toFixed(1), r: (10 + Math.random() * 6).toFixed(1), fill: 'var(--mustard-light)' }, {
        fromScale: '0', pos: (0.32 + Math.random() * 0.08).toFixed(3), origin: 'center'
      });
    }

    scatterParticles(document.getElementById('pepperoni'), 10, {
      cx: 400, cy: 400, radius: 190, flatten: 1, uniformDisk: true,
      size: [20, 26], color: 'var(--red-deep)', posStart: 0.44, posEnd: 0.72, distance: 260
    });

    scatterParticles(document.getElementById('pizzaHerbs'), 16, {
      cx: 400, cy: 400, radius: 210, flatten: 1, uniformDisk: true,
      size: [2, 3.5], color: 'var(--green-dark)', posStart: 0.76, posEnd: 0.92, distance: 200
    });

    const tl = initAssembleSection(document.getElementById('pizza'));
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
    initAssembleSection(document.getElementById('burger'));
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
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', pos[0]); rect.setAttribute('y', pos[1]);
      rect.setAttribute('width', '30'); rect.setAttribute('height', '30');
      rect.setAttribute('rx', '6'); rect.setAttribute('fill', '#EAF4F1'); rect.setAttribute('opacity', '0.85');
      rect.setAttribute('stroke', 'var(--ink)'); rect.setAttribute('stroke-width', '2.5');
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', pos[0] + 6); line.setAttribute('y1', pos[1] + 6);
      line.setAttribute('x2', pos[0] + 20); line.setAttribute('y2', pos[1] + 12);
      line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '2'); line.setAttribute('opacity', '0.7');
      g.appendChild(rect); g.appendChild(line);
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
