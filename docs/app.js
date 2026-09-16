"use strict";
(() => {
  // src/ts/shared/dom.ts
  var query = (selector, root = document) => root.querySelector(selector);
  var queryAll = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  var setStyles = (element, styles) => {
    Object.assign(element.style, styles);
  };

  // src/ts/features/booking-cta-sheen.ts
  var setupBookingCtaSheen = ({
    reducedMotion: reducedMotion2,
    compactViewport,
    coarsePointer
  }) => {
    const selectedCta = query("[data-booking-cta]");
    if (!selectedCta || reducedMotion2.matches || typeof selectedCta.animate !== "function") return;
    const cta = selectedCta;
    cta.style.filter = "none";
    cta.classList.add("has-runtime-sheen");
    const sheen = document.createElement("i");
    sheen.setAttribute("aria-hidden", "true");
    setStyles(sheen, {
      position: "absolute",
      zIndex: "1",
      top: "-48%",
      bottom: "-48%",
      left: "0",
      width: "88%",
      opacity: "0",
      pointerEvents: "none",
      transform: "translate3d(-145%, 0, 0) skewX(-18deg)",
      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.05) 10%, rgba(255,255,255,.18) 24%, rgba(255,255,255,.46) 42%, rgba(255,255,255,.82) 50%, rgba(255,255,255,.46) 58%, rgba(255,255,255,.18) 76%, rgba(255,255,255,.05) 90%, transparent 100%)",
      filter: "blur(6px)",
      willChange: "transform, opacity"
    });
    cta.prepend(sheen);
    const initialDelay = 1500;
    const regularDelay = 7400;
    const duration = compactViewport.matches || coarsePointer.matches ? 1450 : 1800;
    let timerId = 0;
    let activeAnimation = null;
    let activeGlow = null;
    let interactionArmed = true;
    let initialPending = true;
    const clearTimer = () => {
      if (!timerId) return;
      window.clearTimeout(timerId);
      timerId = 0;
    };
    const scheduleRegularLoop = (delay = regularDelay) => {
      clearTimer();
      timerId = window.setTimeout(() => {
        timerId = 0;
        runSheen();
      }, delay);
    };
    function runSheen() {
      clearTimer();
      activeAnimation?.cancel();
      activeGlow?.cancel();
      const animation = sheen.animate([
        { transform: "translate3d(-145%, 0, 0) skewX(-18deg)", opacity: 0 },
        { transform: "translate3d(-122%, 0, 0) skewX(-18deg)", opacity: 0, offset: 0.1 },
        { transform: "translate3d(-78%, 0, 0) skewX(-18deg)", opacity: 0.82, offset: 0.28 },
        { transform: "translate3d(172%, 0, 0) skewX(-18deg)", opacity: 0.58, offset: 0.82 },
        { transform: "translate3d(215%, 0, 0) skewX(-18deg)", opacity: 0 }
      ], {
        duration,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "none"
      });
      const glow = cta.animate([
        { boxShadow: "0 0 0 rgba(0,26,197,0)", filter: "brightness(1)" },
        { boxShadow: "0 0 0 rgba(0,26,197,0)", filter: "brightness(1)", offset: 0.18 },
        { boxShadow: "0 0 28px rgba(0,26,197,.34)", filter: "brightness(1.08)", offset: 0.55 },
        { boxShadow: "0 0 0 rgba(0,26,197,0)", filter: "brightness(1)" }
      ], {
        duration,
        easing: "ease-in-out",
        fill: "none"
      });
      activeAnimation = animation;
      activeGlow = glow;
      animation.addEventListener("finish", () => {
        if (activeAnimation === animation) activeAnimation = null;
        if (activeGlow === glow) activeGlow = null;
        scheduleRegularLoop();
      }, { once: true });
    }
    const triggerInteractionSheen = () => {
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
    cta.addEventListener("pointerenter", triggerInteractionSheen, { passive: true });
    cta.addEventListener("pointerleave", () => {
      interactionArmed = true;
    }, { passive: true });
    cta.addEventListener("focus", triggerInteractionSheen);
    cta.addEventListener("blur", () => {
      interactionArmed = true;
    });
    document.addEventListener("visibilitychange", () => {
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

  // src/ts/features/booking-dock-layout.ts
  var setupBookingDockLayout = () => {
    const dock2 = query(".booking-dock");
    const metadata = queryAll(".booking-dock__meta");
    const countdown = query(".countdown");
    const cta = query(".booking-dock__cta");
    const [venueMeta, dateMeta, timeMeta] = metadata;
    if (!dock2 || !venueMeta || !dateMeta || !timeMeta || !countdown || !cta) return;
    let activeMode = null;
    let activeLiveState = null;
    let activeSuppressedState = null;
    let scheduledFrame = 0;
    const placeMetadata = ({
      row,
      padding
    }) => {
      const placements = [
        { item: venueMeta, column: "1", justify: "start" },
        { item: dateMeta, column: "2", justify: "center" },
        { item: timeMeta, column: "3", justify: "end" }
      ];
      placements.forEach(({ item, column, justify }) => {
        item.style.gridColumn = column;
        item.style.gridRow = row;
        item.style.justifySelf = justify;
        item.style.width = "max-content";
        item.style.maxWidth = "100%";
        item.style.minWidth = "0";
        item.style.padding = padding;
      });
    };
    const applySingleRowLayout = ({
      width,
      suppressedWidth,
      countdownWidth,
      ctaWidth,
      ctaSuppressed
    }) => {
      dock2.style.width = ctaSuppressed ? suppressedWidth : width;
      dock2.style.setProperty("--dock-cta-track", ctaSuppressed ? "0px" : ctaWidth);
      dock2.style.gridTemplateColumns = `minmax(0, 1fr) max-content minmax(0, 1fr) ${countdownWidth} var(--dock-cta-track)`;
      dock2.style.gridTemplateRows = "minmax(0, 1fr)";
      dock2.style.gap = "9px";
      dock2.style.rowGap = "9px";
      placeMetadata({ row: "1", padding: "0 8px" });
      countdown.style.gridColumn = "4";
      countdown.style.gridRow = "1";
      cta.style.gridColumn = "5";
      cta.style.gridRow = "1";
    };
    const applyEventLiveSingleRowLayout = ({
      width,
      ctaWidth
    }) => {
      dock2.style.width = width;
      dock2.style.setProperty("--dock-cta-track", ctaWidth);
      dock2.style.gridTemplateColumns = `minmax(0, 1fr) max-content minmax(0, 1fr) var(--dock-cta-track)`;
      dock2.style.gridTemplateRows = "minmax(0, 1fr)";
      dock2.style.gap = "9px";
      dock2.style.rowGap = "9px";
      placeMetadata({ row: "1", padding: "0 8px" });
      countdown.style.gridColumn = "";
      countdown.style.gridRow = "";
      cta.style.gridColumn = "4";
      cta.style.gridRow = "1";
    };
    const applyDesktopLayout = (eventLive, ctaSuppressed) => {
      if (eventLive) {
        applyEventLiveSingleRowLayout({
          width: "min(760px, calc(100vw - 48px))",
          ctaWidth: "108px"
        });
        return;
      }
      applySingleRowLayout({
        width: "min(1040px, calc(100vw - 48px))",
        suppressedWidth: "min(923px, calc(100vw - 165px))",
        countdownWidth: "minmax(0, 2.55fr)",
        ctaWidth: "108px",
        ctaSuppressed
      });
    };
    const applyCompactLayout = (eventLive, ctaSuppressed) => {
      if (eventLive) {
        applyEventLiveSingleRowLayout({
          width: "min(700px, calc(100vw - 32px))",
          ctaWidth: "104px"
        });
        return;
      }
      applySingleRowLayout({
        width: "min(780px, calc(100vw - 32px))",
        suppressedWidth: "min(667px, calc(100vw - 145px))",
        countdownWidth: "minmax(0, 2.3fr)",
        ctaWidth: "104px",
        ctaSuppressed
      });
    };
    const applyMobileLayout = (eventLive, ctaSuppressed) => {
      const suppressReservation = ctaSuppressed && !eventLive;
      dock2.style.width = "min(680px, calc(100vw - 24px))";
      dock2.style.setProperty("--dock-cta-track", suppressReservation ? "0px" : "96px");
      dock2.style.gridTemplateColumns = "max-content max-content max-content minmax(0, 1fr) var(--dock-cta-track)";
      dock2.style.gridTemplateRows = eventLive ? "48px" : "48px 96px";
      dock2.style.columnGap = "12px";
      dock2.style.rowGap = "8px";
      placeMetadata({ row: "1", padding: "0 4px" });
      venueMeta.style.justifySelf = "start";
      dateMeta.style.justifySelf = "start";
      timeMeta.style.justifySelf = "start";
      countdown.style.gridColumn = "1 / span 4";
      countdown.style.gridRow = "2";
      cta.style.gridColumn = "5";
      cta.style.gridRow = eventLive ? "1" : "1 / span 2";
    };
    const resolveMode = () => {
      if (window.matchMedia("(max-width: 840px)").matches) return "mobile";
      if (window.matchMedia("(max-width: 1100px)").matches) return "compact";
      return "desktop";
    };
    const syncLayout = () => {
      const nextMode = resolveMode();
      const nextLiveState = dock2.classList.contains("is-event-live");
      const nextSuppressedState = dock2.classList.contains("is-cta-suppressed") && !nextLiveState;
      if (nextMode === activeMode && nextLiveState === activeLiveState && nextSuppressedState === activeSuppressedState) return;
      activeMode = nextMode;
      activeLiveState = nextLiveState;
      activeSuppressedState = nextSuppressedState;
      if (nextMode === "mobile") applyMobileLayout(nextLiveState, nextSuppressedState);
      else if (nextMode === "compact") applyCompactLayout(nextLiveState, nextSuppressedState);
      else applyDesktopLayout(nextLiveState, nextSuppressedState);
    };
    const scheduleSync = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        syncLayout();
      });
    };
    syncLayout();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(scheduleSync);
      observer.observe(dock2);
    }
    if ("MutationObserver" in window) {
      const observer = new MutationObserver(scheduleSync);
      observer.observe(dock2, { attributes: true, attributeFilter: ["class"] });
    }
    document.fonts.ready.then(scheduleSync).catch(() => void 0);
  };

  // src/ts/features/hero-intro-motion.ts
  var HERO_TITLE_ANIMATIONS = /* @__PURE__ */ new Set(["stage-title-in", "quiet-fade"]);
  var COMPLETION_FALLBACK_MS = 3400;
  var setupHeroIntroMotion = () => {
    const root = document.documentElement;
    const titleWords = queryAll(".title-word");
    if (!titleWords.length) return;
    let pending = new Set(titleWords);
    let fallbackTimer = 0;
    const cleanupListeners = () => {
      titleWords.forEach((element) => {
        element.removeEventListener("animationend", handleAnimationCompletion);
        element.removeEventListener("animationcancel", handleAnimationCompletion);
      });
    };
    const complete = () => {
      if (root.classList.contains("hero-intro-complete")) return;
      root.classList.add("hero-intro-complete");
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      cleanupListeners();
    };
    function handleAnimationCompletion(event) {
      if (!HERO_TITLE_ANIMATIONS.has(event.animationName)) return;
      pending.delete(event.currentTarget);
      if (!pending.size) complete();
    }
    titleWords.forEach((element) => {
      element.addEventListener("animationend", handleAnimationCompletion);
      element.addEventListener("animationcancel", handleAnimationCompletion);
    });
    window.requestAnimationFrame(() => {
      const animated = titleWords.filter(
        (element) => window.getComputedStyle(element).animationName.split(",").map((name) => name.trim()).some((name) => HERO_TITLE_ANIMATIONS.has(name))
      );
      pending = new Set(animated);
      if (!pending.size) complete();
    });
    fallbackTimer = window.setTimeout(complete, COMPLETION_FALLBACK_MS);
  };

  // src/ts/features/hero-title-layout.ts
  var STACKED_CLASS = "is-stacked";
  var INLINE_WIDTH = "min(1600px, calc(100vw - 48px))";
  var COLLISION_BUFFER_PX = 8;
  var RETURN_BUFFER_PX = 24;
  var setupHeroTitleLayout = () => {
    const hero = query(".hero");
    const lockup = query(".title-lockup");
    const sushi = query(".title-word--sushi");
    const kicker = query(".title-kicker");
    const libre = query(".title-word--libre");
    if (!hero || !lockup || !sushi || !kicker || !libre) return;
    let scheduledFrame = 0;
    const measureInlineFit = () => {
      const wasStacked = lockup.classList.contains(STACKED_CLASS);
      const previousWidth = lockup.style.width;
      if (wasStacked) lockup.classList.remove(STACKED_CLASS);
      lockup.style.width = INLINE_WIDTH;
      const style = window.getComputedStyle(lockup);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const available = lockup.clientWidth;
      const required = sushi.getBoundingClientRect().width + kicker.getBoundingClientRect().width + libre.getBoundingClientRect().width + gap * 2;
      lockup.style.width = previousWidth;
      if (wasStacked) lockup.classList.add(STACKED_CLASS);
      return { available, required };
    };
    const syncLayout = () => {
      const wasStacked = lockup.classList.contains(STACKED_CLASS);
      const { available, required } = measureInlineFit();
      const buffer = wasStacked ? RETURN_BUFFER_PX : COLLISION_BUFFER_PX;
      const shouldStack = required + buffer > available;
      lockup.classList.toggle(STACKED_CLASS, shouldStack);
      lockup.style.width = shouldStack ? "" : INLINE_WIDTH;
    };
    const scheduleSync = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        syncLayout();
      });
    };
    scheduleSync();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(scheduleSync);
      observer.observe(hero);
    }
    document.fonts.ready.then(scheduleSync).catch(() => void 0);
  };

  // src/ts/features/piece-viewer.ts
  var LOADING_MESSAGE = "CARGANDO IMAGEN";
  var ERROR_MESSAGE = "IMAGEN NO DISPONIBLE";
  var CLOSE_FALLBACK_MS = 320;
  var REDUCED_CLOSE_FALLBACK_MS = 170;
  var PRELOAD_CONCURRENCY = 3;
  var SCROLL_KEYS = /* @__PURE__ */ new Set([
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "End",
    "Home",
    "PageDown",
    "PageUp",
    " ",
    "Spacebar"
  ]);
  var isInteractiveTarget = (target) => target instanceof Element && Boolean(target.closest(
    'a[href], button, input, textarea, select, [contenteditable="true"]'
  ));
  var preloadPieceImages = (buttons) => {
    const sources = Array.from(new Set(
      buttons.map((button) => button.dataset.pieceImage?.trim()).filter((source) => Boolean(source))
    ));
    if (!sources.length) return;
    const pending = /* @__PURE__ */ new Set();
    let cursor = 0;
    let active = 0;
    const pump = () => {
      while (active < PRELOAD_CONCURRENCY && cursor < sources.length) {
        const source = sources[cursor];
        cursor += 1;
        if (!source) continue;
        const preload = new Image();
        active += 1;
        pending.add(preload);
        preload.decoding = "async";
        preload.fetchPriority = "low";
        const settle = () => {
          preload.onload = null;
          preload.onerror = null;
          pending.delete(preload);
          active -= 1;
          pump();
        };
        preload.onload = settle;
        preload.onerror = settle;
        preload.src = source;
      }
    };
    window.requestAnimationFrame(() => {
      window.setTimeout(pump, 0);
    });
  };
  var setupPieceViewer = () => {
    const root = document.documentElement;
    const dialog = query("[data-piece-viewer]");
    const image = query("[data-piece-viewer-image]", dialog ?? void 0);
    const status = query("[data-piece-viewer-status]", dialog ?? void 0);
    const statusText = query("[data-piece-viewer-status-text]", dialog ?? void 0);
    const closeButton = query("[data-piece-viewer-close]", dialog ?? void 0);
    const openButtons = queryAll("[data-piece-viewer-open]");
    if (!dialog || !image || !status || !statusText || !closeButton || !openButtons.length) return;
    preloadPieceImages(openButtons);
    const reducedMotion2 = window.matchMedia("(prefers-reduced-motion: reduce)");
    let activeButton = null;
    let closeTimer = 0;
    let openFrame = 0;
    let imageFrame = 0;
    let scrollCorrectionFrame = 0;
    let lockedScrollY = 0;
    let backgroundLocked = false;
    const preventBackgroundScroll = (event) => {
      if (event.cancelable) event.preventDefault();
    };
    const preventBackgroundScrollKey = (event) => {
      if (!SCROLL_KEYS.has(event.key) || isInteractiveTarget(event.target)) return;
      event.preventDefault();
    };
    const enforceLockedScroll = () => {
      if (!backgroundLocked || scrollCorrectionFrame) return;
      scrollCorrectionFrame = window.requestAnimationFrame(() => {
        scrollCorrectionFrame = 0;
        if (!backgroundLocked || Math.abs(window.scrollY - lockedScrollY) < 0.5) return;
        window.scrollTo(0, lockedScrollY);
      });
    };
    const lockBackground = () => {
      if (backgroundLocked) return;
      lockedScrollY = window.scrollY;
      backgroundLocked = true;
      root.classList.add("has-piece-viewer");
      window.addEventListener("wheel", preventBackgroundScroll, { passive: false });
      window.addEventListener("touchmove", preventBackgroundScroll, { passive: false });
      window.addEventListener("scroll", enforceLockedScroll, { passive: true });
      document.addEventListener("keydown", preventBackgroundScrollKey, true);
      enforceLockedScroll();
    };
    const unlockBackground = () => {
      if (!backgroundLocked) return;
      backgroundLocked = false;
      window.removeEventListener("wheel", preventBackgroundScroll);
      window.removeEventListener("touchmove", preventBackgroundScroll);
      window.removeEventListener("scroll", enforceLockedScroll);
      document.removeEventListener("keydown", preventBackgroundScrollKey, true);
      if (scrollCorrectionFrame) window.cancelAnimationFrame(scrollCorrectionFrame);
      scrollCorrectionFrame = 0;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      root.classList.remove("has-piece-viewer");
      window.scrollTo(0, lockedScrollY);
      root.style.scrollBehavior = previousScrollBehavior;
    };
    const setLoadingState = () => {
      if (imageFrame) window.cancelAnimationFrame(imageFrame);
      dialog.dataset.state = "loading";
      statusText.textContent = LOADING_MESSAGE;
      status.hidden = false;
      image.hidden = true;
    };
    const setReadyState = () => {
      if (!dialog.open || dialog.classList.contains("is-closing")) return;
      image.hidden = false;
      imageFrame = window.requestAnimationFrame(() => {
        imageFrame = 0;
        if (!dialog.open || dialog.classList.contains("is-closing")) return;
        dialog.dataset.state = "ready";
        status.hidden = true;
      });
    };
    const setErrorState = () => {
      if (!dialog.open || dialog.classList.contains("is-closing")) return;
      dialog.dataset.state = "error";
      statusText.textContent = ERROR_MESSAGE;
      status.hidden = false;
      image.hidden = true;
    };
    const openDialog = () => {
      if (dialog.open) return;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        return;
      }
      dialog.setAttribute("open", "");
    };
    const clearMotionSchedules = () => {
      if (closeTimer) window.clearTimeout(closeTimer);
      if (openFrame) window.cancelAnimationFrame(openFrame);
      if (imageFrame) window.cancelAnimationFrame(imageFrame);
      closeTimer = 0;
      openFrame = 0;
      imageFrame = 0;
      dialog.removeEventListener("transitionend", handleCloseTransition);
    };
    const cleanup = () => {
      clearMotionSchedules();
      unlockBackground();
      dialog.classList.remove("is-open", "is-closing");
      dialog.setAttribute("aria-label", "Vista de pieza");
      image.removeAttribute("src");
      image.alt = "";
      statusText.textContent = LOADING_MESSAGE;
      status.hidden = false;
      image.hidden = true;
      delete dialog.dataset.state;
      const button = activeButton;
      activeButton = null;
      button?.focus({ preventScroll: true });
    };
    const finishClose = () => {
      clearMotionSchedules();
      if (!dialog.open) return;
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        cleanup();
      }
    };
    function handleCloseTransition(event) {
      if (event.target !== dialog || event.propertyName !== "opacity") return;
      finishClose();
    }
    const closeDialog = () => {
      if (!dialog.open || dialog.classList.contains("is-closing")) return;
      if (openFrame) window.cancelAnimationFrame(openFrame);
      openFrame = 0;
      dialog.classList.remove("is-open");
      dialog.classList.add("is-closing");
      dialog.addEventListener("transitionend", handleCloseTransition);
      closeTimer = window.setTimeout(
        finishClose,
        reducedMotion2.matches ? REDUCED_CLOSE_FALLBACK_MS : CLOSE_FALLBACK_MS
      );
    };
    const beginOpenAnimation = (source) => {
      openFrame = window.requestAnimationFrame(() => {
        openFrame = 0;
        if (!dialog.open || dialog.classList.contains("is-closing")) return;
        void dialog.getBoundingClientRect();
        openFrame = window.requestAnimationFrame(() => {
          openFrame = 0;
          if (!dialog.open || dialog.classList.contains("is-closing")) return;
          dialog.classList.add("is-open");
          image.fetchPriority = "high";
          image.src = source;
          enforceLockedScroll();
        });
      });
    };
    const openPiece = (button) => {
      const name = button.dataset.pieceName?.trim();
      const source = button.dataset.pieceImage?.trim();
      if (!name || !source) return;
      clearMotionSchedules();
      activeButton = button;
      dialog.setAttribute("aria-label", `Imagen de ${name}`);
      image.alt = name;
      image.removeAttribute("src");
      setLoadingState();
      lockBackground();
      dialog.classList.remove("is-open", "is-closing");
      openDialog();
      beginOpenAnimation(source);
    };
    openButtons.forEach((button) => {
      button.addEventListener("click", () => openPiece(button));
    });
    image.addEventListener("load", setReadyState);
    image.addEventListener("error", setErrorState);
    closeButton.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", cleanup);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
  };

  // src/ts/features/proposal-reveal.ts
  var RESPONSIVE_REVEAL_QUERY = "(max-width: 840px)";
  var DESKTOP_REVEAL_RATIO = 0.82;
  var REVEAL_DOCK_GAP_PX = 16;
  var MIN_VISIBLE_PX = 12;
  var MAX_VISIBLE_PX = 28;
  var VISIBLE_RATIO = 0.08;
  var reveal = (element) => {
    if (element.classList.contains("is-visible")) return;
    element.classList.remove("is-reveal-bypassed");
    element.classList.add("is-visible");
  };
  var bypassReveal = (element) => {
    element.classList.add("is-visible", "is-reveal-bypassed");
  };
  var getViewportBottom = () => {
    const viewport = window.visualViewport;
    return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  };
  var getRevealBoundary = (dock2, responsiveReveal) => {
    const viewportBottom = getViewportBottom();
    if (!responsiveReveal.matches || !dock2) {
      return viewportBottom * DESKTOP_REVEAL_RATIO;
    }
    const dockBounds = dock2.getBoundingClientRect();
    const dockIsFixed = window.getComputedStyle(dock2).position === "fixed";
    const dockOverlapsViewport = dockBounds.bottom > 0 && dockBounds.top < viewportBottom;
    if (!dockIsFixed || !dockOverlapsViewport) {
      return viewportBottom * DESKTOP_REVEAL_RATIO;
    }
    return Math.max(0, dockBounds.top - REVEAL_DOCK_GAP_PX);
  };
  var hasCrossedRevealBoundary = (element, boundary) => {
    const bounds = element.getBoundingClientRect();
    const visibleDistance = Math.min(
      MAX_VISIBLE_PX,
      Math.max(MIN_VISIBLE_PX, bounds.height * VISIBLE_RATIO)
    );
    return bounds.bottom > 0 && bounds.top + visibleDistance <= boundary;
  };
  var setupProposalReveal = () => {
    const root = document.documentElement;
    const proposalRoot = query("[data-proposal-root]");
    root.setAttribute("data-proposal-reveal-ready", "");
    if (!proposalRoot) return;
    const targets = queryAll("[data-proposal-reveal]", proposalRoot);
    if (!targets.length) return;
    const dock2 = query(".booking-dock");
    const responsiveReveal = window.matchMedia(RESPONSIVE_REVEAL_QUERY);
    const visualViewport = window.visualViewport;
    const pendingTargets = new Set(targets);
    let updateFrame = 0;
    const revealVisibleTargets = () => {
      updateFrame = 0;
      const boundary = getRevealBoundary(dock2, responsiveReveal);
      pendingTargets.forEach((element) => {
        if (element.classList.contains("is-visible")) {
          pendingTargets.delete(element);
          return;
        }
        if (!hasCrossedRevealBoundary(element, boundary)) return;
        reveal(element);
        pendingTargets.delete(element);
      });
      if (!pendingTargets.size) removeListeners();
    };
    const scheduleUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(revealVisibleTargets);
    };
    const removeListeners = () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      responsiveReveal.removeEventListener("change", scheduleUpdate);
      visualViewport?.removeEventListener("resize", scheduleUpdate);
      visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
    if (root.classList.contains("proposal-reveal-fallback")) {
      const boundary = getRevealBoundary(dock2, responsiveReveal);
      pendingTargets.forEach((element) => {
        if (!hasCrossedRevealBoundary(element, boundary)) return;
        bypassReveal(element);
        pendingTargets.delete(element);
      });
      root.classList.remove("proposal-reveal-fallback");
    }
    if (!pendingTargets.size) return;
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    responsiveReveal.addEventListener("change", scheduleUpdate);
    visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
    visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(revealVisibleTargets);
    });
  };

  // src/ts/features/smooth-scroll.ts
  var setupEfficientSmoothScroll = ({
    isFirefox,
    reducedMotion: reducedMotion2
  }) => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (reducedMotion2.matches || isFirefox || !finePointer.matches) return;
    let targetY = window.scrollY;
    let frameId = 0;
    const maximumScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp2 = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      targetY = window.scrollY;
    };
    const step = () => {
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
    const onWheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const isCoarseWheel = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 50;
      if (!isCoarseWheel) return;
      event.preventDefault();
      if (!frameId) targetY = window.scrollY;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = clamp2(event.deltaY * unit, -240, 240);
      targetY = clamp2(targetY + delta * 0.9, 0, maximumScroll());
      if (!frameId) frameId = window.requestAnimationFrame(step);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("resize", () => {
      targetY = clamp2(targetY, 0, maximumScroll());
    }, { passive: true });
    window.addEventListener("scroll", () => {
      if (!frameId) targetY = window.scrollY;
    }, { passive: true });
  };

  // src/ts/features/tap-search-guard.ts
  var TAP_MAX_DURATION = 380;
  var TAP_MOVEMENT_TOLERANCE = 12;
  var SELECTION_SUPPRESSION_DURATION = 700;
  var getElement = (target) => {
    if (target instanceof Element) return target;
    if (target instanceof Node) return target.parentElement;
    return null;
  };
  var isEditableTarget = (target) => Boolean(target?.closest(
    'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
  ));
  var findTouch = (touches, identifier) => {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);
      if (touch?.identifier === identifier) return touch;
    }
    return null;
  };
  var setupTapSearchGuard = () => {
    if (navigator.maxTouchPoints <= 0) return;
    let gesture = null;
    let suppressSelectionUntil = 0;
    let suppressedTarget = null;
    let cleanupTimer = 0;
    const selectionSuppressionIsActive = () => performance.now() <= suppressSelectionUntil;
    const clearSuppression = () => {
      suppressSelectionUntil = 0;
      suppressedTarget = null;
      if (cleanupTimer) {
        window.clearTimeout(cleanupTimer);
        cleanupTimer = 0;
      }
    };
    const selectionTouchesSuppressedTarget = () => {
      if (!suppressedTarget) return false;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return true;
      const anchor = getElement(selection.anchorNode);
      const focus = getElement(selection.focusNode);
      return [anchor, focus].some((element) => Boolean(
        element && (suppressedTarget?.contains(element) || element.contains(suppressedTarget))
      ));
    };
    const clearTapSelection = () => {
      if (!selectionSuppressionIsActive()) return;
      if (!selectionTouchesSuppressedTarget()) return;
      const selection = window.getSelection();
      if (selection?.rangeCount) selection.removeAllRanges();
    };
    const armSelectionSuppression = (target) => {
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
    document.addEventListener("touchstart", (event) => {
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
    document.addEventListener("touchmove", (event) => {
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
    document.addEventListener("touchend", (event) => {
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
      if (duration <= TAP_MAX_DURATION && !completedGesture.moved && distance <= TAP_MOVEMENT_TOLERANCE) {
        armSelectionSuppression(completedGesture.target);
      }
    }, { passive: true, capture: true });
    document.addEventListener("touchcancel", () => {
      gesture = null;
    }, { passive: true, capture: true });
    document.addEventListener("selectstart", (event) => {
      if (!selectionSuppressionIsActive()) return;
      const target = getElement(event.target);
      if (!target || isEditableTarget(target) || !suppressedTarget) return;
      if (!suppressedTarget.contains(target) && !target.contains(suppressedTarget)) {
        return;
      }
      if (event.cancelable) event.preventDefault();
      clearTapSelection();
    }, { capture: true });
    document.addEventListener("selectionchange", clearTapSelection);
  };

  // src/ts/features/video-loop.ts
  var STALL_RECOVERY_DELAY = 2400;
  var HARD_STALL_THRESHOLD = 6500;
  var WATCHDOG_INTERVAL = 2e3;
  var PLAY_START_TIMEOUT = 4500;
  var ensureVideoSource = (video) => {
    if (video.currentSrc || video.hasAttribute("src") || Boolean(video.querySelector("source[src]"))) {
      return true;
    }
    const source = video.dataset.videoSource;
    if (!source) return false;
    video.src = source;
    video.load();
    return true;
  };
  var setCurrentTimeSafely = (video, requestedTime) => {
    const applyTime = () => {
      const duration = video.duration;
      const maximum = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.05) : Math.max(0, requestedTime);
      const nextTime = Math.min(Math.max(0, requestedTime), maximum);
      try {
        video.currentTime = nextTime;
      } catch {
      }
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) applyTime();
    else video.addEventListener("loadedmetadata", applyTime, { once: true });
  };
  var playWithTimeout = async (video, timeout = PLAY_START_TIMEOUT) => {
    let timeoutId = 0;
    try {
      await Promise.race([
        video.play(),
        new Promise((_resolve, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Video playback did not start in time.")),
            timeout
          );
        })
      ]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };
  var setupVideoLoop = ({
    root,
    compactViewport,
    coarsePointer
  }) => {
    const hero = query(".hero");
    const introVideo = query("[data-intro-video]");
    const loopVideos = queryAll("[data-loop-video]");
    if (!introVideo || loopVideos.length === 0) return;
    const allVideos = [introVideo, ...loopVideos];
    const compactPlayback = compactViewport.matches || coarsePointer.matches;
    const mixDuration = compactPlayback ? 650 : 900;
    const mixLead = mixDuration / 1e3 + 0.24;
    root.style.setProperty("--video-mix-duration", `${mixDuration}ms`);
    introVideo.hidden = false;
    introVideo.loop = false;
    introVideo.muted = true;
    introVideo.playsInline = true;
    introVideo.preload = "metadata";
    introVideo.classList.add("is-active");
    introVideo.classList.remove("is-mixing-in");
    loopVideos.forEach((video) => {
      video.hidden = false;
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.preload = "none";
      video.classList.remove("is-active", "is-mixing-in");
    });
    let phase = "intro";
    let introCompleted = false;
    let activeLoopIndex = 0;
    let transitionInProgress = false;
    let boundaryTimerId = 0;
    let mixTimerId = 0;
    let recoveryTimerId = 0;
    let mixGeneration = 0;
    let suspendedState = null;
    let heroVisible = true;
    let lastProgressVideo = introVideo;
    let lastMediaTime = 0;
    let lastProgressAt = performance.now();
    const canPlay = () => !document.hidden && heroVisible && navigator.onLine !== false;
    const getLoopVideo = (index) => loopVideos[index] ?? null;
    const currentVideo = () => phase === "intro" ? introVideo : getLoopVideo(activeLoopIndex) ?? introVideo;
    const nextLoopIndex = (index) => loopVideos.length > 1 ? (index + 1) % loopVideos.length : index;
    const clearBoundaryTimer = () => {
      if (!boundaryTimerId) return;
      window.clearTimeout(boundaryTimerId);
      boundaryTimerId = 0;
    };
    const clearMixTimer = () => {
      if (!mixTimerId) return;
      window.clearTimeout(mixTimerId);
      mixTimerId = 0;
    };
    const clearRecoveryTimer = () => {
      if (!recoveryTimerId) return;
      window.clearTimeout(recoveryTimerId);
      recoveryTimerId = 0;
    };
    const resetVisualState = (activeVideo) => {
      allVideos.forEach((video) => {
        if (video !== activeVideo) video.pause();
        video.classList.remove("is-active", "is-mixing-in");
      });
      activeVideo.classList.add("is-active");
    };
    const activateIntro = (time) => {
      clearBoundaryTimer();
      clearMixTimer();
      mixGeneration += 1;
      transitionInProgress = false;
      phase = "intro";
      resetVisualState(introVideo);
      ensureVideoSource(introVideo);
      setCurrentTimeSafely(introVideo, time);
      return introVideo;
    };
    const activateLoop = (index, time) => {
      const video = getLoopVideo(index);
      if (!video || !ensureVideoSource(video)) return null;
      clearBoundaryTimer();
      clearMixTimer();
      mixGeneration += 1;
      transitionInProgress = false;
      phase = "loop";
      activeLoopIndex = index;
      resetVisualState(video);
      setCurrentTimeSafely(video, time);
      return video;
    };
    const primeLoop = (index) => {
      const video = getLoopVideo(index);
      if (!video) return null;
      video.preload = "auto";
      return ensureVideoSource(video) ? video : null;
    };
    const noteProgress = (video) => {
      if (video !== currentVideo()) return;
      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : lastMediaTime;
      if (video !== lastProgressVideo || Math.abs(currentTime - lastMediaTime) >= 0.04 || currentTime < lastMediaTime) {
        lastProgressVideo = video;
        lastMediaTime = currentTime;
        lastProgressAt = performance.now();
      }
    };
    const scheduleBoundary = () => {
      clearBoundaryTimer();
      if (!canPlay() || transitionInProgress || phase !== "loop") return;
      const activeVideo = getLoopVideo(activeLoopIndex);
      if (!activeVideo) return;
      const duration = activeVideo.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        activeVideo.addEventListener("loadedmetadata", scheduleBoundary, { once: true });
        return;
      }
      const playbackRate = Math.max(0.1, Math.abs(activeVideo.playbackRate || 1));
      const remaining = duration - activeVideo.currentTime;
      const delay = Math.max(0, (remaining - mixLead) / playbackRate * 1e3);
      const scheduledIndex = activeLoopIndex;
      boundaryTimerId = window.setTimeout(() => {
        boundaryTimerId = 0;
        if (phase !== "loop" || activeLoopIndex !== scheduledIndex || transitionInProgress) return;
        const currentRemaining = activeVideo.duration - activeVideo.currentTime;
        if (currentRemaining <= mixLead + 0.16) {
          void transitionToLoop(nextLoopIndex(activeLoopIndex));
        } else {
          scheduleBoundary();
        }
      }, delay);
    };
    const recoverCurrentVideo = async (forceReload = false) => {
      clearRecoveryTimer();
      if (!canPlay()) return;
      if (phase === "intro" && introCompleted) {
        void transitionToLoop(0);
        return;
      }
      const video = currentVideo();
      if (!ensureVideoSource(video)) return;
      if (phase === "loop") {
        const duration = video.duration;
        const reachedBoundary = video.ended || Number.isFinite(duration) && duration > 0 && duration - video.currentTime < 0.12;
        if (reachedBoundary) setCurrentTimeSafely(video, 0);
      }
      if (forceReload || video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        const resumeTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        video.load();
        setCurrentTimeSafely(video, resumeTime);
      }
      try {
        await playWithTimeout(video);
        lastProgressVideo = video;
        lastMediaTime = video.currentTime;
        lastProgressAt = performance.now();
        if (phase === "loop") scheduleBoundary();
      } catch {
        if (canPlay()) {
          recoveryTimerId = window.setTimeout(() => {
            recoveryTimerId = 0;
            void recoverCurrentVideo(true);
          }, STALL_RECOVERY_DELAY);
        }
      }
    };
    const scheduleRecovery = (forceReload = false) => {
      if (!canPlay() || recoveryTimerId) return;
      recoveryTimerId = window.setTimeout(() => {
        recoveryTimerId = 0;
        void recoverCurrentVideo(forceReload);
      }, STALL_RECOVERY_DELAY);
    };
    async function transitionToLoop(index) {
      if (transitionInProgress || !canPlay()) return;
      const outgoing = currentVideo();
      const incoming = primeLoop(index);
      if (!incoming) {
        scheduleRecovery(true);
        return;
      }
      if (outgoing === incoming) {
        setCurrentTimeSafely(incoming, 0);
        try {
          await playWithTimeout(incoming);
          phase = "loop";
          activeLoopIndex = index;
          scheduleBoundary();
        } catch {
          scheduleRecovery(true);
        }
        return;
      }
      transitionInProgress = true;
      clearBoundaryTimer();
      clearRecoveryTimer();
      const generation = ++mixGeneration;
      try {
        incoming.pause();
        setCurrentTimeSafely(incoming, 0);
        incoming.classList.remove("is-active");
        incoming.classList.add("is-mixing-in");
        await playWithTimeout(incoming);
        if (generation !== mixGeneration || !canPlay()) {
          incoming.pause();
          incoming.classList.remove("is-active", "is-mixing-in");
          return;
        }
        window.requestAnimationFrame(() => {
          if (generation === mixGeneration && canPlay()) incoming.classList.add("is-active");
        });
        mixTimerId = window.setTimeout(() => {
          if (generation !== mixGeneration || !canPlay()) return;
          outgoing.classList.remove("is-active");
          outgoing.pause();
          if (outgoing !== introVideo) setCurrentTimeSafely(outgoing, 0);
          incoming.classList.remove("is-mixing-in");
          phase = "loop";
          activeLoopIndex = index;
          transitionInProgress = false;
          mixTimerId = 0;
          lastProgressVideo = incoming;
          lastMediaTime = incoming.currentTime;
          lastProgressAt = performance.now();
          primeLoop(nextLoopIndex(index));
          scheduleBoundary();
        }, mixDuration + 50);
      } catch {
        incoming.pause();
        incoming.classList.remove("is-active", "is-mixing-in");
        if (generation !== mixGeneration) return;
        transitionInProgress = false;
        outgoing.classList.add("is-active");
        scheduleRecovery(true);
      }
    }
    const suspendPlayback = () => {
      clearBoundaryTimer();
      clearMixTimer();
      clearRecoveryTimer();
      const mixingLoopIndex = loopVideos.findIndex(
        (video) => video.classList.contains("is-active") && video.classList.contains("is-mixing-in")
      );
      const visibleVideo = mixingLoopIndex >= 0 ? getLoopVideo(mixingLoopIndex) : currentVideo();
      if (!visibleVideo) return;
      suspendedState = {
        phase: visibleVideo === introVideo ? "intro" : "loop",
        index: mixingLoopIndex >= 0 ? mixingLoopIndex : activeLoopIndex,
        time: Number.isFinite(visibleVideo.currentTime) ? visibleVideo.currentTime : 0
      };
      mixGeneration += 1;
      transitionInProgress = false;
      allVideos.forEach((video) => video.pause());
      resetVisualState(visibleVideo);
      if (suspendedState.phase === "loop") {
        phase = "loop";
        activeLoopIndex = suspendedState.index;
      } else {
        phase = "intro";
      }
    };
    const resumePlayback = () => {
      if (!canPlay()) return;
      const state = suspendedState;
      suspendedState = null;
      if (state?.phase === "loop") {
        const activeVideo2 = activateLoop(state.index, state.time);
        if (activeVideo2) {
          void playWithTimeout(activeVideo2).then(scheduleBoundary).catch(() => scheduleRecovery(true));
        }
        return;
      }
      if (introCompleted) {
        void transitionToLoop(0);
        return;
      }
      const introTime = state?.phase === "intro" ? state.time : Number.isFinite(introVideo.currentTime) ? introVideo.currentTime : 0;
      const activeVideo = activateIntro(introTime);
      void playWithTimeout(activeVideo).catch(() => scheduleRecovery(true));
    };
    introVideo.addEventListener("timeupdate", () => noteProgress(introVideo), { passive: true });
    introVideo.addEventListener("playing", () => {
      clearRecoveryTimer();
      lastProgressVideo = introVideo;
      lastProgressAt = performance.now();
    }, { passive: true });
    introVideo.addEventListener("canplay", () => {
      primeLoop(0);
    }, { once: true, passive: true });
    introVideo.addEventListener("ended", () => {
      introCompleted = true;
      if (phase === "intro") void transitionToLoop(0);
    }, { passive: true });
    introVideo.addEventListener("waiting", () => scheduleRecovery(false), { passive: true });
    introVideo.addEventListener("stalled", () => scheduleRecovery(true), { passive: true });
    introVideo.addEventListener("error", () => scheduleRecovery(true), { passive: true });
    loopVideos.forEach((video, index) => {
      video.addEventListener("timeupdate", () => noteProgress(video), { passive: true });
      video.addEventListener("playing", () => {
        clearRecoveryTimer();
        lastProgressAt = performance.now();
        if (phase === "loop" && index === activeLoopIndex) scheduleBoundary();
      }, { passive: true });
      video.addEventListener("seeked", () => {
        if (phase === "loop" && index === activeLoopIndex) scheduleBoundary();
      }, { passive: true });
      video.addEventListener("ratechange", () => {
        if (phase === "loop" && index === activeLoopIndex) scheduleBoundary();
      }, { passive: true });
      video.addEventListener("waiting", () => {
        if (phase === "loop" && index === activeLoopIndex) {
          clearBoundaryTimer();
          scheduleRecovery(false);
        }
      }, { passive: true });
      video.addEventListener("stalled", () => {
        if (phase === "loop" && index === activeLoopIndex) scheduleRecovery(true);
      }, { passive: true });
      video.addEventListener("error", () => {
        if (phase === "loop" && index === activeLoopIndex) scheduleRecovery(true);
      }, { passive: true });
      video.addEventListener("ended", () => {
        if (phase === "loop" && index === activeLoopIndex && !transitionInProgress) {
          void transitionToLoop(nextLoopIndex(index));
        }
      }, { passive: true });
    });
    if (hero && "IntersectionObserver" in window) {
      const heroObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const nextVisible = entry.isIntersecting;
        if (nextVisible === heroVisible) return;
        heroVisible = nextVisible;
        if (heroVisible && !document.hidden) resumePlayback();
        else suspendPlayback();
      }, { rootMargin: "80px 0px", threshold: 0 });
      heroObserver.observe(hero);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) suspendPlayback();
      else resumePlayback();
    });
    window.addEventListener("pagehide", suspendPlayback, { passive: true });
    window.addEventListener("pageshow", resumePlayback, { passive: true });
    window.addEventListener("online", resumePlayback, { passive: true });
    window.setInterval(() => {
      if (!canPlay()) return;
      const activeVideo = currentVideo();
      noteProgress(activeVideo);
      const stalledFor = performance.now() - lastProgressAt;
      const unexpectedlyPaused = activeVideo.paused && !activeVideo.ended;
      const bufferStarved = activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
      if (unexpectedlyPaused || stalledFor >= HARD_STALL_THRESHOLD) {
        scheduleRecovery(bufferStarved || stalledFor >= HARD_STALL_THRESHOLD);
      }
    }, WATCHDOG_INTERVAL);
    ensureVideoSource(introVideo);
    primeLoop(0);
    void playWithTimeout(introVideo).catch(() => scheduleRecovery(true));
  };

  // src/ts/shared/runtime.ts
  var createRuntimeContext = () => {
    const root = document.documentElement;
    const isFirefox = /Firefox\//i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const compactViewport = window.matchMedia("(max-width: 820px)");
    const reducedMotion2 = window.matchMedia("(prefers-reduced-motion: reduce)");
    root.classList.toggle("is-firefox", isFirefox);
    root.classList.toggle("is-coarse-pointer", coarsePointer.matches);
    coarsePointer.addEventListener("change", ({ matches }) => {
      root.classList.toggle("is-coarse-pointer", matches);
    });
    return {
      root,
      isFirefox,
      coarsePointer,
      compactViewport,
      reducedMotion: reducedMotion2
    };
  };

  // src/ts/application.ts
  var runtime = createRuntimeContext();
  setupProposalReveal();
  setupBookingDockLayout();
  setupBookingCtaSheen(runtime);
  setupHeroTitleLayout();
  setupHeroIntroMotion();
  setupPieceViewer();
  setupTapSearchGuard();
  setupEfficientSmoothScroll(runtime);
  setupVideoLoop(runtime);

  // src/ts/dock-reveal.ts
  var dock = query(".booking-dock");
  var heroTitle = query(".title-lockup");
  if (dock && heroTitle) {
    const reducedMotion2 = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supportsIntersectionObserver = typeof globalThis.IntersectionObserver === "function";
    const easeOut2 = "cubic-bezier(.22, 1, .36, 1)";
    let resolved = false;
    let observer = null;
    const disconnect = () => {
      observer?.disconnect();
      observer = null;
    };
    const finishReveal = () => {
      resolved = true;
      disconnect();
    };
    const revealImmediately = () => {
      if (resolved) return;
      resolved = true;
      disconnect();
      const computed = window.getComputedStyle(dock);
      const startOpacity = Number.parseFloat(computed.opacity);
      const startTranslate = computed.translate === "none" ? "0 8px" : computed.translate;
      const startScale = computed.scale === "none" ? "0.992" : computed.scale;
      dock.style.opacity = Number.isFinite(startOpacity) ? String(startOpacity) : "0";
      dock.style.translate = startTranslate;
      dock.style.scale = startScale;
      dock.style.willChange = "opacity, translate, scale";
      dock.getAnimations().forEach((animation2) => animation2.cancel());
      if (reducedMotion2.matches) {
        dock.style.opacity = "1";
        dock.style.translate = "0 0";
        dock.style.scale = "1";
        dock.style.willChange = "";
        return;
      }
      const animation = dock.animate([
        {
          opacity: Number.isFinite(startOpacity) ? startOpacity : 0,
          translate: startTranslate,
          scale: startScale
        },
        {
          opacity: 1,
          translate: "0 0",
          scale: 1
        }
      ], {
        duration: 190,
        easing: easeOut2,
        fill: "both"
      });
      animation.addEventListener("finish", () => {
        dock.style.opacity = "1";
        dock.style.translate = "0 0";
        dock.style.scale = "1";
        dock.style.willChange = "";
        animation.cancel();
      }, { once: true });
    };
    const titleIsOutsideViewport = () => {
      const rect = heroTitle.getBoundingClientRect();
      return rect.bottom <= 0 || rect.top >= window.innerHeight;
    };
    const prioritizeWhenNeeded = () => {
      if (!resolved && window.scrollY > 0 && titleIsOutsideViewport()) revealImmediately();
    };
    dock.addEventListener("animationend", (event) => {
      if (event.target === dock && (event.animationName === "dock-in" || event.animationName === "stage-dock-in")) {
        finishReveal();
      }
    });
    const activeDockAnimation = dock.getAnimations().some(
      (animation) => animation.playState === "running"
    );
    if (!activeDockAnimation && Number.parseFloat(getComputedStyle(dock).opacity) >= 0.99) {
      finishReveal();
    } else if (supportsIntersectionObserver) {
      const nextObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && !entry.isIntersecting && window.scrollY > 0) revealImmediately();
      }, { threshold: 0 });
      observer = nextObserver;
      nextObserver.observe(heroTitle);
    } else {
      let frameId = 0;
      window.addEventListener("scroll", () => {
        if (frameId || resolved) return;
        frameId = window.requestAnimationFrame(() => {
          frameId = 0;
          prioritizeWhenNeeded();
        });
      }, { passive: true });
    }
    window.requestAnimationFrame(prioritizeWhenNeeded);
  }

  // src/ts/features/menu-reveal.ts
  var REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";
  var REVEAL_THRESHOLD = 0.01;
  var INITIAL_VIEWPORT_RATIO = 0.92;
  var reveal2 = (element) => {
    if (element.classList.contains("is-visible")) return;
    element.classList.add("is-visible");
  };
  var isInitiallyVisible = (element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight * INITIAL_VIEWPORT_RATIO;
  };
  var setupMenuReveal = (menuRoot2, _groups) => {
    const root = document.documentElement;
    const targets = queryAll("[data-menu-reveal]", menuRoot2);
    const fallbackActive = root.classList.contains("menu-reveal-fallback");
    root.setAttribute("data-menu-reveal-ready", "");
    if (!targets.length) return;
    if (fallbackActive || !("IntersectionObserver" in window)) {
      targets.forEach(reveal2);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        reveal2(element);
        observer.unobserve(element);
      });
    }, {
      rootMargin: REVEAL_ROOT_MARGIN,
      threshold: REVEAL_THRESHOLD
    });
    window.requestAnimationFrame(() => {
      targets.forEach((target) => {
        if (isInitiallyVisible(target)) reveal2(target);
        else observer.observe(target);
      });
    });
  };

  // src/ts/menu/observers.ts
  var configureMobileOverlapShadows = (groups) => {
    const mobileQuery2 = window.matchMedia("(max-width: 720px)");
    const targets = groups.flatMap((group) => {
      const heading = query(".menu-group__heading", group);
      const sentinel = query(".menu-group__overlap-sentinel", group);
      return heading && sentinel ? [{ heading, sentinel }] : [];
    });
    let updateFrame = 0;
    let resizeTimer = 0;
    const updateOverlapState = () => {
      updateFrame = 0;
      const mobile = mobileQuery2.matches;
      targets.forEach(({ heading, sentinel }) => {
        if (!mobile) {
          heading.classList.remove("is-overlapping");
          return;
        }
        const headingBounds = heading.getBoundingClientRect();
        const sentinelBounds = sentinel.getBoundingClientRect();
        const overlaps = sentinelBounds.top <= headingBounds.bottom;
        heading.classList.toggle("is-overlapping", overlaps);
      });
    };
    const scheduleUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(updateOverlapState);
    };
    const scheduleResizeSettlement = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        scheduleUpdate();
      }, 140);
    };
    scheduleUpdate();
    mobileQuery2.addEventListener("change", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleResizeSettlement, { passive: true });
    document.fonts.ready.then(scheduleUpdate).catch(() => void 0);
  };
  var observeActiveMenuGroup = (menuRoot2, groups) => {
    const firstGroup = groups[0];
    if (!firstGroup) return;
    firstGroup.classList.add("is-active");
    menuRoot2.dataset.activeMenu = firstGroup.dataset.menuGroup || "";
    if (!("IntersectionObserver" in window)) return;
    const visibility = new Map(groups.map((group) => [group, 0]));
    const updateActiveGroup = () => {
      let activeGroup = firstGroup;
      let activeRatio = -1;
      visibility.forEach((ratio, group) => {
        if (ratio > activeRatio) {
          activeRatio = ratio;
          activeGroup = group;
        }
      });
      groups.forEach((group) => group.classList.toggle("is-active", group === activeGroup));
      menuRoot2.dataset.activeMenu = activeGroup.dataset.menuGroup || "";
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const group = entry.target;
        visibility.set(group, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      updateActiveGroup();
    }, {
      rootMargin: "-18% 0px -42% 0px",
      threshold: [0, 0.12, 0.25, 0.4, 0.6, 0.8]
    });
    groups.forEach((group) => observer.observe(group));
  };

  // src/ts/menu/typography.ts
  var DESCRIPTION_SELECTOR = ".menu-item__description";
  var NON_BREAKING_SPACE = "\xA0";
  var WIDTH_EPSILON = 0.5;
  var TARGET_MINIMUM_WORDS = 8;
  var TARGET_IDEAL_WORDS = 9;
  var MAXIMUM_WORDS_PER_LINE = 10;
  var MINIMUM_NON_FINAL_WORDS = 2;
  var MINIMUM_FINAL_WORDS = 3;
  var MINIMUM_PREVIOUS_LINE_FILL = 0.58;
  var MINIMUM_PREVIOUS_LINE_WIDTH = 0.55;
  var ONE_LINE_MAXIMUM_FILL = 0.84;
  var MULTI_LINE_MAXIMUM_FILL = 0.9;
  var MULTI_LINE_MINIMUM_FILL = 0.54;
  var MAXIMUM_EXTRA_LINE_COUNTS = 1;
  var EXTRA_LINE_PENALTY = 0.42;
  var COHERENCE_LOWER_RATIO = 0.86;
  var COHERENCE_UPPER_RATIO = 1.16;
  var measurementNode = null;
  var median = (values) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const upper = sorted[middle];
    if (upper === void 0) return 0;
    if (sorted.length % 2 === 1) return upper;
    return ((sorted[middle - 1] ?? upper) + upper) / 2;
  };
  var getMeasurementNode = () => {
    if (measurementNode) return measurementNode;
    measurementNode = document.createElement("span");
    Object.assign(measurementNode.style, {
      position: "fixed",
      top: "0",
      left: "-100000px",
      visibility: "hidden",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      contain: "layout style paint"
    });
    measurementNode.setAttribute("aria-hidden", "true");
    document.body.append(measurementNode);
    return measurementNode;
  };
  var createTextMeasure = (element) => {
    const computed = window.getComputedStyle(element);
    const node = getMeasurementNode();
    const styles = {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontStyle: computed.fontStyle,
      fontStretch: computed.fontStretch,
      fontVariant: computed.fontVariant,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      wordSpacing: computed.wordSpacing,
      textTransform: computed.textTransform
    };
    const cache = /* @__PURE__ */ new Map();
    return (value) => {
      const cached = cache.get(value);
      if (cached !== void 0) return cached;
      Object.assign(node.style, styles);
      node.textContent = value;
      const width = node.getBoundingClientRect().width;
      cache.set(value, width);
      return width;
    };
  };
  var calculateLocalCost = (lines, maxWidth, extraLineCounts) => {
    const widths = lines.map((line) => line.width);
    const wordCounts = lines.map((line) => line.words.length);
    const meanWidth = widths.reduce((total, width) => total + width, 0) / widths.length;
    const meanWords = wordCounts.reduce((total, count) => total + count, 0) / wordCounts.length;
    const normalizeWidth = (value) => value / Math.max(maxWidth, 1);
    const normalizeWords = (value) => value / MAXIMUM_WORDS_PER_LINE;
    const nonFinalTargetPenalty = wordCounts.slice(0, -1).reduce((total, count) => {
      if (count >= TARGET_MINIMUM_WORDS) {
        const distance = normalizeWords(count - TARGET_IDEAL_WORDS);
        return total + distance * distance * 0.15;
      }
      const shortage = normalizeWords(TARGET_MINIMUM_WORDS - count);
      return total + shortage * shortage * 10;
    }, 0);
    const wordBalance = wordCounts.reduce((total, count) => {
      const delta = normalizeWords(count - meanWords);
      return total + delta * delta;
    }, 0) / wordCounts.length;
    const widthBalance = widths.reduce((total, width) => {
      const delta = normalizeWidth(width - meanWidth);
      return total + delta * delta;
    }, 0) / widths.length;
    const adjacentWidthDifference = widths.slice(1).reduce((total, width, index) => {
      const previous = widths[index];
      if (previous === void 0) return total;
      const delta = normalizeWidth(previous - width);
      return total + delta * delta;
    }, 0) / Math.max(widths.length - 1, 1);
    const requiredWidth = Math.max(...widths);
    const availableFill = requiredWidth / Math.max(maxWidth, 1);
    const maximumFill = lines.length === 1 ? ONE_LINE_MAXIMUM_FILL : MULTI_LINE_MAXIMUM_FILL;
    const overfill = Math.max(0, availableFill - maximumFill);
    const overfillPenalty = overfill * overfill * (lines.length === 1 ? 180 : 70);
    const underfill = lines.length > 1 ? Math.max(0, MULTI_LINE_MINIMUM_FILL - availableFill) : 0;
    const underfillPenalty = underfill * underfill * 4;
    let tailPenalty = 0;
    if (lines.length > 1) {
      const previousCount = wordCounts[wordCounts.length - 2] ?? meanWords;
      const finalCount = wordCounts[wordCounts.length - 1] ?? meanWords;
      const previousWidth = widths[widths.length - 2] ?? meanWidth;
      const finalWidth = widths[widths.length - 1] ?? meanWidth;
      const countRatio = finalCount / Math.max(previousCount, 1);
      const widthRatio = finalWidth / Math.max(previousWidth, 1);
      if (countRatio < MINIMUM_PREVIOUS_LINE_FILL) {
        const shortage = MINIMUM_PREVIOUS_LINE_FILL - countRatio;
        tailPenalty += shortage * shortage * 30;
      }
      if (widthRatio < MINIMUM_PREVIOUS_LINE_WIDTH) {
        const shortage = MINIMUM_PREVIOUS_LINE_WIDTH - widthRatio;
        tailPenalty += shortage * shortage * 24;
      }
      if (finalCount > previousCount) {
        const excess = normalizeWords(finalCount - previousCount);
        tailPenalty += excess * excess * 8;
      }
      if (finalWidth > previousWidth) {
        const excess = normalizeWidth(finalWidth - previousWidth);
        tailPenalty += excess * excess * 8;
      }
      if (finalCount === MINIMUM_FINAL_WORDS) tailPenalty += 0.4;
    }
    return nonFinalTargetPenalty + wordBalance * 1.1 + widthBalance * 1.5 + adjacentWidthDifference * 0.75 + overfillPenalty + underfillPenalty + tailPenalty + extraLineCounts * EXTRA_LINE_PENALTY;
  };
  var minimumWordsRequired = (remainingLines) => {
    if (remainingLines <= 0) return 0;
    if (remainingLines === 1) return MINIMUM_FINAL_WORDS;
    return (remainingLines - 1) * MINIMUM_NON_FINAL_WORDS + MINIMUM_FINAL_WORDS;
  };
  var generateLayoutsForLineCount = (words, lineCount, maxWidth, measure) => {
    const layouts = [];
    const current = [];
    const visit = (start, remainingLines) => {
      const remainingWords = words.length - start;
      const minimumRequired = lineCount === 1 ? 1 : minimumWordsRequired(remainingLines);
      const maximumAllowed = remainingLines * MAXIMUM_WORDS_PER_LINE;
      if (remainingWords < minimumRequired || remainingWords > maximumAllowed) return;
      if (remainingLines === 1) {
        const finalWords = words.slice(start);
        const minimumFinalWords = lineCount === 1 ? 1 : MINIMUM_FINAL_WORDS;
        if (finalWords.length < minimumFinalWords || finalWords.length > MAXIMUM_WORDS_PER_LINE) {
          return;
        }
        const width = measure(finalWords.join(" "));
        if (width > maxWidth + WIDTH_EPSILON) return;
        layouts.push([...current, { words: finalWords, width }]);
        return;
      }
      const followingLines = remainingLines - 1;
      const minimumEnd = start + MINIMUM_NON_FINAL_WORDS;
      const maximumEnd = Math.min(
        start + MAXIMUM_WORDS_PER_LINE,
        words.length - minimumWordsRequired(followingLines)
      );
      for (let end = minimumEnd; end <= maximumEnd; end += 1) {
        const lineWords = words.slice(start, end);
        const width = measure(lineWords.join(" "));
        if (width > maxWidth + WIDTH_EPSILON) break;
        current.push({ words: lineWords, width });
        visit(end, followingLines);
        current.pop();
      }
    };
    visit(0, lineCount);
    return layouts;
  };
  var generateIndividualCandidates = (metrics) => {
    const { words, maxWidth, measure } = metrics;
    if (!words.length) return [];
    const theoreticalMinimum = Math.max(1, Math.ceil(words.length / MAXIMUM_WORDS_PER_LINE));
    const maximumLineCount = words.length === 1 ? 1 : Math.max(
      theoreticalMinimum,
      1 + Math.floor((words.length - MINIMUM_FINAL_WORDS) / MINIMUM_NON_FINAL_WORDS)
    );
    let firstFeasibleLineCount = null;
    const candidates = [];
    for (let lineCount = theoreticalMinimum; lineCount <= maximumLineCount; lineCount += 1) {
      const geometries = generateLayoutsForLineCount(words, lineCount, maxWidth, measure);
      if (!geometries.length) continue;
      firstFeasibleLineCount ?? (firstFeasibleLineCount = lineCount);
      if (lineCount > firstFeasibleLineCount + MAXIMUM_EXTRA_LINE_COUNTS) break;
      const extraLineCounts = lineCount - firstFeasibleLineCount;
      geometries.forEach((lines) => {
        candidates.push({
          lines,
          localCost: calculateLocalCost(lines, maxWidth, extraLineCounts),
          requiredWidth: Math.max(...lines.map((line) => line.width))
        });
      });
    }
    return candidates;
  };
  var selectLowestLocalCost = (layouts) => {
    let selected = null;
    layouts.forEach((layout) => {
      if (!selected || layout.localCost < selected.localCost) selected = layout;
    });
    return selected;
  };
  var getCompositionKey = (wordCount, lineCount) => {
    const averageWordsPerLine = Math.max(1, Math.round(wordCount / Math.max(lineCount, 1)));
    return `${lineCount}:${averageWordsPerLine}`;
  };
  var selectCoherentLayout = (plan, referenceWidth) => {
    if (referenceWidth <= 0) return plan.localBest;
    const targetLineCount = plan.localBest.lines.length;
    const lowerGuide = referenceWidth * COHERENCE_LOWER_RATIO;
    const upperGuide = referenceWidth * COHERENCE_UPPER_RATIO;
    let selected = plan.localBest;
    let selectedCost = Number.POSITIVE_INFINITY;
    plan.candidates.forEach((candidate) => {
      if (candidate.lines.length !== targetLineCount) return;
      if (candidate.localCost > plan.localBest.localCost + 0.75) return;
      const belowBand = Math.max(0, lowerGuide - candidate.requiredWidth) / referenceWidth;
      const aboveBand = Math.max(0, candidate.requiredWidth - upperGuide) / referenceWidth;
      const distance = (candidate.requiredWidth - referenceWidth) / referenceWidth;
      const coherenceCost = distance * distance * 0.08 + (belowBand * belowBand + aboveBand * aboveBand) * 1.05;
      const combinedCost = candidate.localCost + coherenceCost;
      if (combinedCost < selectedCost) {
        selected = candidate;
        selectedCost = combinedCost;
      }
    });
    return selected;
  };
  var getAvailableDescriptionWidth = (element) => {
    const parent = element.parentElement;
    if (!parent) return element.getBoundingClientRect().width;
    const computed = window.getComputedStyle(parent);
    const horizontalPadding = Number.parseFloat(computed.paddingLeft || "0") + Number.parseFloat(computed.paddingRight || "0");
    return Math.max(0, parent.getBoundingClientRect().width - horizontalPadding);
  };
  var renderBalancedDescription = (metrics, layout) => {
    const fragment = document.createDocumentFragment();
    layout.lines.forEach((line, index) => {
      if (index > 0) fragment.append(document.createElement("br"));
      fragment.append(document.createTextNode(line.words.join(NON_BREAKING_SPACE)));
    });
    metrics.element.replaceChildren(fragment);
    metrics.element.style.maxWidth = "none";
    metrics.element.style.width = `${Math.ceil(Math.min(metrics.maxWidth, layout.requiredWidth + 1))}px`;
    metrics.element.setAttribute("aria-label", metrics.source);
  };
  var collectMetrics = (descriptions) => {
    descriptions.forEach((element) => {
      element.style.removeProperty("width");
      element.style.maxWidth = "none";
    });
    return descriptions.flatMap((element) => {
      const source = element.dataset.balanceText?.trim();
      const maxWidth = getAvailableDescriptionWidth(element);
      if (!source || maxWidth <= 0) return [];
      return [{
        element,
        source,
        words: source.split(/\s+/).filter(Boolean),
        maxWidth,
        measure: createTextMeasure(element)
      }];
    });
  };
  var createPlans = (metrics) => metrics.flatMap((descriptionMetrics) => {
    const candidates = generateIndividualCandidates(descriptionMetrics);
    const localBest = selectLowestLocalCost(candidates);
    if (!localBest) return [];
    return [{ metrics: descriptionMetrics, candidates, localBest }];
  });
  var createReferenceWidths = (plans) => {
    const compositionGroups = /* @__PURE__ */ new Map();
    const lineCountGroups = /* @__PURE__ */ new Map();
    plans.forEach(({ metrics, localBest }) => {
      const lineCount = localBest.lines.length;
      const compositionKey = getCompositionKey(metrics.words.length, lineCount);
      const compositionWidths = compositionGroups.get(compositionKey) ?? [];
      const lineWidths = lineCountGroups.get(lineCount) ?? [];
      compositionWidths.push(localBest.requiredWidth);
      lineWidths.push(localBest.requiredWidth);
      compositionGroups.set(compositionKey, compositionWidths);
      lineCountGroups.set(lineCount, lineWidths);
    });
    const byComposition = /* @__PURE__ */ new Map();
    const byLineCount = /* @__PURE__ */ new Map();
    compositionGroups.forEach((widths, key) => byComposition.set(key, median(widths)));
    lineCountGroups.forEach((widths, lineCount) => byLineCount.set(lineCount, median(widths)));
    return { byComposition, byLineCount };
  };
  var getReferenceWidth = (plan, references) => {
    const lineCount = plan.localBest.lines.length;
    const compositionKey = getCompositionKey(plan.metrics.words.length, lineCount);
    return references.byComposition.get(compositionKey) ?? references.byLineCount.get(lineCount) ?? plan.localBest.requiredWidth;
  };
  var observeBalancedMenuDescriptions = (root) => {
    const descriptions = queryAll(DESCRIPTION_SELECTOR, root);
    if (!descriptions.length) return;
    let animationFrame = 0;
    const balanceAll = () => {
      animationFrame = 0;
      const plans = createPlans(collectMetrics(descriptions));
      if (!plans.length) return;
      const references = createReferenceWidths(plans);
      plans.forEach((plan) => {
        const layout = selectCoherentLayout(plan, getReferenceWidth(plan, references));
        renderBalancedDescription(plan.metrics, layout);
      });
    };
    const scheduleBalance = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(balanceAll);
    };
    scheduleBalance();
    const supportsResizeObserver = typeof ResizeObserver !== "undefined";
    if (supportsResizeObserver) {
      const observedWidths = /* @__PURE__ */ new WeakMap();
      const observer = new ResizeObserver((entries) => {
        const widthChanged = entries.some((entry) => {
          const width = entry.contentRect.width;
          const previousWidth = observedWidths.get(entry.target);
          observedWidths.set(entry.target, width);
          return previousWidth === void 0 || Math.abs(previousWidth - width) >= WIDTH_EPSILON;
        });
        if (widthChanged) scheduleBalance();
      });
      if (root instanceof Element) observer.observe(root);
    } else {
      window.addEventListener("resize", scheduleBalance, { passive: true });
    }
    void document.fonts.ready.then(scheduleBalance);
  };

  // src/ts/menu-bootstrap.ts
  var menuRoot = query("[data-menu-root]");
  var menuGroups = query("[data-menu-groups]");
  if (menuRoot && menuGroups) {
    const groups = queryAll("[data-menu-group]", menuGroups);
    if (groups.length) {
      setupMenuReveal(menuRoot, groups);
      observeBalancedMenuDescriptions(menuGroups);
      configureMobileOverlapShadows(groups);
      observeActiveMenuGroup(menuRoot, groups);
    }
  }

  // src/ts/menu-motion.ts
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mobileQuery = window.matchMedia("(max-width: 720px)");
  var easeOut = "cubic-bezier(.22, 1, .36, 1)";
  var menuGroups2 = query("[data-menu-groups]");
  var menuIntroHeading = query(".menu-section__intro h2");
  var clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  if (menuGroups2) {
    query(".menu-mobile-sticky")?.remove();
    let revealObserver = null;
    let stickyExitFrame = 0;
    const groups = queryAll("[data-menu-group]", menuGroups2);
    const stickyExitTargets = groups.flatMap((group) => {
      const heading = query(".menu-group__heading", group);
      const sentinel = query(".menu-group__exit-sentinel", group);
      return heading && sentinel ? [{ heading, sentinel }] : [];
    });
    const animateOnce = (element, keyframes, options) => {
      const animation = element.animate(keyframes, {
        fill: "both",
        ...options
      });
      animation.addEventListener("finish", () => {
        element.style.opacity = "1";
        element.style.transform = "translate3d(0, 0, 0)";
        animation.cancel();
      }, { once: true });
    };
    const setupScrollReveals = () => {
      revealObserver?.disconnect();
      revealObserver = null;
      if (!("IntersectionObserver" in window)) return;
      const candidates = [];
      if (menuIntroHeading && !menuIntroHeading.dataset.motionReady) {
        menuIntroHeading.dataset.motionReady = "true";
        candidates.push({ element: menuIntroHeading, type: "intro", delay: 0 });
      }
      groups.forEach((group) => {
        queryAll(".menu-item", group).slice(0, 3).forEach((item, index) => {
          if (item.dataset.motionReady) return;
          item.dataset.motionReady = "true";
          candidates.push({
            element: item,
            type: "item",
            delay: reducedMotion.matches ? 0 : index * 40
          });
        });
      });
      if (!candidates.length) return;
      const candidateByElement = /* @__PURE__ */ new Map();
      candidates.forEach((candidate) => {
        candidateByElement.set(candidate.element, candidate);
        candidate.element.style.opacity = "0";
        candidate.element.style.transform = reducedMotion.matches ? "translate3d(0, 3px, 0)" : candidate.type === "intro" ? "translate3d(0, 14px, 0)" : "translate3d(0, 8px, 0)";
      });
      revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target;
          const candidate = candidateByElement.get(element);
          if (!candidate) return;
          observer.unobserve(element);
          const isIntro = candidate.type === "intro";
          const duration = reducedMotion.matches ? 150 : isIntro ? 360 : 260;
          const distance = reducedMotion.matches ? 3 : isIntro ? 14 : 8;
          animateOnce(element, [
            { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
            { opacity: 1, transform: "translate3d(0, 0, 0)" }
          ], {
            duration,
            delay: candidate.delay,
            easing: easeOut
          });
        });
      }, {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.08
      });
      candidates.forEach(({ element }) => revealObserver?.observe(element));
    };
    const updateStickyExitProgress = () => {
      stickyExitFrame = 0;
      stickyExitTargets.forEach(({ heading, sentinel }) => {
        let progress = 0;
        if (mobileQuery.matches) {
          const computed = window.getComputedStyle(heading);
          const stickyTop = Number.parseFloat(computed.top || "0") || 0;
          const headingHeight = Math.max(1, heading.getBoundingClientRect().height);
          const triggerLine = stickyTop + headingHeight;
          const sentinelTop = sentinel.getBoundingClientRect().top;
          progress = clamp((triggerLine - sentinelTop) / headingHeight, 0, 1);
        }
        heading.style.setProperty(
          "--menu-heading-exit-offset",
          `${(-progress * 100).toFixed(3)}%`
        );
      });
    };
    const scheduleStickyExitUpdate = () => {
      if (stickyExitFrame) return;
      stickyExitFrame = window.requestAnimationFrame(updateStickyExitProgress);
    };
    if (groups.length) {
      setupScrollReveals();
      scheduleStickyExitUpdate();
    }
    mobileQuery.addEventListener("change", scheduleStickyExitUpdate);
    window.addEventListener("scroll", scheduleStickyExitUpdate, { passive: true });
    window.addEventListener("resize", scheduleStickyExitUpdate, { passive: true });
    document.fonts.ready.then(scheduleStickyExitUpdate).catch(() => void 0);
  }
})();
