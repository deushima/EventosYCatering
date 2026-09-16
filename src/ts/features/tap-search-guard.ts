const TAP_MAX_DURATION = 380;
const TAP_MOVEMENT_TOLERANCE = 12;
const SELECTION_SUPPRESSION_DURATION = 700;

interface TouchGesture {
  identifier: number;
  startedAt: number;
  startX: number;
  startY: number;
  moved: boolean;
  target: Element;
}

const getElement = (target: EventTarget | Node | null): Element | null => {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const isEditableTarget = (target: Element | null): boolean => Boolean(target?.closest(
  'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
));

const findTouch = (touches: TouchList, identifier: number): Touch | null => {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
};

export const setupTapSearchGuard = (): void => {
  if (navigator.maxTouchPoints <= 0) return;

  let gesture: TouchGesture | null = null;
  let suppressSelectionUntil = 0;
  let suppressedTarget: Element | null = null;
  let cleanupTimer = 0;

  const selectionSuppressionIsActive = (): boolean =>
    performance.now() <= suppressSelectionUntil;

  const clearSuppression = (): void => {
    suppressSelectionUntil = 0;
    suppressedTarget = null;
    if (cleanupTimer) {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = 0;
    }
  };

  const selectionTouchesSuppressedTarget = (): boolean => {
    if (!suppressedTarget) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return true;

    const anchor = getElement(selection.anchorNode);
    const focus = getElement(selection.focusNode);
    return [anchor, focus].some((element) => Boolean(
      element && (
        suppressedTarget?.contains(element) ||
        element.contains(suppressedTarget)
      )
    ));
  };

  const clearTapSelection = (): void => {
    if (!selectionSuppressionIsActive()) return;
    if (!selectionTouchesSuppressedTarget()) return;

    const selection = window.getSelection();
    if (selection?.rangeCount) selection.removeAllRanges();
  };

  const armSelectionSuppression = (target: Element): void => {
    if (isEditableTarget(target)) return;

    suppressSelectionUntil = performance.now() + SELECTION_SUPPRESSION_DURATION;
    suppressedTarget = target;

    clearTapSelection();
    queueMicrotask(clearTapSelection);
    window.requestAnimationFrame(() => {
      clearTapSelection();
      window.requestAnimationFrame(clearTapSelection);
    });
    window.setTimeout(clearTapSelection, 80);
    window.setTimeout(clearTapSelection, 240);

    if (cleanupTimer) window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(clearSuppression, SELECTION_SUPPRESSION_DURATION + 40);
  };

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      gesture = null;
      clearSuppression();
      return;
    }

    const touch = event.touches.item(0);
    const target = getElement(event.target);
    if (!touch || !target || isEditableTarget(target)) {
      gesture = null;
      return;
    }

    gesture = {
      identifier: touch.identifier,
      startedAt: performance.now(),
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
      target
    };
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (event) => {
    if (!gesture) return;

    const touch = findTouch(event.touches, gesture.identifier);
    if (!touch) {
      gesture = null;
      return;
    }

    const distance = Math.hypot(
      touch.clientX - gesture.startX,
      touch.clientY - gesture.startY
    );
    if (distance > TAP_MOVEMENT_TOLERANCE) gesture.moved = true;
  }, { passive: true, capture: true });

  document.addEventListener('touchend', (event) => {
    if (!gesture) return;

    const completedGesture = gesture;
    gesture = null;
    const touch = findTouch(event.changedTouches, completedGesture.identifier);
    if (!touch) return;

    const duration = performance.now() - completedGesture.startedAt;
    const distance = Math.hypot(
      touch.clientX - completedGesture.startX,
      touch.clientY - completedGesture.startY
    );

    if (
      duration <= TAP_MAX_DURATION &&
      !completedGesture.moved &&
      distance <= TAP_MOVEMENT_TOLERANCE
    ) {
      armSelectionSuppression(completedGesture.target);
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', () => {
    gesture = null;
  }, { passive: true, capture: true });

  document.addEventListener('selectstart', (event) => {
    if (!selectionSuppressionIsActive()) return;

    const target = getElement(event.target);
    if (!target || isEditableTarget(target) || !suppressedTarget) return;
    if (
      !suppressedTarget.contains(target) &&
      !target.contains(suppressedTarget)
    ) {
      return;
    }

    if (event.cancelable) event.preventDefault();
    clearTapSelection();
  }, { capture: true });

  document.addEventListener('selectionchange', clearTapSelection);
};
