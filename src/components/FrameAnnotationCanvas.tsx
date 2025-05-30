import { useEffect, useRef, useState } from 'react';
import { smartDetectionService } from '../services/smartDetection';
import { ImageProcessingUtils } from '../utils/imageProcessing';

interface FrameAnnotation {
  id: string;
  frameNumber: number;
  timestamp: number;
  type: string;
  points: number[][];
  category: string;
  confidence?: number;
  createdAt?: string;
}

interface FrameAnnotationCanvasProps {
  currentTool: string;
  currentFrame: number;
  annotations: FrameAnnotation[];
  onAnnotationAdd: (annotation: Omit<FrameAnnotation, 'frameNumber' | 'timestamp'>) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationUpdate: (annotationId: string, updates: Partial<FrameAnnotation>) => void;
  isPlaying: boolean;
  selectedCategory: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

const FrameAnnotationCanvas: React.FC<FrameAnnotationCanvasProps> = ({
  currentTool,
  currentFrame,
  annotations,
  onAnnotationAdd,
  onAnnotationDelete,
  onAnnotationUpdate,
  isPlaying,
  selectedCategory,
  videoRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPolygon, setCurrentPolygon] = useState<number[][]>([]);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<number[] | null>(null);
  const [rectEnd, setRectEnd] = useState<number[] | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{annotationId: string, pointIndex: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<number[] | null>(null);
  const [showPolygonHelper, setShowPolygonHelper] = useState(false);
  const [isSmartDetecting, setIsSmartDetecting] = useState(false);
  const [smartDetectionPreview, setSmartDetectionPreview] = useState<number[][] | null>(null);

  useEffect(() => {
    if (isPlaying) {
      setCurrentPolygon([]);
      setSelectedAnnotation(null);
      setIsDrawingRect(false);
      setRectStart(null);
      setRectEnd(null);
      setShowPolygonHelper(false);
      setSmartDetectionPreview(null);
    }
  }, [isPlaying]);

  useEffect(() => {
    setCurrentPolygon([]);
    setIsDrawingRect(false);
    setRectStart(null);
    setRectEnd(null);
    setShowPolygonHelper(false);
    setSelectedAnnotation(null);
    setSmartDetectionPreview(null);
  }, [currentFrame]);

  useEffect(() => {
    setCurrentPolygon([]);
    setIsDrawingRect(false);
    setRectStart(null);
    setRectEnd(null);
    setShowPolygonHelper(false);
    setSelectedAnnotation(null);
    setSmartDetectionPreview(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [currentTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation, annotation.id === selectedAnnotation);
    });

    if (!isPlaying) {
      if (currentPolygon.length > 0) {
        drawCurrentPolygon(ctx, currentPolygon);
      }

      if (isDrawingRect && rectStart && rectEnd) {
        drawRectanglePreview(ctx, rectStart, rectEnd);
      }

      if (smartDetectionPreview && smartDetectionPreview.length > 0) {
        drawSmartDetectionPreview(ctx, smartDetectionPreview);
      }

      if (showPolygonHelper || isSmartDetecting || currentTool === 'smart') {
        drawPolygonHelper(ctx);
      }
    }
  }, [annotations, currentPolygon, selectedAnnotation, isPlaying, currentFrame, isDrawingRect, rectStart, rectEnd, showPolygonHelper, isSmartDetecting, smartDetectionPreview, currentTool]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: FrameAnnotation, isSelected: boolean) => {
    if (annotation.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(annotation.points[0][0], annotation.points[0][1]);
    
    for (let i = 1; i < annotation.points.length; i++) {
      ctx.lineTo(annotation.points[i][0], annotation.points[i][1]);
    }
    
    if (annotation.type === 'polygon') {
      ctx.closePath();
    }
    
    if (isSelected) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 3;
    } else if (annotation.confidence && annotation.confidence > 0.9) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
    } else if (annotation.confidence && annotation.confidence > 0.7) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 2;
    }
    
    ctx.stroke();
    
    ctx.fillStyle = ctx.strokeStyle + '30';
    ctx.fill();
    
    if (isSelected) {
      annotation.points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 6, 0, 2 * Math.PI);
        ctx.fillStyle = hoveredPoint?.annotationId === annotation.id && hoveredPoint?.pointIndex === index 
          ? '#fff' : ctx.strokeStyle;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    
    if (annotation.points.length > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      
      const label = annotation.confidence 
        ? `${annotation.category} (${Math.round(annotation.confidence * 100)}%)`
        : annotation.category;
      
      const textMetrics = ctx.measureText(label);
      ctx.fillStyle = '#000000cc';
      ctx.fillRect(annotation.points[0][0], annotation.points[0][1] - 18, textMetrics.width + 8, 16);
      
      ctx.fillStyle = '#fff';
      ctx.fillText(label, annotation.points[0][0] + 4, annotation.points[0][1] - 6);
    }
  };

  const drawCurrentPolygon = (ctx: CanvasRenderingContext2D, points: number[][]) => {
    if (points.length < 1) return;

    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    if (points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(points[points.length - 1][0], points[points.length - 1][1]);
      ctx.lineTo(points[0][0], points[0][1]);
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
      
      if (index === 0) {
        ctx.fillStyle = '#ff0000';
        ctx.arc(point[0], point[1], 7, 0, 2 * Math.PI);
      } else {
        ctx.fillStyle = '#2196f3';
      }
      
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const drawRectanglePreview = (ctx: CanvasRenderingContext2D, start: number[], end: number[]) => {
    ctx.beginPath();
    ctx.rect(start[0], start[1], end[0] - start[0], end[1] - start[1]);
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#2196f330';
    ctx.fill();
  };

  const drawSmartDetectionPreview = (ctx: CanvasRenderingContext2D, polygon: number[][]) => {
    if (polygon.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i][0], polygon[i][1]);
    }
    
    ctx.closePath();
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#00ff0040';
    ctx.fill();
    
    polygon.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point[0], point[1], 6, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#ff0000' : '#00ff00';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

 
  const drawPolygonHelper = (ctx: CanvasRenderingContext2D) => {
  let helpText = "";
  let buttonText = "";
  
  if (isSmartDetecting) {
    helpText = "🤖 AI detection in progress...";
  } else if (currentTool === 'smart') {
    if (smartDetectionService.isAIReady()) {
      helpText = "🎯 AI Ready - Double-click on any object";
    } else if (smartDetectionService.isAILoading()) {
      helpText = "⏳ Loading AI model... Please wait";
    } else {
      helpText = "❌ AI model failed to load - Using fallback";
    }
  } else if (currentPolygon.length === 0) {
    helpText = "Click to start polygon";
  } else if (currentPolygon.length < 3) {
    helpText = `Click to add point (${currentPolygon.length} points) - Need ${3 - currentPolygon.length} more`;
  } else {
    helpText = `Polygon ready (${currentPolygon.length} points) - Click Complete button`;
    buttonText = "Complete Polygon";
  }
  
  const helpWidth = 450;
  ctx.fillStyle = '#000000cc';
  ctx.fillRect(10, 10, helpWidth, 30);
  
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  ctx.fillText(helpText, 15, 30);
  
  if (smartDetectionPreview && smartDetectionPreview.length >= 3) {
    const confirmButtonWidth = 150;
    const rejectButtonWidth = 100;
    const buttonHeight = 25;
    const confirmButtonX = 10;
    const rejectButtonX = confirmButtonX + confirmButtonWidth + 10;
    const buttonY = 45;
    
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(confirmButtonX, buttonY, confirmButtonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(confirmButtonX, buttonY, confirmButtonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Accept Detection', confirmButtonX + 15, buttonY + 16);
    
    ctx.fillStyle = '#f44336';
    ctx.fillRect(rejectButtonX, buttonY, rejectButtonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(rejectButtonX, buttonY, rejectButtonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Reject', rejectButtonX + 25, buttonY + 16);
  }
  
  if (currentPolygon.length >= 3 && currentTool === 'polygon') {
    const buttonWidth = 120;
    const buttonHeight = 25;
    const buttonX = 10;
    const buttonY = 45;
    
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    const textMetrics = ctx.measureText(buttonText);
    const textX = buttonX + (buttonWidth - textMetrics.width) / 2;
    const textY = buttonY + buttonHeight / 2 + 4;
    ctx.fillText(buttonText, textX, textY);
  }
};

  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const findAnnotationAtPoint = (x: number, y: number): FrameAnnotation | null => {
    for (const annotation of annotations) {
      if (annotation.type === 'polygon' && isPointInPolygon(x, y, annotation.points)) {
        return annotation;
      } else if (annotation.type === 'rectangle' && isPointInRectangle(x, y, annotation.points)) {
        return annotation;
      }
    }
    return null;
  };

  const isPointInPolygon = (x: number, y: number, polygon: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i][1] > y) !== (polygon[j][1] > y)) &&
          (x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
        inside = !inside;
      }
    }
    return inside;
  };

  const isPointInRectangle = (x: number, y: number, points: number[][]): boolean => {
    if (points.length !== 4) return false;
    const minX = Math.min(...points.map(p => p[0]));
    const maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  const createRectanglePoints = (start: number[], end: number[]): number[][] => {
    return [
      [start[0], start[1]],
      [end[0], start[1]],
      [end[0], end[1]],
      [start[0], end[1]]
    ];
  };

  const isNearPoint = (x: number, y: number, point: number[], threshold = 15): boolean => {
    return Math.sqrt(Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2)) < threshold;
  };

  const isClickOnCompleteButton = (x: number, y: number): boolean => {
    if (currentPolygon.length < 3) return false;
    
    const buttonX = 10;
    const buttonY = 45;
    const buttonWidth = 120;
    const buttonHeight = 25;
    
    return x >= buttonX && x <= buttonX + buttonWidth && 
           y >= buttonY && y <= buttonY + buttonHeight;
  };

  const isClickOnAcceptButton = (x: number, y: number): boolean => {
    if (!smartDetectionPreview || smartDetectionPreview.length < 3) return false;
    
    const buttonX = 10;
    const buttonY = 45;
    const buttonWidth = 150;
    const buttonHeight = 25;
    
    return x >= buttonX && x <= buttonX + buttonWidth && 
           y >= buttonY && y <= buttonY + buttonHeight;
  };

  const isClickOnRejectButton = (x: number, y: number): boolean => {
    if (!smartDetectionPreview || smartDetectionPreview.length < 3) return false;
    
    const buttonX = 170;
    const buttonY = 45;
    const buttonWidth = 100;
    const buttonHeight = 25;
    
    return x >= buttonX && x <= buttonX + buttonWidth && 
           y >= buttonY && y <= buttonY + buttonHeight;
  };

  const completeCurrentPolygon = () => {
    if (currentPolygon.length >= 3) {
      const newAnnotation = {
        id: Date.now().toString(),
        type: 'polygon',
        points: [...currentPolygon],
        category: selectedCategory,
        createdAt: new Date().toISOString()
      };
      
      onAnnotationAdd(newAnnotation);
      setCurrentPolygon([]);
      setShowPolygonHelper(false);
    }
  };

  const acceptSmartDetection = () => {
    if (smartDetectionPreview && smartDetectionPreview.length >= 3) {
      const newAnnotation = {
        id: Date.now().toString(),
        type: 'polygon',
        points: [...smartDetectionPreview],
        category: selectedCategory,
        createdAt: new Date().toISOString(),
        confidence: 0.85
      };
      
      onAnnotationAdd(newAnnotation);
      setSmartDetectionPreview(null);
    }
  };

  const rejectSmartDetection = () => {
    setSmartDetectionPreview(null);
  };

  const performSmartDetection = async (x: number, y: number) => {
  if (!videoRef?.current) return;

  setIsSmartDetecting(true);
  
  try {
    // Show loading state
    console.log('Starting AI detection...');
    
    const frameCapture = ImageProcessingUtils.captureVideoFrame(videoRef.current);
    if (!frameCapture) {
      throw new Error('Failed to capture video frame');
    }

    const videoCoords = ImageProcessingUtils.canvasToVideoCoordinates(
      x, y, 640, 500, frameCapture.width, frameCapture.height
    );

    // Use real AI detection
    const result = await smartDetectionService.detectObject(
      frameCapture.imageData,
      videoCoords.x,
      videoCoords.y
    );

    if (result.success && result.polygon.length >= 3) {
      const canvasPolygon = ImageProcessingUtils.scalePolygonToCanvas(
        result.polygon,
        640,
        500,
        frameCapture.width,
        frameCapture.height
      );

      setSmartDetectionPreview(canvasPolygon);
      
      
      if (result.objectClass && result.confidence) {
        console.log(`Detected: ${result.objectClass} (${(result.confidence * 100).toFixed(1)}% confidence)`);
      }
    } else {
      console.warn('AI detection failed:', result.error);
    }
  } catch (error) {
    console.error('Smart detection error:', error);
  } finally {
    setIsSmartDetecting(false);
  }
};

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;

    const { x, y } = getCanvasCoordinates(event);

    if (isClickOnAcceptButton(x, y)) {
      acceptSmartDetection();
      return;
    }

    if (isClickOnRejectButton(x, y)) {
      rejectSmartDetection();
      return;
    }

    if (currentTool === 'polygon') {
      if (isClickOnCompleteButton(x, y)) {
        completeCurrentPolygon();
        return;
      }
      
      const newPoints = [...currentPolygon, [x, y]];
      setCurrentPolygon(newPoints);
      
      if (newPoints.length === 1) {
        setShowPolygonHelper(true);
      }
      
    } else if (currentTool === 'rectangle') {
      if (!isDrawingRect) {
        setRectStart([x, y]);
        setRectEnd([x, y]);
        setIsDrawingRect(true);
      } else {
        if (rectStart) {
          const rectPoints = createRectanglePoints(rectStart, [x, y]);
          
          const newAnnotation = {
            id: Date.now().toString(),
            type: 'rectangle',
            points: rectPoints,
            category: selectedCategory,
            createdAt: new Date().toISOString()
          };
          
          onAnnotationAdd(newAnnotation);
          setIsDrawingRect(false);
          setRectStart(null);
          setRectEnd(null);
        }
      }
    } else if (currentTool === 'edit') {
      const annotation = findAnnotationAtPoint(x, y);
      if (annotation) {
        setSelectedAnnotation(annotation.id);
      } else {
        setSelectedAnnotation(null);
      }
    } else if (currentTool === 'delete') {
      const annotation = findAnnotationAtPoint(x, y);
      if (annotation) {
        onAnnotationDelete(annotation.id);
      }
    }
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (isPlaying) return;

    const { x, y } = getCanvasCoordinates(event);

    if (currentTool === 'smart') {
      performSmartDetection(x, y);
    } else if (currentTool === 'polygon' && currentPolygon.length >= 3) {
      completeCurrentPolygon();
    }
  };

  const handleCanvasRightClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (currentTool === 'polygon' && currentPolygon.length > 0) {
      if (currentPolygon.length === 1) {
        setCurrentPolygon([]);
        setShowPolygonHelper(false);
      } else {
        setCurrentPolygon(currentPolygon.slice(0, -1));
      }
    } else {
      setCurrentPolygon([]);
      setSelectedAnnotation(null);
      setIsDrawingRect(false);
      setRectStart(null);
      setRectEnd(null);
      setShowPolygonHelper(false);
      setSmartDetectionPreview(null);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;

    const { x, y } = getCanvasCoordinates(event);
    
    if (isDrawingRect && rectStart) {
      setRectEnd([x, y]);
    }
    
    if (selectedAnnotation && currentTool === 'edit') {
      const annotation = annotations.find(a => a.id === selectedAnnotation);
      if (annotation) {
        const hoveredVertex = annotation.points.findIndex(point => 
          Math.sqrt(Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2)) < 10
        );
        
        if (hoveredVertex !== -1) {
          setHoveredPoint({ annotationId: selectedAnnotation, pointIndex: hoveredVertex });
        } else {
          setHoveredPoint(null);
        }
      }
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying || currentTool !== 'edit') return;

    const { x, y } = getCanvasCoordinates(event);
    
    if (hoveredPoint) {
      setIsDragging(true);
      setDragStartPoint([x, y]);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && hoveredPoint && dragStartPoint) {
      const { x, y } = getCanvasCoordinates(event);
      const annotation = annotations.find(a => a.id === hoveredPoint.annotationId);
      
      if (annotation) {
        const newPoints = [...annotation.points];
        newPoints[hoveredPoint.pointIndex] = [x, y];
        
        onAnnotationUpdate(annotation.id, { points: newPoints });
      }
    }
    
    setIsDragging(false);
    setDragStartPoint(null);
  };

  const getCurrentCursor = (): string => {
    if (isPlaying) return 'default';
    
    switch (currentTool) {
      case 'polygon':
      case 'rectangle':
      case 'smart':
        return 'crosshair';
      case 'edit':
        if (isDragging) return 'grabbing';
        return hoveredPoint ? 'grab' : 'pointer';
      case 'delete':
        return 'pointer';
      default:
        return 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={500}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        cursor: getCurrentCursor(),
        pointerEvents: isPlaying ? 'none' : 'auto',
        opacity: isPlaying ? 0 : 1,
        transition: 'opacity 0.2s ease',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onContextMenu={handleCanvasRightClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  );
};

export default FrameAnnotationCanvas;