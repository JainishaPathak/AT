// src/services/smartDetection.ts

import { aiDetectionService } from './aiDetection';

export interface SmartDetectionResult {
  success: boolean;
  polygon: number[][];
  error?: string;
  objectClass?: string;
  confidence?: number;
}

export class SmartDetectionService {
  
  captureVideoFrame(videoElement: HTMLVideoElement): ImageData | null {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;

      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  }

  async waitForModel(): Promise<boolean> {
    return await aiDetectionService.loadModel();
  }

  async detectObject(
    imageData: ImageData, 
    clickX: number, 
    clickY: number
  ): Promise<SmartDetectionResult> {
    try {
      console.log('Smart detection using AI...');
      
      // Ensure AI model is loaded
      if (!aiDetectionService.isModelLoaded()) {
        console.log('Loading AI model...');
        const loaded = await aiDetectionService.loadModel();
        if (!loaded) {
          return this.fallbackDetection(clickX, clickY);
        }
      }

      // Use AI to find object at click point
      const result = await aiDetectionService.findObjectAtPoint(imageData, clickX, clickY);
      
      if (result.success && result.detectedObject) {
        const obj = result.detectedObject;
        
        return {
          success: true,
          polygon: obj.polygon,
          objectClass: obj.class,
          confidence: obj.confidence
        };
      } else {
        console.log('AI detection failed, using fallback');
        return this.fallbackDetection(clickX, clickY);
      }

    } catch (error) {
      console.error('Smart detection error:', error);
      return this.fallbackDetection(clickX, clickY);
    }
  }

  // Fallback detection when AI fails
  private fallbackDetection(clickX: number, clickY: number): SmartDetectionResult {
    const size = 40;
    const polygon = [
      [clickX - size, clickY - size],
      [clickX + size, clickY - size],
      [clickX + size, clickY + size],
      [clickX - size, clickY + size]
    ];
    
    console.log('Using fallback rectangle detection');
    return { 
      success: true, 
      polygon, 
      objectClass: 'unknown',
      confidence: 0.5
    };
  }

  // Simple detection method (keeping for compatibility)
  async simpleDetection(
    imageData: ImageData,
    clickX: number,
    clickY: number
  ): Promise<SmartDetectionResult> {
    return this.detectObject(imageData, clickX, clickY);
  }

  // Check if AI model is ready
  isAIReady(): boolean {
    return aiDetectionService.isModelLoaded();
  }

  // Check if AI model is loading
  isAILoading(): boolean {
    return aiDetectionService.isModelLoading();
  }
}


export const smartDetectionService = new SmartDetectionService();