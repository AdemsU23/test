/* ==========================================================================
   Miracle Teams — animations & interactions
   Dépendances chargées depuis un CDN dans index.html : GSAP, ScrollTrigger,
   SplitText et Lenis. Si elles ne se chargent pas, le site reste entièrement
   utilisable (menu, diaporama, formulaires), simplement sans les grandes animations.
   ========================================================================== */
(() => {
  'use strict';

  window.__mt = true; // signale au script de l'en-tête que tout s'est bien chargé

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = Boolean(window.gsap && window.ScrollTrigger);
  const hasSplit = hasGSAP && Boolean(window.SplitText);
  const motion = hasGSAP && !reduceMotion;
  const loaderFailed = root.classList.contains('loader-fail');

  root.classList.add(motion ? 'motion' : 'no-motion');
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  if (hasSplit) gsap.registerPlugin(SplitText);

  const safe = (name, fn) => {
    try { return fn(); } catch (err) { console.error(`[Miracle Teams] ${name} :`, err); return undefined; }
  };

  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* stockage indisponible */ } },
  };

  // Les textes sont découpés en lettres une fois les polices chargées (3 s maximum)
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3000))])
    : Promise.resolve();

  /* ---------- Défilement fluide (Lenis) ---------- */
  let lenis = null;

  function initSmoothScroll() {
    if (!motion || typeof window.Lenis !== 'function') return;
    lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const stopScroll = () => { if (lenis) lenis.stop(); };
  const startScroll = () => { if (lenis) lenis.start(); };

  function scrollToTarget(target, { focus = false } = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const done = () => { if (focus) el.focus({ preventScroll: true }); };
    if (lenis) {
      lenis.scrollTo(el, { duration: 1.6, onComplete: done });
    } else {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      done();
    }
  }

  /* ---------- Liens internes ---------- */
  let closeMenu = () => {};

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      if (hash === '#') { e.preventDefault(); return; } // liens de réseaux sociaux pas encore renseignés
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      const fromMenu = root.classList.contains('menu-open');
      if (fromMenu) closeMenu(false);
      window.setTimeout(() => scrollToTarget(target, { focus: link.classList.contains('skip-link') }), fromMenu ? 450 : 0);
    });

    $$('[data-scroll-top]').forEach((btn) => btn.addEventListener('click', () => scrollToTarget('#accueil')));
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const nav = $('.nav');
    if (!nav) return;

    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 30);
      if (y > lastY + 4 && y > window.innerHeight * 0.6) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 100) nav.classList.remove('is-hidden');
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    onScroll();

    // Lien actif + trait qui glisse sous le menu
    const links = $$('.nav__links a');
    const indicator = $('.nav__indicator');
    const move = (link) => {
      if (!indicator) return;
      if (!link) { indicator.style.opacity = '0'; return; }
      indicator.style.opacity = '1';
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    };
    const setActive = (id) => {
      let active = null;
      links.forEach((link) => {
        const on = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('is-active', on);
        if (on) { active = link; link.setAttribute('aria-current', 'true'); } else link.removeAttribute('aria-current');
      });
      move(active);
    };
    const sections = links.map((link) => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    sections.forEach((section) => observer.observe(section));
    window.addEventListener('resize', () => move($('.nav__links a.is-active')));
  }

  /* ---------- Menu plein écran ---------- */
  function initMenu() {
    const btn = $('.menu-btn');
    const menu = $('#menu');
    if (!btn || !menu) return;

    const isOpen = () => root.classList.contains('menu-open');

    const open = (fromKeyboard) => {
      const r = btn.getBoundingClientRect();
      menu.style.setProperty('--mx', `${r.left + r.width / 2}px`);
      menu.style.setProperty('--my', `${r.top + r.height / 2}px`);
      root.classList.add('menu-open');
      menu.removeAttribute('inert');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Fermer le menu');
      stopScroll();
      // Au clavier, on place le focus dans le menu ; à la souris, on évite le contour de focus
      window.setTimeout(() => {
        const first = $('a', menu);
        if (!first || !isOpen()) return;
        if (fromKeyboard) first.focus({ preventScroll: true });
        else { menu.tabIndex = -1; menu.focus({ preventScroll: true }); }
      }, 500);
    };

    closeMenu = (restoreFocus = true) => {
      if (!isOpen()) return;
      root.classList.remove('menu-open');
      menu.setAttribute('inert', '');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Ouvrir le menu');
      startScroll();
      if (restoreFocus) btn.focus({ preventScroll: true });
    };

    btn.addEventListener('click', (e) => (isOpen() ? closeMenu() : open(e.detail === 0)));

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const focusables = [btn, ...$$('a, button', menu)];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- Vitrine : diaporama + verre cannelé ---------- */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return {};

    const slides = $$('.hero__slide', hero);
    const copies = $$('.hero__copy', hero);
    const dots = $$('.slider__dots button', hero);
    const counter = $('.slider__count b', hero);
    const glass = $('.hero__glass', hero);
    const swoosh = $('.hero__swoosh', hero);
    const media = $('.hero__media', hero);

    const AUTOPLAY = 7;   // secondes par diapositive
    const OVERSCAN = 40;  // marge (px) des images dans chaque bande de verre
    const RATIO = 1.5;    // les photos de la vitrine sont au format 3:2

    let current = 0;
    let busy = false;
    let strips = [];
    let stripMovers = [];
    let autoplay = null;
    let fallbackTimer = null;
    let kenBurns = null;
    let inView = true;
    let hovering = false;

    // Titres découpés en lettres (re-découpés automatiquement si la police change)
    const titleChars = copies.map(() => []);
    if (motion && hasSplit) {
      fontsReady.then(() => copies.forEach((copy, i) => {
        SplitText.create($('.hero__title', copy), {
          type: 'lines,chars', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit(self) { titleChars[i] = self.chars; },
        });
      }));
    }
    const charsOf = (i) => (titleChars[i].length ? titleChars[i] : $('.hero__title', copies[i]));

    /* Bandes de verre : chacune montre une version floue et décalée de la photo */
    const stripCount = () => (window.innerWidth < 600 ? 5 : window.innerWidth < 1100 ? 7 : 9);

    function buildStrips() {
      const n = stripCount();
      if (strips.length === n) return;
      glass.textContent = '';
      strips = Array.from({ length: n }, () => {
        const strip = document.createElement('div');
        strip.className = 'strip';
        const img = document.createElement('div');
        img.className = 'strip__img';
        strip.appendChild(img);
        glass.appendChild(strip);
        return img;
      });
      stripMovers = motion && finePointer
        ? strips.map((img) => gsap.quickTo(img, 'x', { duration: 1.2, ease: 'power3' }))
        : [];
    }

    function paintStrips(index) {
      const slide = slides[index];
      const src = slide && slide.dataset.ghostSrc;
      if (!src || !strips.length) return;
      const [sx, sy, scale] = (slide.dataset.ghost || '0.5 0.5 1.5').split(/\s+/).map(Number);
      const W = hero.clientWidth;
      const H = hero.clientHeight;
      const gw = glass.clientWidth;
      const gh = glass.clientHeight;
      const gTop = glass.offsetTop;

      let cw = W;
      let ch = W / RATIO;
      if (ch < H) { ch = H; cw = H * RATIO; }
      const iw = cw * scale;
      const ih = ch * scale;
      const bx = Math.min(0, Math.max(gw - iw, gw / 2 - sx * iw));
      const by = Math.min(0, Math.max(gh - ih, H / 2 - sy * ih - gTop));
      const n = strips.length;
      const sw = gw / n;

      strips.forEach((img, i) => {
        const refraction = (i - (n - 1) / 2) * sw * 0.22;
        img.style.backgroundImage = `url("${src}")`;
        img.style.backgroundSize = `${iw}px ${ih}px`;
        img.style.backgroundPosition = `${bx - i * sw + OVERSCAN + refraction}px ${by + OVERSCAN}px`;
      });
    }

    buildStrips();
    paintStrips(0);
    // Précharge les images floues des autres diapositives
    slides.forEach((s) => { if (s.dataset.ghostSrc) { const im = new Image(); im.src = s.dataset.ghostSrc; } });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { buildStrips(); paintStrips(current); }, 150);
    });

    /* Parallaxe à la souris */
    if (motion && finePointer) {
      const mx = gsap.quickTo(media, 'x', { duration: 1.6, ease: 'power3' });
      const my = gsap.quickTo(media, 'y', { duration: 1.6, ease: 'power3' });
      const wx = gsap.quickTo(swoosh, 'x', { duration: 2, ease: 'power3' });
      const wy = gsap.quickTo(swoosh, 'y', { duration: 2, ease: 'power3' });
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        mx(nx * -24); my(ny * -16);
        wx(nx * 34); wy(ny * 22);
        const n = stripMovers.length;
        stripMovers.forEach((to, i) => to(nx * (8 + 26 * (i / Math.max(1, n - 1)))));
      });
      hero.addEventListener('pointerleave', () => {
        mx(0); my(0); wx(0); wy(0);
        stripMovers.forEach((to) => to(0));
      });
    }

    /* Interface du diaporama */
    function setUI(i) {
      dots.forEach((dot, j) => {
        dot.classList.toggle('is-active', i === j);
        if (i === j) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = String(i + 1).padStart(2, '0');
      copies.forEach((copy, j) => copy.setAttribute('aria-hidden', i === j ? 'false' : 'true'));
    }

    function startKenBurns(i) {
      if (!motion) return;
      if (kenBurns) kenBurns.kill();
      kenBurns = gsap.fromTo($('img', slides[i]), { scale: 1.04 }, { scale: 1.12, duration: AUTOPLAY + 3, ease: 'none' });
    }

    function stopAutoplay() {
      if (autoplay) { autoplay.kill(); autoplay = null; }
      clearTimeout(fallbackTimer);
      if (motion) dots.forEach((dot) => gsap.set($('span', dot), { scaleX: 0 }));
    }

    function scheduleAutoplay() {
      if (reduceMotion) return;
      stopAutoplay();
      if (motion) {
        autoplay = gsap.fromTo($('span', dots[current]), { scaleX: 0 }, {
          scaleX: 1, duration: AUTOPLAY, ease: 'none',
          onComplete: () => goTo(current + 1, 1),
        });
        if (!inView || hovering || document.hidden) autoplay.pause();
      } else {
        fallbackTimer = setTimeout(() => goTo(current + 1, 1), AUTOPLAY * 1000);
      }
    }

    const syncAutoplay = () => {
      if (!autoplay) return;
      if (inView && !hovering && !document.hidden) autoplay.resume(); else autoplay.pause();
    };

    function goTo(target, dir) {
      const next = (target + slides.length) % slides.length;
      if (busy || next === current) return;
      const direction = dir || (next > current ? 1 : -1);
      const prev = current;
      current = next;
      setUI(next);
      stopAutoplay();

      if (!motion) {
        slides[prev].classList.remove('is-active');
        slides[next].classList.add('is-active');
        copies[prev].classList.remove('is-active');
        copies[next].classList.add('is-active');
        paintStrips(next);
        scheduleAutoplay();
        return;
      }

      busy = true;
      const outSlide = slides[prev];
      const inSlide = slides[next];
      const outImg = $('img', outSlide);
      const inImg = $('img', inSlide);
      const outCopy = copies[prev];
      const inCopy = copies[next];
      const outBits = [$('.hero__eyebrow', outCopy), $('.hero__text', outCopy)];
      if (kenBurns) kenBurns.kill();

      inSlide.classList.add('is-active');
      inCopy.classList.add('is-active');
      gsap.set(inSlide, { zIndex: 2, clipPath: direction > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' });
      gsap.set(outSlide, { zIndex: 1 });

      const n = strips.length;
      const stripsOut = 0.6 + (n - 1) * 0.04;

      const tl = gsap.timeline({
        defaults: { ease: 'expo.inOut' },
        onComplete: () => {
          outSlide.classList.remove('is-active');
          outCopy.classList.remove('is-active');
          gsap.set([outSlide, inSlide], { clearProps: 'zIndex,clipPath' });
          gsap.set(outImg, { clearProps: 'transform' });
          gsap.set([charsOf(prev), ...outBits], { clearProps: 'transform,opacity' });
          busy = false;
          startKenBurns(next);
          scheduleAutoplay();
        },
      });

      // Image : rideau latéral + zoom
      tl.to(inSlide, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5 }, 0)
        .fromTo(inImg, { scale: 1.3, xPercent: direction * 6 }, { scale: 1.04, xPercent: 0, duration: 1.8, ease: 'expo.out' }, 0.1)
        .to(outImg, { scale: 1.18, xPercent: -direction * 8, duration: 1.5 }, 0);

      // Bandes de verre : elles « roulent » puis reviennent avec la nouvelle image
      tl.to(strips, { yPercent: direction > 0 ? -102 : 102, duration: 0.6, ease: 'power3.in', stagger: 0.04 }, 0)
        .add(() => paintStrips(next), stripsOut)
        .fromTo(strips, { yPercent: direction > 0 ? 102 : -102 }, {
          yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.04, immediateRender: false,
        }, stripsOut + 0.02);

      // Textes
      tl.to(charsOf(prev), { yPercent: -110, duration: 0.55, ease: 'power3.in', stagger: 0.008 }, 0)
        .to(outBits, { opacity: 0, y: -16, duration: 0.45, ease: 'power2.in' }, 0)
        .fromTo(charsOf(next), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.018 }, 0.55)
        .fromTo($('.hero__eyebrow', inCopy), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out' }, 0.6)
        .fromTo($('.hero__text', inCopy), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, 0.75);
    }

    $$('.slider__arrow', hero).forEach((btn) => btn.addEventListener('click', () => {
      const d = Number(btn.dataset.dir);
      goTo(current + d, d);
    }));
    dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
    hero.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') goTo(current + 1, 1);
      if (e.key === 'ArrowLeft') goTo(current - 1, -1);
    });

    // Glisser du doigt sur mobile
    let touchX = null;
    hero.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') touchX = e.clientX; });
    hero.addEventListener('pointerup', (e) => {
      if (touchX === null) return;
      const dx = e.clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    hero.addEventListener('pointercancel', () => { touchX = null; });

    // Pause quand la vitrine n'est pas visible, ou quand on lit le texte
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncAutoplay(); }, { threshold: 0.2 }).observe(hero);
    $$('.hero__content, .slider', hero).forEach((zone) => {
      zone.addEventListener('pointerenter', () => { hovering = true; syncAutoplay(); });
      zone.addEventListener('pointerleave', () => { hovering = false; syncAutoplay(); });
    });
    document.addEventListener('visibilitychange', syncAutoplay);

    setUI(0);

    /* Entrée en scène (après l'intro) */
    function intro() {
      const copy = copies[0];
      const rim = $('.sw-rim', swoosh);
      const rimLength = rim && rim.getTotalLength ? rim.getTotalLength() : 900;
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: ready });
      tl.fromTo(media, { scale: 1.25 }, { scale: 1, duration: 2.6 }, 0)
        .fromTo(strips, { yPercent: 102 }, { yPercent: 0, duration: 1.7, ease: 'expo.inOut', stagger: 0.07 }, 0)
        .fromTo(swoosh, { opacity: 0, xPercent: 16, yPercent: -10 }, { opacity: 1, xPercent: 0, yPercent: 0, duration: 2.4 }, 0.3);
      if (rim) tl.fromTo(rim, { strokeDasharray: rimLength, strokeDashoffset: rimLength }, { strokeDashoffset: 0, duration: 2.6, ease: 'power3.inOut' }, 0.4);
      tl.fromTo($('.hero__eyebrow', copy), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 1.2 }, 0.6)
        .fromTo(charsOf(0), { yPercent: 110 }, { yPercent: 0, duration: 1.4, stagger: 0.022 }, 0.65)
        .fromTo($('.hero__text', copy), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2 }, 1.05)
        .fromTo($$('.hero__actions > *', hero), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 1.15)
        .fromTo($$('.nav > *'), { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08, clearProps: 'transform,opacity' }, 0.8)
        .fromTo($('.hero__scroll', hero), { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1.3)
        .fromTo($$('.hero__bottom > *', hero), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 1.3);
      return tl;
    }

    function ready() {
      startKenBurns(0);
      scheduleAutoplay();
    }

    return { intro, ready };
  }

  /* ---------- Intro : compte à rebours façon pellicule ---------- */
  function runLoader(onReveal) {
    const loader = $('.loader');
    const finish = () => {
      root.classList.add('loader-done');
      if (loader) loader.remove();
    };

    if (!loader || loaderFailed || !motion) {
      finish();
      onReveal(false);
      return;
    }

    stopScroll();
    const firstVisit = !session.get('mt-intro');
    session.set('mt-intro', '1');

    // On attend la première photo et les polices (4 s maximum)
    const heroImg = $('.hero__slide.is-active img');
    const imageReady = new Promise((resolve) => {
      if (!heroImg || heroImg.complete) { resolve(); return; }
      heroImg.addEventListener('load', resolve, { once: true });
      heroImg.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 4000);
    });
    const assetsReady = Promise.all([imageReady, fontsReady]);

    const leader = $('.leader', loader);
    const num = $('.leader__num', loader);
    const pie = $('.leader__pie', loader);
    const C = 2 * Math.PI * 45;

    const tl = gsap.timeline({ onComplete: () => { finish(); startScroll(); } });

    if (firstVisit) {
      const beat = 0.42;
      [3, 2, 1].forEach((n, i) => {
        const t = i * beat;
        tl.call(() => { num.textContent = String(n); }, null, t)
          .fromTo(pie, { strokeDashoffset: C }, { strokeDashoffset: 0, duration: beat, ease: 'none', immediateRender: false }, t)
          .fromTo(num, { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: 'power2.out', immediateRender: false }, t)
          .to(leader, { opacity: 0.75, duration: 0.04, yoyo: true, repeat: 1 }, t + 0.2);
      });
      tl.to(leader, { scale: 0.7, opacity: 0, duration: 0.45, ease: 'power3.in' }, 3 * beat);
    } else {
      tl.set(leader, { display: 'none' });
    }

    const b = tl.duration();
    // Le masque déborde du logo (-60 %) pour ne pas couper son halo lumineux
    tl.fromTo('.loader__logo', { opacity: 1, clipPath: 'inset(100% -60% -60% -60%)', y: 24 }, { clipPath: 'inset(-60% -60% -60% -60%)', y: 0, duration: 1.1, ease: 'expo.out' }, b)
      .fromTo('.loader__word span', { y: 0, yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.035 }, b + 0.15)
      .addPause(b + 1.35, () => { assetsReady.then(() => tl.play()); })
      .to('.loader__stage', { opacity: 0, scale: 0.96, duration: 0.5, ease: 'power2.in' }, b + 1.35)
      .add(() => onReveal(true), b + 1.75)
      .to('.loader__cols span', { scaleY: 0, duration: 1.1, ease: 'expo.inOut', stagger: { each: 0.05, from: 'center' } }, b + 1.7);

    // Un clic accélère l'intro
    loader.addEventListener('click', () => tl.timeScale(4));
  }

  /* ---------- Processus : défilement horizontal épinglé ---------- */
  function initProcess() {
    const section = $('.process');
    const track = $('.process__track');
    const bar = $('.process__progress span');
    if (!section || !track) return;

    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', () => {
      const distance = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: () => `+=${distance()}`,
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
      if (bar) {
        gsap.fromTo(bar, { scaleX: 0 }, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: section, start: 'top top', end: () => `+=${distance()}`, scrub: 1, invalidateOnRefresh: true },
        });
      }
      $$('.step', track).forEach((step) => {
        gsap.fromTo($('.step__num', step), { xPercent: 45, opacity: 0.15 }, {
          xPercent: 0, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 100%', end: 'left 50%', scrub: true },
        });
      });
    });
    mm.add('(max-width: 900px)', () => {
      $$('.step', track).forEach((step) => {
        gsap.from(step, { opacity: 0, y: 60, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: step, start: 'top 88%', once: true } });
      });
    });
  }

  /* ---------- Bandeau défilant réactif au scroll ---------- */
  function initMarquee() {
    const inner = $('.marquee__inner');
    if (!inner) return;
    const loop = gsap.to(inner, { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
    loop.totalTime(loop.duration() * 100); // laisse de la marge pour pouvoir défiler à l'envers
    const skewTo = gsap.quickTo(inner, 'skewX', { duration: 0.6, ease: 'power3' });
    let settle;
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate(self) {
        const v = self.getVelocity();
        const dir = self.direction;
        const boost = gsap.utils.clamp(1, 5, Math.abs(v) / 300);
        gsap.to(loop, { timeScale: dir * boost, duration: 0.2, overwrite: true });
        skewTo(gsap.utils.clamp(-8, 8, -v / 250));
        clearTimeout(settle);
        settle = setTimeout(() => {
          gsap.to(loop, { timeScale: dir, duration: 1.2, ease: 'power2.out', overwrite: true });
          skewTo(0);
        }, 120);
      },
    });
  }

  /* ---------- Apparitions au défilement ---------- */
  function initReveals() {
    // Titres : lignes qui montent derrière un masque
    $$('[data-split]').forEach((el) => {
      if (!hasSplit) {
        gsap.from(el, { opacity: 0, y: 40, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
        return;
      }
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
      });
    });

    // Blocs : fondu + montée
    $$('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        opacity: 0, y: 40, duration: 1.3, ease: 'expo.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    // Groupes : les éléments arrivent l'un après l'autre
    $$('[data-stagger]').forEach((group) => {
      gsap.from(group.children, {
        opacity: 0, y: 60, duration: 1.3, ease: 'expo.out', stagger: 0.12, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      });
    });

    // Images : rideau qui s'ouvre + dézoom
    $$('[data-clip]').forEach((box) => {
      const img = $('img', box);
      const tl = gsap.timeline({ scrollTrigger: { trigger: box, start: 'top 82%', once: true } });
      tl.fromTo(box, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' });
      if (img) tl.from(img, { scale: 1.35, duration: 2, ease: 'expo.out' }, 0.2);
      const tag = $('.media__tag', box);
      if (tag) tl.from(tag, { opacity: 0, y: 20, duration: 1, ease: 'expo.out' }, 1.1);
    });

    // Parallaxe des images
    $$('[data-parallax]').forEach((img) => {
      const amount = parseFloat(img.dataset.parallax) || 0.1;
      gsap.fromTo(img, { yPercent: -amount * 100 }, {
        yPercent: amount * 100, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Phrase de vision : les mots s'allument au fil du défilement
    const statement = $('.statement');
    if (statement && hasSplit) {
      const split = SplitText.create(statement, { type: 'words' });
      gsap.fromTo(split.words, { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
    }

    // Citation : lettres qui sortent du flou
    const quote = $('.quote blockquote p');
    if (quote && hasSplit) {
      const split = SplitText.create(quote, { type: 'words,chars' });
      gsap.from(split.chars, {
        opacity: 0, yPercent: 40, filter: 'blur(14px)', duration: 1.2, ease: 'power3.out', stagger: 0.014, clearProps: 'filter',
        scrollTrigger: { trigger: quote, start: 'top 78%', once: true },
      });
    }
    gsap.from('.quote__mark', { opacity: 0, scale: 0.5, rotate: -20, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.quote', start: 'top 65%', once: true } });
    gsap.from('.quote figcaption', { opacity: 0, letterSpacing: '0.8em', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.quote figcaption', start: 'top 92%', once: true } });
    gsap.fromTo('.quote__bg img', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.quote', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Affiches de films
    gsap.from('.film', {
      y: 140, opacity: 0, rotationX: -14, duration: 1.6, ease: 'expo.out', stagger: 0.15, clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '.films__grid', start: 'top 85%', once: true },
    });

    // Barre du lecteur podcast
    gsap.from('.wave span', {
      scaleY: 0, duration: 1, ease: 'expo.out', stagger: { each: 0.015, from: 'center' }, clearProps: 'transform',
      scrollTrigger: { trigger: '.podcast__player', start: 'top 90%', once: true },
    });

    // Grand logo du pied de page
    const giant = $('.footer__giant');
    if (giant && hasSplit) {
      const split = SplitText.create(giant, { type: 'chars', charsClass: 'giant-char' });
      giant.classList.add('is-split');
      gsap.from(split.chars, {
        yPercent: 100, ease: 'none', stagger: 0.06,
        scrollTrigger: { trigger: giant, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
      });
    }
  }

  /* ---------- Curseur personnalisé ---------- */
  let cursorOn = false;

  function initCursor() {
    if (!finePointer) return;
    const cursor = $('.cursor');
    if (!cursor) return;
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = $('.cursor__label', cursor);
    cursorOn = true;
    root.classList.add('has-cursor');

    const dx = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
    let placed = false;
    let overField = false;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!placed) { gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); placed = true; }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      cursor.classList.toggle('is-hidden', overField);
    }, { passive: true });

    document.addEventListener('pointerover', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      overField = Boolean(t && t.closest('input, textarea, select, iframe'));
      const labelled = t && t.closest('[data-cursor]');
      const interactive = t && t.closest('a, button, label, [role="button"]');
      cursor.classList.toggle('is-hidden', overField);
      cursor.classList.toggle('is-hover', Boolean(interactive) && !overField && !labelled);
      cursor.classList.toggle('has-label', Boolean(labelled) && !overField);
      label.textContent = labelled && !overField ? labelled.dataset.cursor : '';
    });

    root.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  }

  /* ---------- Boutons magnétiques ---------- */
  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * strength);
        yTo((e.clientY - r.top - r.height / 2) * strength);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- Cartes « valeurs » : halo qui suit la souris ---------- */
  function initSpotlights() {
    $$('.value').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Films : inclinaison 3D + lecteur vidéo ---------- */
  function initFilms() {
    const modal = $('.modal');
    const frame = modal && $('.modal__frame', modal);

    const openVideo = (id, title) => {
      if (!modal || !frame) return;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = title;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      frame.replaceChildren(iframe);
      if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
      if (cursorOn) root.classList.remove('has-cursor');
      stopScroll();
    };

    if (modal) {
      modal.addEventListener('close', () => {
        frame.replaceChildren();
        if (cursorOn) root.classList.add('has-cursor');
        startScroll();
      });
      $('.modal__close', modal).addEventListener('click', () => modal.close());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
    }

    $$('.film').forEach((card) => {
      const id = (card.dataset.youtube || '').trim();
      const titleEl = $('.film__title', card);
      const title = titleEl ? titleEl.textContent.trim() : 'Court métrage';

      if (/^[\w-]{11}$/.test(id)) {
        card.classList.add('is-playable');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Regarder « ${title} »`);
        card.dataset.cursor = 'Regarder';
        card.addEventListener('click', () => openVideo(id, title));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(id, title); }
        });
      } else {
        card.dataset.cursor = 'Bientôt';
      }

      if (motion && finePointer) {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.8, ease: 'power3' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.8, ease: 'power3' });
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          ry((x - 0.5) * 12);
          rx((0.5 - y) * 10);
          card.style.setProperty('--gx', `${x * 100}%`);
          card.style.setProperty('--gy', `${y * 100}%`);
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      }
    });
  }

  /* ---------- Formulaires (Formspree) ---------- */
  function initForms() {
    $$('form[data-form]').forEach((form) => {
      const success = document.getElementById(form.dataset.success);
      const errorBox = $('.form-error', form);
      const submitBtn = $('.form-submit', form);
      const nextBtn = $('.form-next', form);
      const prevBtn = $('.form-prev', form);
      const panels = $$('.step-panel', form);
      const stepperItems = $$('.stepper li', form);
      const status = $('[data-step-status]', form);
      const stepped = panels.length > 1 && nextBtn && prevBtn;
      let step = 0;

      form.noValidate = true; // la validation est gérée ici, étape par étape

      // Compteurs de caractères
      $$('[data-counter]', form).forEach((field) => {
        const out = document.getElementById(field.dataset.counter);
        const wrap = out && out.closest('.counter');
        const bar = wrap && $('.counter__bar span', wrap);
        const max = field.maxLength > 0 ? field.maxLength : 0;
        const update = () => {
          const n = field.value.length;
          if (out) out.textContent = String(n);
          if (bar && max) bar.style.width = `${(n / max) * 100}%`;
          if (wrap && max) wrap.classList.toggle('is-near', n >= max * 0.9);
        };
        field.addEventListener('input', update);
        update();
      });

      // L'e-mail devient obligatoire si la personne veut être contactée avant l'adaptation
      const email = $('input[type="email"]', form);
      $$('input[name="accord"]', form).forEach((radio) => radio.addEventListener('change', () => {
        if (!email) return;
        const checked = $('input[name="accord"]:checked', form);
        const needed = Boolean(checked && checked.value === 'oui_contact');
        email.required = needed;
        const optional = $('[data-email-optional]', form);
        const hint = $('[data-email-hint]', form);
        if (optional) optional.textContent = needed ? '(nécessaire)' : '(optionnel)';
        if (hint) hint.textContent = needed
          ? 'Nécessaire pour que l\'on puisse te recontacter. Jamais partagé ni publié.'
          : 'Facultatif. Jamais partagé ni publié.';
      }));

      const fieldsOf = (scope) => $$('input:not([type="hidden"]), select, textarea', scope);
      const firstInvalid = (fields) => fields.find((f) => !f.checkValidity());

      const showError = (message) => { errorBox.textContent = message; errorBox.classList.add('is-visible'); };
      const hideError = () => { errorBox.textContent = ''; errorBox.classList.remove('is-visible'); };

      const flagInvalid = (field, scope) => {
        field.reportValidity();
        scope.classList.remove('shake');
        void scope.offsetWidth; // relance l'animation
        scope.classList.add('shake');
      };

      function showStep(i, dir = 1) {
        const previous = panels[step];
        step = i;
        panels.forEach((panel, j) => panel.classList.toggle('is-current', j === i));
        stepperItems.forEach((li, j) => {
          li.classList.toggle('is-current', j === i);
          li.classList.toggle('is-done', j < i);
        });
        prevBtn.hidden = i === 0;
        nextBtn.hidden = i === panels.length - 1;
        submitBtn.hidden = i !== panels.length - 1;
        if (status) status.textContent = `Étape ${i + 1} sur ${panels.length}`;
        if (previous !== panels[i]) {
          if (motion) gsap.fromTo(panels[i], { opacity: 0, x: 40 * dir }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
          const first = fieldsOf(panels[i])[0];
          if (first) first.focus({ preventScroll: true });
          if (hasGSAP) ScrollTrigger.refresh();
        }
      }

      if (stepped) {
        form.classList.add('form--stepped');
        showStep(0);
        nextBtn.addEventListener('click', () => {
          const bad = firstInvalid(fieldsOf(panels[step]));
          if (bad) { flagInvalid(bad, panels[step]); return; }
          showStep(step + 1, 1);
        });
        prevBtn.addEventListener('click', () => showStep(step - 1, -1));
        form.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.matches('input') && step < panels.length - 1) {
            e.preventDefault();
            nextBtn.click();
          }
        });
      }

      const labelWrap = submitBtn && $('.btn__label', submitBtn);
      const label = labelWrap && $('span', labelWrap);
      const idleText = label ? label.textContent : '';
      const setLoading = (on) => {
        submitBtn.disabled = on;
        submitBtn.classList.toggle('is-loading', on);
        form.setAttribute('aria-busy', on ? 'true' : 'false');
        if (label) {
          label.textContent = on ? 'Envoi en cours…' : idleText;
          labelWrap.dataset.text = label.textContent;
        }
      };

      const showSuccess = () => {
        const reveal = () => {
          form.hidden = true;
          success.hidden = false;
          success.focus({ preventScroll: true });
          if (motion) gsap.from($$('h3, p', success), { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.1, delay: 0.4 });
          if (hasGSAP) ScrollTrigger.refresh();
        };
        if (motion) gsap.to(form, { opacity: 0, y: -20, duration: 0.45, ease: 'power2.in', onComplete: () => { gsap.set(form, { clearProps: 'all' }); reveal(); } });
        else reveal();
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        if (stepped && step < panels.length - 1) { nextBtn.click(); return; }

        const bad = firstInvalid(fieldsOf(form));
        if (bad) {
          const index = panels.findIndex((p) => p.contains(bad));
          if (stepped && index > -1 && index !== step) showStep(index, index < step ? -1 : 1);
          flagInvalid(bad, index > -1 ? panels[index] : form);
          return;
        }

        setLoading(true);
        try {
          const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
          if (res.ok) { showSuccess(); return; }
          const data = await res.json().catch(() => null);
          const detail = data && Array.isArray(data.errors) ? data.errors.map((er) => er.message).filter(Boolean).join(' ') : '';
          showError(detail || 'Une erreur est survenue. Réessaie dans quelques instants.');
        } catch {
          showError('Connexion impossible. Vérifie ta connexion internet puis réessaie.');
        }
        setLoading(false);
      });
    });
  }

  /* ---------- Onde sonore du podcast ---------- */
  function initWave() {
    $$('.wave').forEach((wave) => {
      const n = 46;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i += 1) {
        const bar = document.createElement('span');
        const envelope = Math.sin((i / (n - 1)) * Math.PI);
        bar.style.setProperty('--min', (0.12 + Math.random() * 0.15).toFixed(2));
        bar.style.setProperty('--max', (0.3 + envelope * 0.65 * (0.55 + Math.random() * 0.45)).toFixed(2));
        bar.style.setProperty('--d', `${(0.6 + Math.random() * 0.9).toFixed(2)}s`);
        bar.style.setProperty('--delay', `${(-Math.random() * 1.5).toFixed(2)}s`);
        frag.appendChild(bar);
      }
      wave.appendChild(frag);
    });
  }

  /* ---------- Démarrage ---------- */
  safe('année', () => $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); }));
  safe('onde', initWave);
  safe('défilement fluide', initSmoothScroll);
  safe('liens', initAnchors);
  safe('navigation', initNav);
  safe('menu', initMenu);
  safe('halos', initSpotlights);
  safe('formulaires', initForms);
  safe('films', initFilms);
  const heroApi = safe('vitrine', initHero) || {};

  if (motion) {
    fontsReady.then(() => {
      safe('processus', initProcess); // les sections épinglées d'abord
      safe('bandeau', initMarquee);
      safe('apparitions', initReveals);
      ScrollTrigger.refresh();
    });
    safe('curseur', initCursor);
    safe('boutons magnétiques', initMagnetic);
  }

  safe('intro', () => runLoader((playIntro) => {
    if (playIntro && heroApi.intro) heroApi.intro();
    else if (heroApi.ready) heroApi.ready();
  }));

  if (hasGSAP) window.addEventListener('load', () => ScrollTrigger.refresh());
})();
