import type { RuntimeContext } from '../shared/runtime';

export const setupEfficientSmoothScroll = ({
  isFirefox,
  reducedMotion
}: RuntimeContext): void => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reducedMotion.matches || isFirefox || !finePointer.matches) return;

  let targetY = window.scrollY;
  let frameId = 0;

  const maximumScroll = (): number => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

  const stop = (): void => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    targetY = window.scrollY;
  };

  const step = (): void => {
    const currentY = window.scrollY;
    const distance = targetY - currentY;

    if (Math.abs(distance) < 0.6) {
      window.scrollTo(0, targetY);
      frameId = 0;
      return;
    }

    window.scrollTo(0, currentY + distance * 0.24);
    frameId = window.requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const isCoarseWheel = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 50;
    if (!isCoarseWheel) return;

    event.preventDefault();
    if (!frameId) targetY = window.scrollY;

    const unit = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? window.innerHeight
        : 1;
    const delta = clamp(event.deltaY * unit, -240, 240);
    targetY = clamp(targetY + delta * 0.9, 0, maximumScroll());
    if (!frameId) frameId = window.requestAnimationFrame(step);
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerdown', stop, { passive: true });
  window.addEventListener('resize', () => {
    targetY = clamp(targetY, 0, maximumScroll());
  }, { passive: true });
  window.addEventListener('scroll', () => {
    if (!frameId) targetY = window.scrollY;
  }, { passive: true });
};
