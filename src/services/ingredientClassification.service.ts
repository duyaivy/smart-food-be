import fs from 'fs/promises';
import path from 'path';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import config from '../config/config';
import logger from '../config/logger';

export type IngredientPrediction = {
  labelId: number;
  label: string;
  confidence: number;
};

const IMG_SIZE = 224;
const RESIZE_SIZE = 256;
const CROP_OFFSET = (RESIZE_SIZE - IMG_SIZE) / 2;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

class IngredientClassificationService {
  private session: ort.InferenceSession | null = null;
  private labels: string[] | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.session && this.labels) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.initializeInternal().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }

    await this.initPromise;
  }

  isReady(): boolean {
    return Boolean(this.session && this.labels);
  }

  async predictFromFile(imagePath: string, topK = 3): Promise<IngredientPrediction[]> {
    await this.initialize();
    const inputTensor = await this.preprocessImage(imagePath);
    return this.predict(inputTensor, topK);
  }

  async predictFromBuffer(imageBuffer: Buffer, topK = 3): Promise<IngredientPrediction[]> {
    await this.initialize();
    const inputTensor = await this.preprocessImage(imageBuffer);
    return this.predict(inputTensor, topK);
  }

  private async initializeInternal() {
    const modelFilePath = path.resolve(
      process.cwd(),
      config.ingredientClassification.modelFilePath
    );
    const modelDataFilePath = path.resolve(
      process.cwd(),
      config.ingredientClassification.modelDataFilePath
    );
    const labelsFilePath = path.resolve(
      process.cwd(),
      config.ingredientClassification.labelsFilePath
    );

    await this.ensureFileExists(modelFilePath, 'ONNX model file');
    await this.ensureFileExists(labelsFilePath, 'labels file');

    const hasConfiguredModelData = await this.fileExists(modelDataFilePath);

    const labelsContent = await fs.readFile(labelsFilePath, 'utf-8');
    const rawLabels = JSON.parse(labelsContent) as string[];
    this.labels = rawLabels.map((label) => this.normalizeLabel(label));

    this.session = await this.createSessionWithModelDataFallback(
      modelFilePath,
      modelDataFilePath,
      hasConfiguredModelData
    );

    logger.info(
      `[AI] Model Classification loaded successfully (input=${this.session.inputNames[0]}, output=${this.session.outputNames[0]}, labels=${this.labels.length})`
    );
  }

  private normalizeLabel(label: string): string {
    return label.trim().replace(/\s+/g, ' ');
  }

  private async createSessionWithModelDataFallback(
    modelFilePath: string,
    configuredModelDataPath: string,
    hasConfiguredModelData: boolean
  ) {
    try {
      return await ort.InferenceSession.create(modelFilePath);
    } catch (error) {
      const missingModelDataPath = this.extractMissingModelDataPath(error);

      if (!missingModelDataPath) {
        throw error;
      }

      if (!hasConfiguredModelData) {
        throw new Error(
          `[IngredientClassification] Missing ONNX external data file at ${missingModelDataPath}. Please add the .onnx.data file into assets.`
        );
      }

      await fs.mkdir(path.dirname(missingModelDataPath), { recursive: true });

      if (path.resolve(configuredModelDataPath) !== path.resolve(missingModelDataPath)) {
        await fs.copyFile(configuredModelDataPath, missingModelDataPath);
        logger.warn(
          `[IngredientClassification] Copied model data file from ${configuredModelDataPath} to ${missingModelDataPath} to match ONNX external data name`
        );
      }

      return ort.InferenceSession.create(modelFilePath);
    }
  }

  private extractMissingModelDataPath(error: unknown): string | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/"([^"]+\.onnx\.data)"/i);
    return match?.[1] ?? null;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureFileExists(filePath: string, fileDescription: string) {
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`[IngredientClassification] Missing ${fileDescription} at ${filePath}`);
    }
  }

  private async preprocessImage(input: string | Buffer): Promise<ort.Tensor> {
    const { data, info } = await sharp(input)
      .resize(RESIZE_SIZE, RESIZE_SIZE)
      .extract({
        left: CROP_OFFSET,
        top: CROP_OFFSET,
        width: IMG_SIZE,
        height: IMG_SIZE
      })
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const float32 = new Float32Array(3 * IMG_SIZE * IMG_SIZE);
    for (let h = 0; h < IMG_SIZE; h++) {
      for (let w = 0; w < IMG_SIZE; w++) {
        const srcIdx = (h * IMG_SIZE + w) * info.channels;

        for (let c = 0; c < 3; c++) {
          const pixel = data[srcIdx + c] / 255;
          float32[c * IMG_SIZE * IMG_SIZE + h * IMG_SIZE + w] = (pixel - MEAN[c]) / STD[c];
        }
      }
    }

    return new ort.Tensor('float32', float32, [1, 3, IMG_SIZE, IMG_SIZE]);
  }

  private async predict(inputTensor: ort.Tensor, topK: number): Promise<IngredientPrediction[]> {
    if (!this.session || !this.labels) {
      throw new Error('[IngredientClassification] Model is not initialized');
    }

    const inputName = this.session.inputNames[0];
    const outputName = this.session.outputNames[0];

    const results = await this.session.run({
      [inputName]: inputTensor
    });

    const output = results[outputName];
    if (!output?.data) {
      throw new Error('[IngredientClassification] Model output is empty');
    }

    const logits = Array.from(output.data as Float32Array | number[]);
    const max = Math.max(...logits);
    const exps = logits.map((value) => Math.exp(value - max));
    const sum = exps.reduce((acc, value) => acc + value, 0);

    const probabilities = exps.map((value, index) => ({
      index,
      probability: value / sum
    }));

    const normalizedTopK = Math.max(1, Math.min(topK, probabilities.length));

    return probabilities
      .sort((a, b) => b.probability - a.probability)
      .slice(0, normalizedTopK)
      .map(({ index, probability }) => ({
        labelId: index,
        label: this.normalizeLabel(this.labels?.[index] ?? `unknown-${index}`),
        confidence: Number(probability.toFixed(4))
      }));
  }
}

const ingredientClassifierService = new IngredientClassificationService();

export default ingredientClassifierService;
