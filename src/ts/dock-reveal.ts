import { query } from './shared/dom';

const dock = query<HTMLElement>('.booking-dock');
const heroTitle = query<HTMLElement>('.title-lockup');

if (dock && heroTitle) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsIntersectionObserver = typeof globalThis.IntersectionObserver === 'function';
  const easeOut = 'cubic-bezier(.22, 1, .36, 1)';
  let resolved = false;
  let observer: IntersectionObserver | null = null;

  const disconnect = (): void => {
    observer?.disconnect();
    observer = null;
  };

  const finishReveal = (): void => {
    resolved = true;
    disconnect();
  };

  const revealImmediately = (): void => {
    if (resolved) return;
    resolved = true;
    disconnect();

    const computed = window.getComputedStyle(dock);
    const startOpacity = Number.parseFloat(computed.opacity);
    const startTranslate = computed.translate === 'none' ? '0 8px' : computed.translate;
    const startScale = computed.scale === 'none' ? '0.992' : computed.scale;

    dock.style.opacity = Number.isFinite(startOpacity) ? String(startOpacity) : '0';
    dock.style.translate = startTranslate;
    dock.style.scale = startScale;
    dock.style.willChange = 'opacity, translate, scale';
    dock.getAnimations().forEach((animation) => animation.cancel());

    if (reducedMotion.matches) {
      dock.style.opacity = '1';
      dock.style.translate = '0 0';
      dock.style.scale = '1';
      dock.style.willChange = '';
      return;
    }

    const animation = dock.animate([
      {
        opacity: Number.isFinite(startOpacity) ? startOpacity : 0,
        translate: startTranslate,
        scale: startScale
      },
      {
        opacity: 1,
        translate: '0 0',
        scale: 1
      }
    ], {
      duration: 190,
      easing: easeOut,
      fill: 'both'
    });

    animation.addEventListener('finish', () => {
      dock.style.opacity = '1';
      dock.style.translate = '0 0';
      dock.style.scale = '1';
      dock.style.willChange = '';
      animation.cancel();
    }, { once: true });
  };

  const titleIsOutsideViewport = (): boolean => {
    const rect = heroTitle.getBoundingClientRect();
    return rect.bottom <= 0 || rect.top >= window.innerHeight;
  };

  const prioritizeWhenNeeded = (): void => {
    if (!resolved && window.scrollY > 0 && titleIsOutsideViewport()) revealImmediately();
  };

  dock.addEventListener('animationend', (event) => {
    if (
      event.target === dock &&
      (event.animationName === 'dock-in' || event.animationName === 'stage-dock-in')
    ) {
      finishReveal();
    }
  });

  const activeDockAnimation = dock.getAnimations().some(
    (animation) => animation.playState === 'running'
  );

  if (!activeDockAnimation && Number.parseFloat(getComputedStyle(dock).opacity) >= 0.99) {
    finishReveal();
  } else if (supportsIntersectionObserver) {
    const nextObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && !entry.isIntersecting && window.scrollY > 0) revealImmediately();
    }, { threshold: 0 });
    observer = nextObserver;
    nextObserver.observe(heroTitle);
  } else {
    let frameId = 0;
    window.addEventListener('scroll', () => {
      if (frameId || resolved) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        prioritizeWhenNeeded();
      });
    }, { passive: true });
  }

  window.requestAnimationFrame(prioritizeWhenNeeded);
}
