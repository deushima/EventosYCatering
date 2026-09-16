import { queryAll } from '../shared/dom';

const DESCRIPTION_SELECTOR = '.menu-item__description';
const NON_BREAKING_SPACE = '\u00A0';
const WIDTH_EPSILON = 0.5;
const TARGET_MINIMUM_WORDS = 8;
const TARGET_IDEAL_WORDS = 9;
const MAXIMUM_WORDS_PER_LINE = 10;
const MINIMUM_NON_FINAL_WORDS = 2;
const MINIMUM_FINAL_WORDS = 3;
const MINIMUM_PREVIOUS_LINE_FILL = 0.58;
const MINIMUM_PREVIOUS_LINE_WIDTH = 0.55;
const ONE_LINE_MAXIMUM_FILL = 0.84;
const MULTI_LINE_MAXIMUM_FILL = 0.9;
const MULTI_LINE_MINIMUM_FILL = 0.54;
const MAXIMUM_EXTRA_LINE_COUNTS = 1;
const EXTRA_LINE_PENALTY = 0.42;
const COHERENCE_LOWER_RATIO = 0.86;
const COHERENCE_UPPER_RATIO = 1.16;

interface BalancedLine {
  words: string[];
  width: number;
}

interface BalancedLayout {
  lines: BalancedLine[];
  localCost: number;
  requiredWidth: number;
}

interface DescriptionMetrics {
  element: HTMLElement;
  source: string;
  words: string[];
  maxWidth: number;
  measure: TextMeasure;
}

interface DescriptionPlan {
  metrics: DescriptionMetrics;
  candidates: BalancedLayout[];
  localBest: BalancedLayout;
}

interface ReferenceWidths {
  byComposition: Map<string, number>;
  byLineCount: Map<number, number>;
}

type TextMeasure = (value: string) => number;

let measurementNode: HTMLSpanElement | null = null;

const median = (values: number[]): number => {
  if (!values.length) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) return 0;

  if (sorted.length % 2 === 1) return upper;
  return ((sorted[middle - 1] ?? upper) + upper) / 2;
};

const getMeasurementNode = (): HTMLSpanElement => {
  if (measurementNode) return measurementNode;

  measurementNode = document.createElement('span');
  Object.assign(measurementNode.style, {
    position: 'fixed',
    top: '0',
    left: '-100000px',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    contain: 'layout style paint'
  });
  measurementNode.setAttribute('aria-hidden', 'true');
  document.body.append(measurementNode);
  return measurementNode;
};

const createTextMeasure = (element: HTMLElement): TextMeasure => {
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
  const cache = new Map<string, number>();

  return (value: string): number => {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;

    Object.assign(node.style, styles);
    node.textContent = value;
    const width = node.getBoundingClientRect().width;
    cache.set(value, width);
    return width;
  };
};

const calculateLocalCost = (
  lines: BalancedLine[],
  maxWidth: number,
  extraLineCounts: number
): number => {
  const widths = lines.map((line) => line.width);
  const wordCounts = lines.map((line) => line.words.length);
  const meanWidth = widths.reduce((total, width) => total + width, 0) / widths.length;
  const meanWords = wordCounts.reduce((total, count) => total + count, 0) / wordCounts.length;
  const normalizeWidth = (value: number): number => value / Math.max(maxWidth, 1);
  const normalizeWords = (value: number): number => value / MAXIMUM_WORDS_PER_LINE;

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
    if (previous === undefined) return total;
    const delta = normalizeWidth(previous - width);
    return total + delta * delta;
  }, 0) / Math.max(widths.length - 1, 1);

  const requiredWidth = Math.max(...widths);
  const availableFill = requiredWidth / Math.max(maxWidth, 1);
  const maximumFill = lines.length === 1
    ? ONE_LINE_MAXIMUM_FILL
    : MULTI_LINE_MAXIMUM_FILL;
  const overfill = Math.max(0, availableFill - maximumFill);
  const overfillPenalty = overfill * overfill * (lines.length === 1 ? 180 : 70);
  const underfill = lines.length > 1
    ? Math.max(0, MULTI_LINE_MINIMUM_FILL - availableFill)
    : 0;
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

  return (
    nonFinalTargetPenalty +
    wordBalance * 1.1 +
    widthBalance * 1.5 +
    adjacentWidthDifference * 0.75 +
    overfillPenalty +
    underfillPenalty +
    tailPenalty +
    extraLineCounts * EXTRA_LINE_PENALTY
  );
};

const minimumWordsRequired = (remainingLines: number): number => {
  if (remainingLines <= 0) return 0;
  if (remainingLines === 1) return MINIMUM_FINAL_WORDS;
  return (remainingLines - 1) * MINIMUM_NON_FINAL_WORDS + MINIMUM_FINAL_WORDS;
};

const generateLayoutsForLineCount = (
  words: string[],
  lineCount: number,
  maxWidth: number,
  measure: TextMeasure
): BalancedLine[][] => {
  const layouts: BalancedLine[][] = [];
  const current: BalancedLine[] = [];

  const visit = (start: number, remainingLines: number): void => {
    const remainingWords = words.length - start;
    const minimumRequired = lineCount === 1 ? 1 : minimumWordsRequired(remainingLines);
    const maximumAllowed = remainingLines * MAXIMUM_WORDS_PER_LINE;
    if (remainingWords < minimumRequired || remainingWords > maximumAllowed) return;

    if (remainingLines === 1) {
      const finalWords = words.slice(start);
      const minimumFinalWords = lineCount === 1 ? 1 : MINIMUM_FINAL_WORDS;
      if (
        finalWords.length < minimumFinalWords ||
        finalWords.length > MAXIMUM_WORDS_PER_LINE
      ) {
        return;
      }

      const width = measure(finalWords.join(' '));
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
      const width = measure(lineWords.join(' '));
      if (width > maxWidth + WIDTH_EPSILON) break;

      current.push({ words: lineWords, width });
      visit(end, followingLines);
      current.pop();
    }
  };

  visit(0, lineCount);
  return layouts;
};

const generateIndividualCandidates = (metrics: DescriptionMetrics): BalancedLayout[] => {
  const { words, maxWidth, measure } = metrics;
  if (!words.length) return [];

  const theoreticalMinimum = Math.max(1, Math.ceil(words.length / MAXIMUM_WORDS_PER_LINE));
  const maximumLineCount = words.length === 1
    ? 1
    : Math.max(
      theoreticalMinimum,
      1 + Math.floor((words.length - MINIMUM_FINAL_WORDS) / MINIMUM_NON_FINAL_WORDS)
    );
  let firstFeasibleLineCount: number | null = null;
  const candidates: BalancedLayout[] = [];

  for (let lineCount = theoreticalMinimum; lineCount <= maximumLineCount; lineCount += 1) {
    const geometries = generateLayoutsForLineCount(words, lineCount, maxWidth, measure);
    if (!geometries.length) continue;

    firstFeasibleLineCount ??= lineCount;
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

const selectLowestLocalCost = (layouts: BalancedLayout[]): BalancedLayout | null => {
  let selected: BalancedLayout | null = null;

  layouts.forEach((layout) => {
    if (!selected || layout.localCost < selected.localCost) selected = layout;
  });

  return selected;
};

const getCompositionKey = (wordCount: number, lineCount: number): string => {
  const averageWordsPerLine = Math.max(1, Math.round(wordCount / Math.max(lineCount, 1)));
  return `${lineCount}:${averageWordsPerLine}`;
};

const selectCoherentLayout = (
  plan: DescriptionPlan,
  referenceWidth: number
): BalancedLayout => {
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
    const coherenceCost =
      distance * distance * 0.08 +
      (belowBand * belowBand + aboveBand * aboveBand) * 1.05;
    const combinedCost = candidate.localCost + coherenceCost;

    if (combinedCost < selectedCost) {
      selected = candidate;
      selectedCost = combinedCost;
    }
  });

  return selected;
};

const getAvailableDescriptionWidth = (element: HTMLElement): number => {
  const parent = element.parentElement;
  if (!parent) return element.getBoundingClientRect().width;

  const computed = window.getComputedStyle(parent);
  const horizontalPadding =
    Number.parseFloat(computed.paddingLeft || '0') +
    Number.parseFloat(computed.paddingRight || '0');

  return Math.max(0, parent.getBoundingClientRect().width - horizontalPadding);
};

const renderBalancedDescription = (
  metrics: DescriptionMetrics,
  layout: BalancedLayout
): void => {
  const fragment = document.createDocumentFragment();

  layout.lines.forEach((line, index) => {
    if (index > 0) fragment.append(document.createElement('br'));
    fragment.append(document.createTextNode(line.words.join(NON_BREAKING_SPACE)));
  });

  metrics.element.replaceChildren(fragment);
  metrics.element.style.maxWidth = 'none';
  metrics.element.style.width = `${Math.ceil(Math.min(metrics.maxWidth, layout.requiredWidth + 1))}px`;
  metrics.element.setAttribute('aria-label', metrics.source);
};

const collectMetrics = (descriptions: HTMLElement[]): DescriptionMetrics[] => {
  descriptions.forEach((element) => {
    element.style.removeProperty('width');
    element.style.maxWidth = 'none';
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

const createPlans = (metrics: DescriptionMetrics[]): DescriptionPlan[] =>
  metrics.flatMap((descriptionMetrics) => {
    const candidates = generateIndividualCandidates(descriptionMetrics);
    const localBest = selectLowestLocalCost(candidates);
    if (!localBest) return [];

    return [{ metrics: descriptionMetrics, candidates, localBest }];
  });

const createReferenceWidths = (plans: DescriptionPlan[]): ReferenceWidths => {
  const compositionGroups = new Map<string, number[]>();
  const lineCountGroups = new Map<number, number[]>();

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

  const byComposition = new Map<string, number>();
  const byLineCount = new Map<number, number>();
  compositionGroups.forEach((widths, key) => byComposition.set(key, median(widths)));
  lineCountGroups.forEach((widths, lineCount) => byLineCount.set(lineCount, median(widths)));

  return { byComposition, byLineCount };
};

const getReferenceWidth = (
  plan: DescriptionPlan,
  references: ReferenceWidths
): number => {
  const lineCount = plan.localBest.lines.length;
  const compositionKey = getCompositionKey(plan.metrics.words.length, lineCount);

  return references.byComposition.get(compositionKey)
    ?? references.byLineCount.get(lineCount)
    ?? plan.localBest.requiredWidth;
};

export const observeBalancedMenuDescriptions = (root: ParentNode): void => {
  const descriptions = queryAll<HTMLElement>(DESCRIPTION_SELECTOR, root);
  if (!descriptions.length) return;

  let animationFrame = 0;

  const balanceAll = (): void => {
    animationFrame = 0;
    const plans = createPlans(collectMetrics(descriptions));
    if (!plans.length) return;

    const references = createReferenceWidths(plans);

    plans.forEach((plan) => {
      const layout = selectCoherentLayout(plan, getReferenceWidth(plan, references));
      renderBalancedDescription(plan.metrics, layout);
    });
  };

  const scheduleBalance = (): void => {
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(balanceAll);
  };

  scheduleBalance();

  const supportsResizeObserver = typeof ResizeObserver !== 'undefined';
  if (supportsResizeObserver) {
    const observedWidths = new WeakMap<Element, number>();
    const observer = new ResizeObserver((entries) => {
      const widthChanged = entries.some((entry) => {
        const width = entry.contentRect.width;
        const previousWidth = observedWidths.get(entry.target);
        observedWidths.set(entry.target, width);
        return previousWidth === undefined || Math.abs(previousWidth - width) >= WIDTH_EPSILON;
      });

      if (widthChanged) scheduleBalance();
    });

    if (root instanceof Element) observer.observe(root);
  } else {
    window.addEventListener('resize', scheduleBalance, { passive: true });
  }

  void document.fonts.ready.then(scheduleBalance);
};
