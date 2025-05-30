// src/services/aiDetection.ts

import * as tf from '@tensorflow/tfjs';

export interface DetectedObject {
  id: string;
  class: string;
  confidence: number;
  bbox: number[]; // [x, y, width, height]
  polygon: number[][];
  center: number[];
}

export interface AIDetectionResult {
  success: boolean;
  detectedObject?: DetectedObject;
  error?: string;
}

export class AIDetectionService {
  private model: tf.GraphModel | null = null;
  private isLoading = false;
  private loadingPromise: Promise<boolean> | null = null;

  // COCO class names for road objects
  private classNames = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
  ];

  // Road-specific objects we care about
  private roadObjects = new Set([
    'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'traffic light', 
    'stop sign', 'person', 'fire hydrant', 'parking meter'
  ]);

  async loadModel(): Promise<boolean> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise(async (resolve) => {
      try {
        if (this.model) {
          resolve(true);
          return;
        }

        this.isLoading = true;
        console.log('Loading YOLOv8 model...');

        
        const modelUrl = 'https://storage.googleapis.com/tfjs-models/savedmodel/yolov8n/model.json';
        
        await tf.ready();
        
        this.model = await tf.loadGraphModel(modelUrl);
        console.log('YOLOv8 model loaded successfully!');
        
        // Warm up the model
        const dummyInput = tf.zeros([1, 640, 640, 3]);
        await this.model.predict(dummyInput);
        dummyInput.dispose();
        
        this.isLoading = false;
        resolve(true);
      } catch (error) {
        console.error('Failed to load YOLOv8 model:', error);
        this.isLoading = false;
        resolve(false);
      }
    });

    return this.loadingPromise;
  }

  async detectObjects(imageData: ImageData): Promise<DetectedObject[]> {
    try {
      if (!this.model) {
        const loaded = await this.loadModel();
        if (!loaded) {
          throw new Error('Failed to load AI model');
        }
      }

      // Preprocess image for YOLO
      const tensor = await this.preprocessImage(imageData);
      
      // Run inference
      const predictions = await this.model!.predict(tensor) as tf.Tensor;
      
      // Post-process results
      const detections = await this.postprocessPredictions(predictions, imageData.width, imageData.height);
      
      // Clean up tensors
      tensor.dispose();
      predictions.dispose();
      
      // Filter for road objects only
      const roadDetections = detections.filter(det => 
        this.roadObjects.has(det.class) && det.confidence > 0.5
      );
      
      console.log(`Detected ${roadDetections.length} road objects`);
      return roadDetections;
      
    } catch (error) {
      console.error('Object detection failed:', error);
      return [];
    }
  }

  private async preprocessImage(imageData: ImageData): Promise<tf.Tensor> {
    // Convert ImageData to tensor
    const tensor = tf.browser.fromPixels(imageData);
    
    
    const resized = tf.image.resizeBilinear(tensor, [640, 640]);
    
    
    const normalized = resized.div(255.0);
    
  
    const batched = normalized.expandDims(0);
    
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    
    return batched;
  }

  private async postprocessPredictions(predictions: tf.Tensor, originalWidth: number, originalHeight: number): Promise<DetectedObject[]> {
    const predArray = await predictions.data();
    const detections: DetectedObject[] = [];
    
    const numDetections = predArray.length / 85;
    
    for (let i = 0; i < numDetections; i++) {
      const offset = i * 85;
      
      // Extract bbox (center_x, center_y, width, height)
      const centerX = predArray[offset] * originalWidth / 640;
      const centerY = predArray[offset + 1] * originalHeight / 640;
      const width = predArray[offset + 2] * originalWidth / 640;
      const height = predArray[offset + 3] * originalHeight / 640;
      
      // Extract confidence
      const confidence = predArray[offset + 4];
      
      if (confidence < 0.5) continue;
      
      // Find best class
      let bestClass = 0;
      let bestScore = 0;
      for (let c = 0; c < 80; c++) {
        const score = predArray[offset + 5 + c] * confidence;
        if (score > bestScore) {
          bestScore = score;
          bestClass = c;
        }
      }
      
      if (bestScore < 0.5) continue;
      
      const className = this.classNames[bestClass];
      
      
      const x = centerX - width / 2;
      const y = centerY - height / 2;
      
    
      const polygon = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height]
      ];
      
      detections.push({
        id: `${className}_${i}_${Date.now()}`,
        class: className,
        confidence: bestScore,
        bbox: [x, y, width, height],
        polygon: polygon,
        center: [centerX, centerY]
      });
    }
    
    // Apply Non-Maximum Suppression
    return this.applyNMS(detections, 0.5);
  }

  private applyNMS(detections: DetectedObject[], iouThreshold: number): DetectedObject[] {
    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const keep: DetectedObject[] = [];
    
    for (const detection of detections) {
      let shouldKeep = true;
      
      for (const kept of keep) {
        const iou = this.calculateIOU(detection.bbox, kept.bbox);
        if (iou > iouThreshold) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        keep.push(detection);
      }
    }
    
    return keep;
  }

  private calculateIOU(box1: number[], box2: number[]): number {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;
    
    const intersection = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2)) *
                        Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
    
    const union = w1 * h1 + w2 * h2 - intersection;
    
    return union > 0 ? intersection / union : 0;
  }

  async findObjectAtPoint(imageData: ImageData, clickX: number, clickY: number): Promise<AIDetectionResult> {
    try {
      console.log(`AI detection at point (${clickX}, ${clickY})`);
      
      const detections = await this.detectObjects(imageData);
      
      if (detections.length === 0) {
        return { success: false, error: 'No objects detected in frame' };
      }
      
      // Find the object that contains the click point
      for (const detection of detections) {
        const [x, y, width, height] = detection.bbox;
        
        if (clickX >= x && clickX <= x + width && 
            clickY >= y && clickY <= y + height) {
          
          console.log(`Found ${detection.class} with confidence ${detection.confidence.toFixed(2)}`);
          return { success: true, detectedObject: detection };
        }
      }
      
      // If no direct hit, find the closest object
      let closestObject: DetectedObject | null = null;
      let minDistance = Infinity;
      
      for (const detection of detections) {
        const distance = Math.sqrt(
          Math.pow(clickX - detection.center[0], 2) + 
          Math.pow(clickY - detection.center[1], 2)
        );
        
        if (distance < minDistance && distance < 100) { // Within 100 pixels
          minDistance = distance;
          closestObject = detection;
        }
      }
      
      if (closestObject) {
        console.log(`Found nearby ${closestObject.class} at distance ${minDistance.toFixed(1)}px`);
        return { success: true, detectedObject: closestObject };
      }
      
      return { success: false, error: 'No object found at click location' };
      
    } catch (error) {
      console.error('AI detection error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Detection failed' };
    }
  }

  isModelLoaded(): boolean {
    return this.model !== null;
  }

  isModelLoading(): boolean {
    return this.isLoading;
  }
}

// Export singleton instance
export const aiDetectionService = new AIDetectionService();