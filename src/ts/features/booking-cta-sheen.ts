import { query, setStyles } from '../shared/dom';
import type { RuntimeContext } from '../shared/runtime';

export const setupBookingCtaSheen = ({
  reducedMotion,
  compactViewport,
  coarsePointer
}: RuntimeContext): void => {
  const selectedCta = query<HTMLAnchorElement>('[data-booking-cta]');
  if (!selectedCta || reducedMotion.matches || typeof selectedCta.animate !== 'function') return;

  const cta = selectedCta;
  cta.style.filter = 'none';
  cta.classList.add('has-runtime-sheen');

  const sheen = document.createElement('i');
  sheen.setAttribute('aria-hidden', 'true');
  setStyles(sheen, {
    position: 'absolute',
    zIndex: '1',
    top: '-48%',
    bottom: '-48%',
    left: '0',
    width: '88%',
    opacity: '0',
    pointerEvents: 'none',
    transform: 'translate3d(-145%, 0, 0) skewX(-18deg)',
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.05) 10%, rgba(255,255,255,.18) 24%, rgba(255,255,255,.46) 42%, rgba(255,255,255,.82) 50%, rgba(255,255,255,.46) 58%, rgba(255,255,255,.18) 76%, rgba(255,255,255,.05) 90%, transparent 100%)',
    filter: 'blur(6px)',
    willChange: 'transform, opacity'
  });
  cta.prepend(sheen);

  const initialDelay = 1_500;
  const regularDelay = 7_400;
  const duration = compactViewport.matches || coarsePointer.matches ? 1_450 : 1_800;
  let timerId = 0;
  let activeAnimation: Animation | null = null;
  let activeGlow: Animation | null = null;
  let interactionArmed = true;
  let initialPending = true;

  const clearTimer = (): void => {
    if (!timerId) return;
    window.clearTimeout(timerId);
    timerId = 0;
  };

  const scheduleRegularLoop = (delay = regularDelay): void => {
    clearTimer();
    timerId = window.setTimeout(() => {
      timerId = 0;
      runSheen();
    }, delay);
  };

  function runSheen(): void {
    clearTimer();
    activeAnimation?.cancel();
    activeGlow?.cancel();

    const animation = sheen.animate([
      { transform: 'translate3d(-145%, 0, 0) skewX(-18deg)', opacity: 0 },
      { transform: 'translate3d(-122%, 0, 0) skewX(-18deg)', opacity: 0, offset: 0.1 },
      { transform: 'translate3d(-78%, 0, 0) skewX(-18deg)', opacity: 0.82, offset: 0.28 },
      { transform: 'translate3d(172%, 0, 0) skewX(-18deg)', opacity: 0.58, offset: 0.82 },
      { transform: 'translate3d(215%, 0, 0) skewX(-18deg)', opacity: 0 }
    ], {
      duration,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'none'
    });

    const glow = cta.animate([
      { boxShadow: '0 0 0 rgba(0,26,197,0)', filter: 'brightness(1)' },
      { boxShadow: '0 0 0 rgba(0,26,197,0)', filter: 'brightness(1)', offset: 0.18 },
      { boxShadow: '0 0 28px rgba(0,26,197,.34)', filter: 'brightness(1.08)', offset: 0.55 },
      { boxShadow: '0 0 0 rgba(0,26,197,0)', filter: 'brightness(1)' }
    ], {
      duration,
      easing: 'ease-in-out',
      fill: 'none'
    });

    activeAnimation = animation;
    activeGlow = glow;
    animation.addEventListener('finish', () => {
      if (activeAnimation === animation) activeAnimation = null;
      if (activeGlow === glow) activeGlow = null;
      scheduleRegularLoop();
    }, { once: true });
  }

  const triggerInteractionSheen = (): void => {
    if (!interactionArmed || document.hidden) return;
    interactionArmed = false;
    initialPending = false;
    runSheen();
  };

  timerId = window.setTimeout(() => {
    timerId = 0;
    initialPending = false;
    runSheen();
  }, initialDelay);

  cta.addEventListener('pointerenter', triggerInteractionSheen, { passive: true });
  cta.addEventListener('pointerleave', () => {
    interactionArmed = true;
  }, { passive: true });
  cta.addEventListener('focus', triggerInteractionSheen);
  cta.addEventListener('blur', () => {
    interactionArmed = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimer();
      activeAnimation?.cancel();
      activeGlow?.cancel();
      activeAnimation = null;
      activeGlow = null;
      return;
    }
    scheduleRegularLoop(initialPending ? 650 : regularDelay);
  });
};
