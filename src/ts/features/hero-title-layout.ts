import { query } from '../shared/dom';

const STACKED_CLASS = 'is-stacked';
const INLINE_WIDTH = 'min(1600px, calc(100vw - 48px))';
const COLLISION_BUFFER_PX = 8;
const RETURN_BUFFER_PX = 24;

export const setupHeroTitleLayout = (): void => {
  const hero = query<HTMLElement>('.hero');
  const lockup = query<HTMLElement>('.title-lockup');
  const sushi = query<HTMLElement>('.title-word--sushi');
  const kicker = query<HTMLElement>('.title-kicker');
  const libre = query<HTMLElement>('.title-word--libre');

  if (!hero || !lockup || !sushi || !kicker || !libre) return;

  let scheduledFrame = 0;

  const measureInlineFit = (): { available: number; required: number } => {
    const wasStacked = lockup.classList.contains(STACKED_CLASS);
    const previousWidth = lockup.style.width;

    // Always measure the real single-line composition. The temporary changes are
    // restored within the same animation frame, before the browser paints.
    if (wasStacked) lockup.classList.remove(STACKED_CLASS);
    lockup.style.width = INLINE_WIDTH;

    const style = window.getComputedStyle(lockup);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const available = lockup.clientWidth;
    const required =
      sushi.getBoundingClientRect().width +
      kicker.getBoundingClientRect().width +
      libre.getBoundingClientRect().width +
      gap * 2;

    lockup.style.width = previousWidth;
    if (wasStacked) lockup.classList.add(STACKED_CLASS);

    return { available, required };
  };

  const syncLayout = (): void => {
    const wasStacked = lockup.classList.contains(STACKED_CLASS);
    const { available, required } = measureInlineFit();
    const buffer = wasStacked ? RETURN_BUFFER_PX : COLLISION_BUFFER_PX;
    const shouldStack = required + buffer > available;

    lockup.classList.toggle(STACKED_CLASS, shouldStack);
    lockup.style.width = shouldStack ? '' : INLINE_WIDTH;
  };

  const scheduleSync = (): void => {
    if (scheduledFrame) return;

    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = 0;
      syncLayout();
    });
  };

  scheduleSync();
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(hero);
  }

  document.fonts.ready.then(scheduleSync).catch(() => undefined);
};
