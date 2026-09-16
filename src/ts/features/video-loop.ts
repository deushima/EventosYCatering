import { query, queryAll } from '../shared/dom';
import type { RuntimeContext } from '../shared/runtime';

type PlaybackPhase = 'intro' | 'loop';

interface SuspendedVideoState {
  phase: PlaybackPhase;
  index: number;
  time: number;
}

const STALL_RECOVERY_DELAY = 2_400;
const HARD_STALL_THRESHOLD = 6_500;
const WATCHDOG_INTERVAL = 2_000;
const PLAY_START_TIMEOUT = 4_500;

const ensureVideoSource = (video: HTMLVideoElement): boolean => {
  if (
    video.currentSrc ||
    video.hasAttribute('src') ||
    Boolean(video.querySelector('source[src]'))
  ) {
    return true;
  }

  const source = video.dataset.videoSource;
  if (!source) return false;

  video.src = source;
  video.load();
  return true;
};

const setCurrentTimeSafely = (video: HTMLVideoElement, requestedTime: number): void => {
  const applyTime = (): void => {
    const duration = video.duration;
    const maximum = Number.isFinite(duration) && duration > 0
      ? Math.max(0, duration - 0.05)
      : Math.max(0, requestedTime);
    const nextTime = Math.min(Math.max(0, requestedTime), maximum);

    try {
      video.currentTime = nextTime;
    } catch {
      // Media seeks can be rejected while the browser is rebuilding its buffer.
    }
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) applyTime();
  else video.addEventListener('loadedmetadata', applyTime, { once: true });
};

const playWithTimeout = async (
  video: HTMLVideoElement,
  timeout = PLAY_START_TIMEOUT
): Promise<void> => {
  let timeoutId = 0;

  try {
    await Promise.race([
      video.play(),
      new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error('Video playback did not start in time.')),
          timeout
        );
      })
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export const setupVideoLoop = ({
  root,
  compactViewport,
  coarsePointer
}: RuntimeContext): void => {
  const hero = query<HTMLElement>('.hero');
  const introVideo = query<HTMLVideoElement>('[data-intro-video]');
  const loopVideos = queryAll<HTMLVideoElement>('[data-loop-video]');
  if (!introVideo || loopVideos.length === 0) return;

  const allVideos = [introVideo, ...loopVideos];
  const compactPlayback = compactViewport.matches || coarsePointer.matches;
  const mixDuration = compactPlayback ? 650 : 900;
  const mixLead = mixDuration / 1_000 + 0.24;
  root.style.setProperty('--video-mix-duration', `${mixDuration}ms`);

  introVideo.hidden = false;
  introVideo.loop = false;
  introVideo.muted = true;
  introVideo.playsInline = true;
  introVideo.preload = 'metadata';
  introVideo.classList.add('is-active');
  introVideo.classList.remove('is-mixing-in');

  loopVideos.forEach((video) => {
    video.hidden = false;
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'none';
    video.classList.remove('is-active', 'is-mixing-in');
  });

  let phase: PlaybackPhase = 'intro';
  let introCompleted = false;
  let activeLoopIndex = 0;
  let transitionInProgress = false;
  let boundaryTimerId = 0;
  let mixTimerId = 0;
  let recoveryTimerId = 0;
  let mixGeneration = 0;
  let suspendedState: SuspendedVideoState | null = null;
  let heroVisible = true;
  let lastProgressVideo: HTMLVideoElement = introVideo;
  let lastMediaTime = 0;
  let lastProgressAt = performance.now();

  const canPlay = (): boolean => !document.hidden && heroVisible && navigator.onLine !== false;
  const getLoopVideo = (index: number): HTMLVideoElement | null => loopVideos[index] ?? null;
  const currentVideo = (): HTMLVideoElement => (
    phase === 'intro' ? introVideo : getLoopVideo(activeLoopIndex) ?? introVideo
  );
  const nextLoopIndex = (index: number): number => (
    loopVideos.length > 1 ? (index + 1) % loopVideos.length : index
  );

  const clearBoundaryTimer = (): void => {
    if (!boundaryTimerId) return;
    window.clearTimeout(boundaryTimerId);
    boundaryTimerId = 0;
  };

  const clearMixTimer = (): void => {
    if (!mixTimerId) return;
    window.clearTimeout(mixTimerId);
    mixTimerId = 0;
  };

  const clearRecoveryTimer = (): void => {
    if (!recoveryTimerId) return;
    window.clearTimeout(recoveryTimerId);
    recoveryTimerId = 0;
  };

  const resetVisualState = (activeVideo: HTMLVideoElement): void => {
    allVideos.forEach((video) => {
      if (video !== activeVideo) video.pause();
      video.classList.remove('is-active', 'is-mixing-in');
    });
    activeVideo.classList.add('is-active');
  };

  const activateIntro = (time: number): HTMLVideoElement => {
    clearBoundaryTimer();
    clearMixTimer();
    mixGeneration += 1;
    transitionInProgress = false;
    phase = 'intro';
    resetVisualState(introVideo);
    ensureVideoSource(introVideo);
    setCurrentTimeSafely(introVideo, time);
    return introVideo;
  };

  const activateLoop = (index: number, time: number): HTMLVideoElement | null => {
    const video = getLoopVideo(index);
    if (!video || !ensureVideoSource(video)) return null;

    clearBoundaryTimer();
    clearMixTimer();
    mixGeneration += 1;
    transitionInProgress = false;
    phase = 'loop';
    activeLoopIndex = index;
    resetVisualState(video);
    setCurrentTimeSafely(video, time);
    return video;
  };

  const primeLoop = (index: number): HTMLVideoElement | null => {
    const video = getLoopVideo(index);
    if (!video) return null;
    video.preload = 'auto';
    return ensureVideoSource(video) ? video : null;
  };

  const noteProgress = (video: HTMLVideoElement): void => {
    if (video !== currentVideo()) return;

    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : lastMediaTime;
    if (
      video !== lastProgressVideo ||
      Math.abs(currentTime - lastMediaTime) >= 0.04 ||
      currentTime < lastMediaTime
    ) {
      lastProgressVideo = video;
      lastMediaTime = currentTime;
      lastProgressAt = performance.now();
    }
  };

  const scheduleBoundary = (): void => {
    clearBoundaryTimer();
    if (!canPlay() || transitionInProgress || phase !== 'loop') return;

    const activeVideo = getLoopVideo(activeLoopIndex);
    if (!activeVideo) return;
    const duration = activeVideo.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      activeVideo.addEventListener('loadedmetadata', scheduleBoundary, { once: true });
      return;
    }

    const playbackRate = Math.max(0.1, Math.abs(activeVideo.playbackRate || 1));
    const remaining = duration - activeVideo.currentTime;
    const delay = Math.max(0, ((remaining - mixLead) / playbackRate) * 1_000);
    const scheduledIndex = activeLoopIndex;

    boundaryTimerId = window.setTimeout(() => {
      boundaryTimerId = 0;
      if (phase !== 'loop' || activeLoopIndex !== scheduledIndex || transitionInProgress) return;

      const currentRemaining = activeVideo.duration - activeVideo.currentTime;
      if (currentRemaining <= mixLead + 0.16) {
        void transitionToLoop(nextLoopIndex(activeLoopIndex));
      } else {
        scheduleBoundary();
      }
    }, delay);
  };

  const recoverCurrentVideo = async (forceReload = false): Promise<void> => {
    clearRecoveryTimer();
    if (!canPlay()) return;

    if (phase === 'intro' && introCompleted) {
      void transitionToLoop(0);
      return;
    }

    const video = currentVideo();
    if (!ensureVideoSource(video)) return;

    if (phase === 'loop') {
      const duration = video.duration;
      const reachedBoundary = video.ended || (
        Number.isFinite(duration) && duration > 0 && duration - video.currentTime < 0.12
      );
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
      if (phase === 'loop') scheduleBoundary();
    } catch {
      if (canPlay()) {
        recoveryTimerId = window.setTimeout(() => {
          recoveryTimerId = 0;
          void recoverCurrentVideo(true);
        }, STALL_RECOVERY_DELAY);
      }
    }
  };

  const scheduleRecovery = (forceReload = false): void => {
    if (!canPlay() || recoveryTimerId) return;

    recoveryTimerId = window.setTimeout(() => {
      recoveryTimerId = 0;
      void recoverCurrentVideo(forceReload);
    }, STALL_RECOVERY_DELAY);
  };

  async function transitionToLoop(index: number): Promise<void> {
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
        phase = 'loop';
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
      incoming.classList.remove('is-active');
      incoming.classList.add('is-mixing-in');
      await playWithTimeout(incoming);

      if (generation !== mixGeneration || !canPlay()) {
        incoming.pause();
        incoming.classList.remove('is-active', 'is-mixing-in');
        return;
      }

      window.requestAnimationFrame(() => {
        if (generation === mixGeneration && canPlay()) incoming.classList.add('is-active');
      });

      mixTimerId = window.setTimeout(() => {
        if (generation !== mixGeneration || !canPlay()) return;

        outgoing.classList.remove('is-active');
        outgoing.pause();
        if (outgoing !== introVideo) setCurrentTimeSafely(outgoing, 0);
        incoming.classList.remove('is-mixing-in');
        phase = 'loop';
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
      incoming.classList.remove('is-active', 'is-mixing-in');
      if (generation !== mixGeneration) return;

      transitionInProgress = false;
      outgoing.classList.add('is-active');
      scheduleRecovery(true);
    }
  }

  const suspendPlayback = (): void => {
    clearBoundaryTimer();
    clearMixTimer();
    clearRecoveryTimer();

    const mixingLoopIndex = loopVideos.findIndex((video) =>
      video.classList.contains('is-active') && video.classList.contains('is-mixing-in')
    );
    const visibleVideo = mixingLoopIndex >= 0 ? getLoopVideo(mixingLoopIndex) : currentVideo();
    if (!visibleVideo) return;

    suspendedState = {
      phase: visibleVideo === introVideo ? 'intro' : 'loop',
      index: mixingLoopIndex >= 0 ? mixingLoopIndex : activeLoopIndex,
      time: Number.isFinite(visibleVideo.currentTime) ? visibleVideo.currentTime : 0
    };

    mixGeneration += 1;
    transitionInProgress = false;
    allVideos.forEach((video) => video.pause());
    resetVisualState(visibleVideo);

    if (suspendedState.phase === 'loop') {
      phase = 'loop';
      activeLoopIndex = suspendedState.index;
    } else {
      phase = 'intro';
    }
  };

  const resumePlayback = (): void => {
    if (!canPlay()) return;

    const state = suspendedState;
    suspendedState = null;

    if (state?.phase === 'loop') {
      const activeVideo = activateLoop(state.index, state.time);
      if (activeVideo) {
        void playWithTimeout(activeVideo)
          .then(scheduleBoundary)
          .catch(() => scheduleRecovery(true));
      }
      return;
    }

    if (introCompleted) {
      void transitionToLoop(0);
      return;
    }

    const introTime = state?.phase === 'intro'
      ? state.time
      : Number.isFinite(introVideo.currentTime)
        ? introVideo.currentTime
        : 0;
    const activeVideo = activateIntro(introTime);
    void playWithTimeout(activeVideo).catch(() => scheduleRecovery(true));
  };

  introVideo.addEventListener('timeupdate', () => noteProgress(introVideo), { passive: true });
  introVideo.addEventListener('playing', () => {
    clearRecoveryTimer();
    lastProgressVideo = introVideo;
    lastProgressAt = performance.now();
  }, { passive: true });
  introVideo.addEventListener('canplay', () => {
    primeLoop(0);
  }, { once: true, passive: true });
  introVideo.addEventListener('ended', () => {
    introCompleted = true;
    if (phase === 'intro') void transitionToLoop(0);
  }, { passive: true });
  introVideo.addEventListener('waiting', () => scheduleRecovery(false), { passive: true });
  introVideo.addEventListener('stalled', () => scheduleRecovery(true), { passive: true });
  introVideo.addEventListener('error', () => scheduleRecovery(true), { passive: true });

  loopVideos.forEach((video, index) => {
    video.addEventListener('timeupdate', () => noteProgress(video), { passive: true });
    video.addEventListener('playing', () => {
      clearRecoveryTimer();
      lastProgressAt = performance.now();
      if (phase === 'loop' && index === activeLoopIndex) scheduleBoundary();
    }, { passive: true });
    video.addEventListener('seeked', () => {
      if (phase === 'loop' && index === activeLoopIndex) scheduleBoundary();
    }, { passive: true });
    video.addEventListener('ratechange', () => {
      if (phase === 'loop' && index === activeLoopIndex) scheduleBoundary();
    }, { passive: true });
    video.addEventListener('waiting', () => {
      if (phase === 'loop' && index === activeLoopIndex) {
        clearBoundaryTimer();
        scheduleRecovery(false);
      }
    }, { passive: true });
    video.addEventListener('stalled', () => {
      if (phase === 'loop' && index === activeLoopIndex) scheduleRecovery(true);
    }, { passive: true });
    video.addEventListener('error', () => {
      if (phase === 'loop' && index === activeLoopIndex) scheduleRecovery(true);
    }, { passive: true });
    video.addEventListener('ended', () => {
      if (phase === 'loop' && index === activeLoopIndex && !transitionInProgress) {
        void transitionToLoop(nextLoopIndex(index));
      }
    }, { passive: true });
  });

  if (hero && 'IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextVisible = entry.isIntersecting;
      if (nextVisible === heroVisible) return;

      heroVisible = nextVisible;
      if (heroVisible && !document.hidden) resumePlayback();
      else suspendPlayback();
    }, { rootMargin: '80px 0px', threshold: 0 });

    heroObserver.observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendPlayback();
    else resumePlayback();
  });
  window.addEventListener('pagehide', suspendPlayback, { passive: true });
  window.addEventListener('pageshow', resumePlayback, { passive: true });
  window.addEventListener('online', resumePlayback, { passive: true });

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