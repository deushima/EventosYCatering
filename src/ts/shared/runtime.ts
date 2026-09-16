export interface RuntimeContext {
  root: HTMLElement;
  isFirefox: boolean;
  coarsePointer: MediaQueryList;
  compactViewport: MediaQueryList;
  reducedMotion: MediaQueryList;
}

export const createRuntimeContext = (): RuntimeContext => {
  const root = document.documentElement;
  const isFirefox = /Firefox\//i.test(navigator.userAgent);
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const compactViewport = window.matchMedia('(max-width: 820px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  root.classList.toggle('is-firefox', isFirefox);
  root.classList.toggle('is-coarse-pointer', coarsePointer.matches);
  coarsePointer.addEventListener('change', ({ matches }) => {
    root.classList.toggle('is-coarse-pointer', matches);
  });

  return {
    root,
    isFirefox,
    coarsePointer,
    compactViewport,
    reducedMotion
  };
};
