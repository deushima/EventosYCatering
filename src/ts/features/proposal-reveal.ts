import { query, queryAll } from '../shared/dom';

const RESPONSIVE_REVEAL_QUERY = '(max-width: 840px)';
const DESKTOP_REVEAL_RATIO = 0.82;
const REVEAL_DOCK_GAP_PX = 16;
const MIN_VISIBLE_PX = 12;
const MAX_VISIBLE_PX = 28;
const VISIBLE_RATIO = 0.08;

const reveal = (element: HTMLElement): void => {
  if (element.classList.contains('is-visible')) return;
  element.classList.remove('is-reveal-bypassed');
  element.classList.add('is-visible');
};

const bypassReveal = (element: HTMLElement): void => {
  element.classList.add('is-visible', 'is-reveal-bypassed');
};

const getViewportBottom = (): number => {
  const viewport = window.visualViewport;
  return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
};

const getRevealBoundary = (
  dock: HTMLElement | null,
  responsiveReveal: MediaQueryList
): number => {
  const viewportBottom = getViewportBottom();

  if (!responsiveReveal.matches || !dock) {
    return viewportBottom * DESKTOP_REVEAL_RATIO;
  }

  const dockBounds = dock.getBoundingClientRect();
  const dockIsFixed = window.getComputedStyle(dock).position === 'fixed';
  const dockOverlapsViewport = dockBounds.bottom > 0 && dockBounds.top < viewportBottom;

  if (!dockIsFixed || !dockOverlapsViewport) {
    return viewportBottom * DESKTOP_REVEAL_RATIO;
  }

  return Math.max(0, dockBounds.top - REVEAL_DOCK_GAP_PX);
};

const hasCrossedRevealBoundary = (element: HTMLElement, boundary: number): boolean => {
  const bounds = element.getBoundingClientRect();
  const visibleDistance = Math.min(
    MAX_VISIBLE_PX,
    Math.max(MIN_VISIBLE_PX, bounds.height * VISIBLE_RATIO)
  );

  return bounds.bottom > 0 && bounds.top + visibleDistance <= boundary;
};

export const setupProposalReveal = (): void => {
  const root = document.documentElement;
  const proposalRoot = query<HTMLElement>('[data-proposal-root]');

  root.setAttribute('data-proposal-reveal-ready', '');
  if (!proposalRoot) return;

  const targets = queryAll<HTMLElement>('[data-proposal-reveal]', proposalRoot);
  if (!targets.length) return;

  const dock = query<HTMLElement>('.booking-dock');
  const responsiveReveal = window.matchMedia(RESPONSIVE_REVEAL_QUERY);
  const visualViewport = window.visualViewport;
  const pendingTargets = new Set(targets);
  let updateFrame = 0;

  const revealVisibleTargets = (): void => {
    updateFrame = 0;
    const boundary = getRevealBoundary(dock, responsiveReveal);

    pendingTargets.forEach((element) => {
      if (element.classList.contains('is-visible')) {
        pendingTargets.delete(element);
        return;
      }

      if (!hasCrossedRevealBoundary(element, boundary)) return;
      reveal(element);
      pendingTargets.delete(element);
    });

    if (!pendingTargets.size) removeListeners();
  };

  const scheduleUpdate = (): void => {
    if (updateFrame) return;
    updateFrame = window.requestAnimationFrame(revealVisibleTargets);
  };

  const removeListeners = (): void => {
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    responsiveReveal.removeEventListener('change', scheduleUpdate);
    visualViewport?.removeEventListener('resize', scheduleUpdate);
    visualViewport?.removeEventListener('scroll', scheduleUpdate);
  };

  if (root.classList.contains('proposal-reveal-fallback')) {
    const boundary = getRevealBoundary(dock, responsiveReveal);

    pendingTargets.forEach((element) => {
      if (!hasCrossedRevealBoundary(element, boundary)) return;
      bypassReveal(element);
      pendingTargets.delete(element);
    });

    root.classList.remove('proposal-reveal-fallback');
  }

  if (!pendingTargets.size) return;

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  responsiveReveal.addEventListener('change', scheduleUpdate);
  visualViewport?.addEventListener('resize', scheduleUpdate, { passive: true });
  visualViewport?.addEventListener('scroll', scheduleUpdate, { passive: true });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(revealVisibleTargets);
  });
};
