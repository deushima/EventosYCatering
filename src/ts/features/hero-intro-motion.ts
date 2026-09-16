import { queryAll } from '../shared/dom';

const HERO_TITLE_ANIMATIONS = new Set(['stage-title-in', 'quiet-fade']);
const COMPLETION_FALLBACK_MS = 3400;

export const setupHeroIntroMotion = (): void => {
  const root = document.documentElement;
  const titleWords = queryAll<HTMLElement>('.title-word');
  if (!titleWords.length) return;

  let pending = new Set<HTMLElement>(titleWords);
  let fallbackTimer = 0;

  const cleanupListeners = (): void => {
    titleWords.forEach((element) => {
      element.removeEventListener('animationend', handleAnimationCompletion);
      element.removeEventListener('animationcancel', handleAnimationCompletion);
    });
  };

  const complete = (): void => {
    if (root.classList.contains('hero-intro-complete')) return;
    root.classList.add('hero-intro-complete');
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    cleanupListeners();
  };

  function handleAnimationCompletion(event: AnimationEvent): void {
    if (!HERO_TITLE_ANIMATIONS.has(event.animationName)) return;
    pending.delete(event.currentTarget as HTMLElement);
    if (!pending.size) complete();
  }

  titleWords.forEach((element) => {
    element.addEventListener('animationend', handleAnimationCompletion);
    element.addEventListener('animationcancel', handleAnimationCompletion);
  });

  window.requestAnimationFrame(() => {
    const animated = titleWords.filter((element) =>
      window.getComputedStyle(element).animationName
        .split(',')
        .map((name) => name.trim())
        .some((name) => HERO_TITLE_ANIMATIONS.has(name))
    );

    pending = new Set(animated);
    if (!pending.size) complete();
  });

  fallbackTimer = window.setTimeout(complete, COMPLETION_FALLBACK_MS);
};
