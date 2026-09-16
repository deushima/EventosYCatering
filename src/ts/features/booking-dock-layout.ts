import { query, queryAll } from '../shared/dom';

type DockLayoutMode = 'desktop' | 'compact' | 'mobile';

export const setupBookingDockLayout = (): void => {
  const dock = query<HTMLElement>('.booking-dock');
  const metadata = queryAll<HTMLElement>('.booking-dock__meta');
  const countdown = query<HTMLElement>('.countdown');
  const cta = query<HTMLElement>('.booking-dock__cta');
  const [venueMeta, dateMeta, timeMeta] = metadata;

  if (!dock || !venueMeta || !dateMeta || !timeMeta || !countdown || !cta) return;

  let activeMode: DockLayoutMode | null = null;
  let activeLiveState: boolean | null = null;
  let activeSuppressedState: boolean | null = null;
  let scheduledFrame = 0;

  const placeMetadata = ({
    row,
    padding
  }: {
    row: string;
    padding: string;
  }): void => {
    const placements = [
      { item: venueMeta, column: '1', justify: 'start' },
      { item: dateMeta, column: '2', justify: 'center' },
      { item: timeMeta, column: '3', justify: 'end' }
    ];

    placements.forEach(({ item, column, justify }) => {
      item.style.gridColumn = column;
      item.style.gridRow = row;
      item.style.justifySelf = justify;
      item.style.width = 'max-content';
      item.style.maxWidth = '100%';
      item.style.minWidth = '0';
      item.style.padding = padding;
    });
  };

  const applySingleRowLayout = ({
    width,
    suppressedWidth,
    countdownWidth,
    ctaWidth,
    ctaSuppressed
  }: {
    width: string;
    suppressedWidth: string;
    countdownWidth: string;
    ctaWidth: string;
    ctaSuppressed: boolean;
  }): void => {
    dock.style.width = ctaSuppressed ? suppressedWidth : width;
    dock.style.setProperty('--dock-cta-track', ctaSuppressed ? '0px' : ctaWidth);
    dock.style.gridTemplateColumns = `minmax(0, 1fr) max-content minmax(0, 1fr) ${countdownWidth} var(--dock-cta-track)`;
    dock.style.gridTemplateRows = 'minmax(0, 1fr)';
    dock.style.gap = '9px';
    dock.style.rowGap = '9px';

    placeMetadata({ row: '1', padding: '0 8px' });
    countdown.style.gridColumn = '4';
    countdown.style.gridRow = '1';
    cta.style.gridColumn = '5';
    cta.style.gridRow = '1';
  };

  const applyEventLiveSingleRowLayout = ({
    width,
    ctaWidth
  }: {
    width: string;
    ctaWidth: string;
  }): void => {
    dock.style.width = width;
    dock.style.setProperty('--dock-cta-track', ctaWidth);
    dock.style.gridTemplateColumns = `minmax(0, 1fr) max-content minmax(0, 1fr) var(--dock-cta-track)`;
    dock.style.gridTemplateRows = 'minmax(0, 1fr)';
    dock.style.gap = '9px';
    dock.style.rowGap = '9px';

    placeMetadata({ row: '1', padding: '0 8px' });
    countdown.style.gridColumn = '';
    countdown.style.gridRow = '';
    cta.style.gridColumn = '4';
    cta.style.gridRow = '1';
  };

  const applyDesktopLayout = (eventLive: boolean, ctaSuppressed: boolean): void => {
    if (eventLive) {
      applyEventLiveSingleRowLayout({
        width: 'min(760px, calc(100vw - 48px))',
        ctaWidth: '108px'
      });
      return;
    }

    applySingleRowLayout({
      width: 'min(1040px, calc(100vw - 48px))',
      suppressedWidth: 'min(923px, calc(100vw - 165px))',
      countdownWidth: 'minmax(0, 2.55fr)',
      ctaWidth: '108px',
      ctaSuppressed
    });
  };

  const applyCompactLayout = (eventLive: boolean, ctaSuppressed: boolean): void => {
    if (eventLive) {
      applyEventLiveSingleRowLayout({
        width: 'min(700px, calc(100vw - 32px))',
        ctaWidth: '104px'
      });
      return;
    }

    applySingleRowLayout({
      width: 'min(780px, calc(100vw - 32px))',
      suppressedWidth: 'min(667px, calc(100vw - 145px))',
      countdownWidth: 'minmax(0, 2.3fr)',
      ctaWidth: '104px',
      ctaSuppressed
    });
  };

  const applyMobileLayout = (eventLive: boolean, ctaSuppressed: boolean): void => {
    const suppressReservation = ctaSuppressed && !eventLive;
    dock.style.width = 'min(680px, calc(100vw - 24px))';
    dock.style.setProperty('--dock-cta-track', suppressReservation ? '0px' : '96px');
    dock.style.gridTemplateColumns = 'max-content max-content max-content minmax(0, 1fr) var(--dock-cta-track)';
    dock.style.gridTemplateRows = eventLive ? '48px' : '48px 96px';
    dock.style.columnGap = '12px';
    dock.style.rowGap = '8px';

    placeMetadata({ row: '1', padding: '0 4px' });
    venueMeta.style.justifySelf = 'start';
    dateMeta.style.justifySelf = 'start';
    timeMeta.style.justifySelf = 'start';
    countdown.style.gridColumn = '1 / span 4';
    countdown.style.gridRow = '2';
    cta.style.gridColumn = '5';
    cta.style.gridRow = eventLive ? '1' : '1 / span 2';
  };

  const resolveMode = (): DockLayoutMode => {
    if (window.matchMedia('(max-width: 840px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 1100px)').matches) return 'compact';
    return 'desktop';
  };

  const syncLayout = (): void => {
    const nextMode = resolveMode();
    const nextLiveState = dock.classList.contains('is-event-live');
    const nextSuppressedState = dock.classList.contains('is-cta-suppressed') && !nextLiveState;
    if (
      nextMode === activeMode
      && nextLiveState === activeLiveState
      && nextSuppressedState === activeSuppressedState
    ) return;

    activeMode = nextMode;
    activeLiveState = nextLiveState;
    activeSuppressedState = nextSuppressedState;
    if (nextMode === 'mobile') applyMobileLayout(nextLiveState, nextSuppressedState);
    else if (nextMode === 'compact') applyCompactLayout(nextLiveState, nextSuppressedState);
    else applyDesktopLayout(nextLiveState, nextSuppressedState);
  };

  const scheduleSync = (): void => {
    if (scheduledFrame) return;

    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = 0;
      syncLayout();
    });
  };

  syncLayout();
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(dock);
  }

  if ('MutationObserver' in window) {
    const observer = new MutationObserver(scheduleSync);
    observer.observe(dock, { attributes: true, attributeFilter: ['class'] });
  }

  document.fonts.ready.then(scheduleSync).catch(() => undefined);
};
