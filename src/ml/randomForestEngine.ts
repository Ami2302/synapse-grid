import type { DatasetRecord } from '../simulation/types';
import type { ClassificationMetrics, FeatureImportance } from './types';
import { DataPreprocessor, FEATURE_NAMES } from './preprocessing';
import { computeClassificationMetrics } from './metrics';

interface TreeNode {
  featureIdx?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  classLabel?: number;
}

export class DecisionTree {
  public root: TreeNode | null = null;
  public featureImportanceCounts: number[] = new Array(8).fill(0);
  public maxDepth: number;

  constructor(maxDepth: number = 6) {
    this.maxDepth = maxDepth;
  }

  private calculateGini(labels: number[]): number {
    if (labels.length === 0) return 0;
    const counts: Record<number, number> = {};
    for (const l of labels) counts[l] = (counts[l] || 0) + 1;
    let sumSq = 0;
    for (const c of Object.values(counts)) {
      const p = c / labels.length;
      sumSq += p * p;
    }
    return 1.0 - sumSq;
  }

  private build(X: number[][], y: number[], depth: number = 0): TreeNode {
    if (depth >= this.maxDepth || y.length <= 2 || new Set(y).size === 1) {
      const counts: Record<number, number> = {};
      for (const l of y) counts[l] = (counts[l] || 0) + 1;
      let maxCount = -1;
      let bestClass = 0;
      for (const [cls, cnt] of Object.entries(counts)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          bestClass = Number(cls);
        }
      }
      return { classLabel: bestClass };
    }

    const numFeatures = X[0].length;
    // Subsample sqrt(features) for Random Forest candidate features
    const numSub = Math.max(1, Math.floor(Math.sqrt(numFeatures)));
    const selectedFeatures: number[] = [];
    while (selectedFeatures.length < numSub) {
      const randF = Math.floor(Math.random() * numFeatures);
      if (!selectedFeatures.includes(randF)) selectedFeatures.push(randF);
    }

    let bestGiniGain = -1;
    let bestFeature = 0;
    let bestThreshold = 0;
    let bestLeftX: number[][] = [];
    let bestLeftY: number[] = [];
    let bestRightX: number[][] = [];
    let bestRightY: number[] = [];

    const parentGini = this.calculateGini(y);

    for (const fIdx of selectedFeatures) {
      const values = X.map((row) => row[fIdx]).sort((a, b) => a - b);
      const step = Math.max(1, Math.floor(values.length / 10));

      for (let i = 0; i < values.length; i += step) {
        const thresh = values[i];
        const leftX: number[][] = [];
        const leftY: number[] = [];
        const rightX: number[][] = [];
        const rightY: number[] = [];

        for (let r = 0; r < X.length; r++) {
          if (X[r][fIdx] <= thresh) {
            leftX.push(X[r]);
            leftY.push(y[r]);
          } else {
            rightX.push(X[r]);
            rightY.push(y[r]);
          }
        }

        if (leftY.length === 0 || rightY.length === 0) continue;

        const leftGini = this.calculateGini(leftY);
        const rightGini = this.calculateGini(rightY);
        const weightedGini = (leftY.length / y.length) * leftGini + (rightY.length / y.length) * rightGini;
        const gain = parentGini - weightedGini;

        if (gain > bestGiniGain) {
          bestGiniGain = gain;
          bestFeature = fIdx;
          bestThreshold = thresh;
          bestLeftX = leftX;
          bestLeftY = leftY;
          bestRightX = rightX;
          bestRightY = rightY;
        }
      }
    }

    if (bestGiniGain <= 0 || bestLeftY.length === 0 || bestRightY.length === 0) {
      const counts: Record<number, number> = {};
      for (const l of y) counts[l] = (counts[l] || 0) + 1;
      let maxCount = -1;
      let bestClass = 0;
      for (const [cls, cnt] of Object.entries(counts)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          bestClass = Number(cls);
        }
      }
      return { classLabel: bestClass };
    }

    this.featureImportanceCounts[bestFeature] += bestGiniGain * y.length;

    const node: TreeNode = {
      featureIdx: bestFeature,
      threshold: bestThreshold,
      left: this.build(bestLeftX, bestLeftY, depth + 1),
      right: this.build(bestRightX, bestRightY, depth + 1),
    };

    return node;
  }

  public fit(X: number[][], y: number[]) {
    this.featureImportanceCounts = new Array(X[0]?.length ?? 8).fill(0);
    this.root = this.build(X, y, 0);
  }

  public predict(x: number[]): number {
    let curr = this.root;
    while (curr && curr.classLabel === undefined) {
      if (curr.featureIdx !== undefined && curr.threshold !== undefined) {
        if (x[curr.featureIdx] <= curr.threshold) {
          curr = curr.left || null;
        } else {
          curr = curr.right || null;
        }
      } else {
        break;
      }
    }
    return curr && curr.classLabel !== undefined ? curr.classLabel : 0;
  }
}

export class RandomForestEngine {
  private trees: DecisionTree[] = [];

  /** Fits the forest on pre-built feature arrays (bootstrap + random feature subsets). Returns raw importances. */
  public fitArrays(trainX: number[][], trainY: number[], numTrees: number = 12, maxDepth: number = 6): number[] {
    this.trees = [];
    const numFeatures = trainX[0]?.length ?? 0;
    const aggregatedImportance = new Array(numFeatures).fill(0);

    for (let t = 0; t < numTrees; t++) {
      const bootX: number[][] = [];
      const bootY: number[] = [];
      for (let i = 0; i < trainX.length; i++) {
        const randIdx = Math.floor(Math.random() * trainX.length);
        bootX.push(trainX[randIdx]);
        bootY.push(trainY[randIdx]);
      }
      const tree = new DecisionTree(maxDepth);
      tree.fit(bootX, bootY);
      this.trees.push(tree);
      for (let f = 0; f < numFeatures; f++) aggregatedImportance[f] += tree.featureImportanceCounts[f];
    }
    return aggregatedImportance;
  }

  /** Class probabilities = fraction of trees voting for each class. */
  public predictProba(x: number[]): number[] {
    const probs = new Array(5).fill(0);
    for (const tree of this.trees) probs[tree.predict(x)] += 1;
    const n = Math.max(1, this.trees.length);
    return probs.map((v) => v / n);
  }

  public predictClass(x: number[]): number {
    const p = this.predictProba(x);
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    return best;
  }

  public train(
    dataset: DatasetRecord[],
    numTrees: number = 12,
    maxDepth: number = 6
  ): { metrics: ClassificationMetrics; featureImportances: FeatureImportance[] } {
    const startTime = performance.now();

    const { X, y } = DataPreprocessor.preprocess(dataset);
    const { train, test } = DataPreprocessor.trainTestSplit(
      X.map((x, i) => ({ x, y: y[i] })),
      0.25,
      true
    );

    const aggregatedImportance = this.fitArrays(train.map((s) => s.x), train.map((s) => s.y), numTrees, maxDepth);

    const totalImp = aggregatedImportance.reduce((a, b) => a + b, 0) || 1e-6;
    const featureImportances: FeatureImportance[] = FEATURE_NAMES.map((name, idx) => ({
      featureName: name,
      importance: Number((aggregatedImportance[idx] / totalImp).toFixed(4)),
    })).sort((a, b) => b.importance - a.importance);

    const actual = test.map((s) => s.y);
    const predicted = test.map((s) => this.predictClass(s.x));

    return {
      metrics: computeClassificationMetrics(actual, predicted, performance.now() - startTime, train.length),
      featureImportances,
    };
  }
}
