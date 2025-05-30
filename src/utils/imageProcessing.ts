// src/utils/imageProcessing.ts

export interface VideoFrameCapture {
  imageData: ImageData;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class ImageProcessingUtils {
  
  static captureVideoFrame(videoElement: HTMLVideoElement): VideoFrameCapture | null {
    try {
      if (!videoElement || videoElement.readyState < 2) {
        console.warn('Video not ready for frame capture');
        return null;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Failed to get canvas context');
        return null;
      }

      // Use actual video dimensions
      const width = videoElement.videoWidth || videoElement.clientWidth || 640;
      const height = videoElement.videoHeight || videoElement.clientHeight || 480;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw current video frame
      ctx.drawImage(videoElement, 0, 0, width, height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      
      return {
        imageData,
        canvas,
        width,
        height
      };
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  }

  static canvasToVideoCoordinates(
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number,
    videoWidth: number,
    videoHeight: number
  ): { x: number; y: number } {
    const scaleX = videoWidth / canvasWidth;
    const scaleY = videoHeight / canvasHeight;
    
    return {
      x: Math.round(canvasX * scaleX),
      y: Math.round(canvasY * scaleY)
    };
  }

  static videoToCanvasCoordinates(
    videoX: number,
    videoY: number,
    canvasWidth: number,
    canvasHeight: number,
    videoWidth: number,
    videoHeight: number
  ): { x: number; y: number } {
    const scaleX = canvasWidth / videoWidth;
    const scaleY = canvasHeight / videoHeight;
    
    return {
      x: Math.round(videoX * scaleX),
      y: Math.round(videoY * scaleY)
    };
  }

  static scalePolygonToCanvas(
    polygon: number[][],
    canvasWidth: number,
    canvasHeight: number,
    videoWidth: number,
    videoHeight: number
  ): number[][] {
    return polygon.map(([x, y]) => {
      const scaled = this.videoToCanvasCoordinates(
        x, y, canvasWidth, canvasHeight, videoWidth, videoHeight
      );
      return [scaled.x, scaled.y];
    });
  }

  static smoothPolygon(polygon: number[][], smoothingFactor: number = 0.3): number[][] {
    if (polygon.length < 3) return polygon;

    const smoothed: number[][] = [];
    
    for (let i = 0; i < polygon.length; i++) {
      const prev = polygon[(i - 1 + polygon.length) % polygon.length];
      const curr = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      const smoothX = curr[0] + smoothingFactor * ((prev[0] + next[0]) / 2 - curr[0]);
      const smoothY = curr[1] + smoothingFactor * ((prev[1] + next[1]) / 2 - curr[1]);
      
      smoothed.push([smoothX, smoothY]);
    }
    
    return smoothed;
  }

  static simplifyPolygon(polygon: number[][], tolerance: number = 2): number[][] {
    if (polygon.length <= 3) return polygon;

    const simplified: number[][] = [polygon[0]];
    
    for (let i = 1; i < polygon.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = polygon[i];
      const next = polygon[i + 1];
      
      const distance = this.pointToLineDistance(curr, prev, next);
      
      if (distance > tolerance) {
        simplified.push(curr);
      }
    }
    
    simplified.push(polygon[polygon.length - 1]);
    
    return simplified;
  }

  // Calculate distance from point to line
  private static pointToLineDistance(
    point: number[],
    lineStart: number[],
    lineEnd: number[]
  ): number {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  static validatePolygon(polygon: number[][]): { valid: boolean; error?: string } {
    if (polygon.length < 3) {
      return { valid: false, error: 'Polygon must have at least 3 points' };
    }

    for (let i = 0; i < polygon.length; i++) {
      const curr = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      const distance = Math.sqrt(
        Math.pow(next[0] - curr[0], 2) + Math.pow(next[1] - curr[1], 2)
      );
      
      if (distance < 1) {
        return { valid: false, error: 'Polygon has duplicate points' };
      }
    }

    const area = this.calculatePolygonArea(polygon);
    if (area < 10) {
      return { valid: false, error: 'Polygon area too small' };
    }

    return { valid: true };
  }


  private static calculatePolygonArea(polygon: number[][]): number {
    let area = 0;
    const n = polygon.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += polygon[i][0] * polygon[j][1];
      area -= polygon[j][0] * polygon[i][1];
    }
    
    return Math.abs(area) / 2;
  }

    static createDetectionPreview(
    polygon: number[][],
    canvas: HTMLCanvasElement,
    color: string = '#00ff00'
  ): HTMLCanvasElement {
    const previewCanvas = canvas.cloneNode() as HTMLCanvasElement;
    const ctx = previewCanvas.getContext('2d');
    
    if (!ctx || polygon.length < 3) return previewCanvas;

    ctx.drawImage(canvas, 0, 0);
    
    // Draw polygon overlay
    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i][0], polygon[i][1]);
    }
    
    ctx.closePath();
    
    ctx.fillStyle = color + '40';
    ctx.fill();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    polygon.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#ff0000' : color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    return previewCanvas;
  }
}