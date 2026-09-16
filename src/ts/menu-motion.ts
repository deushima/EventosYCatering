import { query, queryAll } from './shared/dom';

type RevealType = 'intro' | 'item';

interface RevealCandidate {
  element: HTMLElement;
  type: RevealType;
  delay: number;
}

interface StickyExitTarget {
  heading: HTMLElement;
  sentinel: HTMLElement;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = window.matchMedia('(max-width: 720px)');
const easeOut = 'cubic-bezier(.22, 1, .36, 1)';
const menuGroups = query<HTMLElement>('[data-menu-groups]');
const menuIntroHeading = query<HTMLElement>('.menu-section__intro h2');
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

if (menuGroups) {
  query<HTMLElement>('.menu-mobile-sticky')?.remove();

  let revealObserver: IntersectionObserver | null = null;
  let stickyExitFrame = 0;

  const groups = queryAll<HTMLElement>('[data-menu-group]', menuGroups);
  const stickyExitTargets = groups.flatMap((group): StickyExitTarget[] => {
    const heading = query<HTMLElement>('.menu-group__heading', group);
    const sentinel = query<HTMLElement>('.menu-group__exit-sentinel', group);
    return heading && sentinel ? [{ heading, sentinel }] : [];
  });

  const animateOnce = (
    element: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ): void => {
    const animation = element.animate(keyframes, {
      fill: 'both',
      ...options
    });

    animation.addEventListener('finish', () => {
      element.style.opacity = '1';
      element.style.transform = 'translate3d(0, 0, 0)';
      animation.cancel();
    }, { once: true });
  };

  const setupScrollReveals = (): void => {
    revealObserver?.disconnect();
    revealObserver = null;
    if (!('IntersectionObserver' in window)) return;

    const candidates: RevealCandidate[] = [];
    if (menuIntroHeading && !menuIntroHeading.dataset.motionReady) {
      menuIntroHeading.dataset.motionReady = 'true';
      candidates.push({ element: menuIntroHeading, type: 'intro', delay: 0 });
    }

    groups.forEach((group) => {
      queryAll<HTMLElement>('.menu-item', group).slice(0, 3).forEach((item, index) => {
        if (item.dataset.motionReady) return;
        item.dataset.motionReady = 'true';
        candidates.push({
          element: item,
          type: 'item',
          delay: reducedMotion.matches ? 0 : index * 40
        });
      });
    });

    if (!candidates.length) return;

    const candidateByElement = new Map<HTMLElement, RevealCandidate>();
    candidates.forEach((candidate) => {
      candidateByElement.set(candidate.element, candidate);
      candidate.element.style.opacity = '0';
      candidate.element.style.transform = reducedMotion.matches
        ? 'translate3d(0, 3px, 0)'
        : candidate.type === 'intro'
          ? 'translate3d(0, 14px, 0)'
          : 'translate3d(0, 8px, 0)';
    });

    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        const candidate = candidateByElement.get(element);
        if (!candidate) return;

        observer.unobserve(element);
        const isIntro = candidate.type === 'intro';
        const duration = reducedMotion.matches ? 150 : isIntro ? 360 : 260;
        const distance = reducedMotion.matches ? 3 : isIntro ? 14 : 8;

        animateOnce(element, [
          { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ], {
          duration,
          delay: candidate.delay,
          easing: easeOut
        });
      });
    }, {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.08
    });

    candidates.forEach(({ element }) => revealObserver?.observe(element));
  };

  const updateStickyExitProgress = (): void => {
    stickyExitFrame = 0;

    stickyExitTargets.forEach(({ heading, sentinel }) => {
      let progress = 0;

      if (mobileQuery.matches) {
        const computed = window.getComputedStyle(heading);
        const stickyTop = Number.parseFloat(computed.top || '0') || 0;
        const headingHeight = Math.max(1, heading.getBoundingClientRect().height);
        const triggerLine = stickyTop + headingHeight;
        const sentinelTop = sentinel.getBoundingClientRect().top;
        progress = clamp((triggerLine - sentinelTop) / headingHeight, 0, 1);
      }

      heading.style.setProperty(
        '--menu-heading-exit-offset',
        `${(-progress * 100).toFixed(3)}%`
      );
    });
  };

  const scheduleStickyExitUpdate = (): void => {
    if (stickyExitFrame) return;
    stickyExitFrame = window.requestAnimationFrame(updateStickyExitProgress);
  };

  if (groups.length) {
    setupScrollReveals();
    scheduleStickyExitUpdate();
  }

  mobileQuery.addEventListener('change', scheduleStickyExitUpdate);
  window.addEventListener('scroll', scheduleStickyExitUpdate, { passive: true });
  window.addEventListener('resize', scheduleStickyExitUpdate, { passive: true });
  document.fonts.ready.then(scheduleStickyExitUpdate).catch(() => undefined);
}
