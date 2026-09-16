import { query } from '../shared/dom';

type CountdownKey = 'days' | 'hours' | 'minutes' | 'seconds';

const keys: CountdownKey[] = ['days', 'hours', 'minutes', 'seconds'];
const target = new Date('2026-09-03T20:00:00-03:00').getTime();
const FINAL_CTA_DOCK_CLEARANCE_PX = 8;

const replaceCtaLabel = (label: HTMLElement, firstLine: string, secondLine: string): void => {
  label.replaceChildren(
    document.createTextNode(firstLine),
    document.createElement('br'),
    document.createTextNode(secondLine)
  );
};

export const setupCountdown = (): void => {
  const countdown = query<HTMLElement>('.countdown');
  const dock = query<HTMLElement>('.booking-dock');
  const cta = query<HTMLAnchorElement>('[data-booking-cta]');
  const ctaLabel = query<HTMLElement>('[data-booking-cta-label]', cta ?? undefined);
  const menu = query<HTMLElement>('#menu');
  const finalMenuCtaAction = query<HTMLElement>('.menu-final-cta__action');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let menuMode = false;
  let finalMenuCtaActionPassedDock = false;
  let visibilityFrame = 0;

  const nodes: Record<CountdownKey, HTMLElement | null> = {
    days: query<HTMLElement>('[data-countdown="days"]'),
    hours: query<HTMLElement>('[data-countdown="hours"]'),
    minutes: query<HTMLElement>('[data-countdown="minutes"]'),
    seconds: query<HTMLElement>('[data-countdown="seconds"]')
  };

  const syncDockCtaVisibility = (): void => {
    if (!cta) return;
    const shouldSuppress = finalMenuCtaActionPassedDock && !menuMode;
    cta.classList.toggle('is-suppressed', shouldSuppress);
    dock?.classList.toggle('is-cta-suppressed', shouldSuppress);
    if (shouldSuppress) cta.setAttribute('tabindex', '-1');
    else cta.removeAttribute('tabindex');
  };

  const hasFinalMenuCtaActionPassedDock = (): boolean => {
    if (!finalMenuCtaAction || !dock) return false;

    const actionRect = finalMenuCtaAction.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();

    return actionRect.bottom <= dockRect.top - FINAL_CTA_DOCK_CLEARANCE_PX;
  };

  const syncFinalMenuCtaActionPosition = (): void => {
    const nextPassedState = hasFinalMenuCtaActionPassedDock();
    if (nextPassedState === finalMenuCtaActionPassedDock) return;
    finalMenuCtaActionPassedDock = nextPassedState;
    syncDockCtaVisibility();
  };

  const scheduleFinalMenuCtaActionPositionSync = (): void => {
    if (visibilityFrame) return;
    visibilityFrame = window.requestAnimationFrame(() => {
      visibilityFrame = 0;
      syncFinalMenuCtaActionPosition();
    });
  };

  if (finalMenuCtaAction && dock) {
    syncFinalMenuCtaActionPosition();

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(scheduleFinalMenuCtaActionPositionSync, {
        threshold: [0, 0.25, 0.5, 0.75, 1]
      });
      observer.observe(finalMenuCtaAction);
    }

    window.addEventListener('scroll', scheduleFinalMenuCtaActionPositionSync, { passive: true });
    window.addEventListener('resize', scheduleFinalMenuCtaActionPositionSync, { passive: true });
    window.addEventListener('orientationchange', scheduleFinalMenuCtaActionPositionSync, { passive: true });
  }

  const handleMenuClick = (event: MouseEvent): void => {
    if (!menu) return;
    event.preventDefault();
    menu.scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    window.history.replaceState(null, '', '#menu');
  };

  const activateMenuMode = (): void => {
    if (menuMode || !cta || !ctaLabel) return;
    menuMode = true;
    document.documentElement.classList.add('event-live');
    dock?.classList.add('is-event-live');
    cta.href = '#menu';
    cta.dataset.destination = 'menu';
    cta.setAttribute('aria-label', 'Ir al menú');
    replaceCtaLabel(ctaLabel, 'IR A', 'MENÚ');
    cta.addEventListener('click', handleMenuClick);
    countdown?.setAttribute('aria-label', 'El evento comenzó');
    countdown?.setAttribute('data-state', 'complete');
    syncDockCtaVisibility();
  };

  const pad = (value: number): string => String(value).padStart(2, '0');

  const render = (): number => {
    const remaining = Math.max(0, target - Date.now());
    const values: Record<CountdownKey, number> = {
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1_000)
    };

    keys.forEach((key) => {
      const node = nodes[key];
      const nextValue = pad(values[key]);
      if (node && node.textContent !== nextValue) node.textContent = nextValue;
    });

    if (remaining === 0) activateMenuMode();
    return remaining;
  };

  if (render() <= 0) return;
  const timerId = window.setInterval(() => {
    if (render() === 0) window.clearInterval(timerId);
  }, 1_000);
};
