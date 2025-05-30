import { useEffect, useRef, useState } from 'react';

interface Annotation {
  id: string;
  type: string;
  points: number[][];
  category: string;
  confidence?: number;
  coordinates?: { x: number; y: number; width?: number; height?: number; }; // ADD THIS LINE
}

interface CVATAnnotationCanvasProps {
  currentTool: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  isPlaying?: boolean; 
}

const CVATAnnotationCanvas: React.FC<CVATAnnotationCanvasProps> = ({
  currentTool,
  annotations,
  onAnnotationsChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPolygon, setCurrentPolygon] = useState<number[][]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });

    // Draw current polygon being drawn
    if (currentPolygon.length > 0) {
      drawCurrentPolygon(ctx, currentPolygon);
    }
  }, [annotations, currentPolygon]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    if (annotation.points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(annotation.points[0][0], annotation.points[0][1]);
    
    for (let i = 1; i < annotation.points.length; i++) {
      ctx.lineTo(annotation.points[i][0], annotation.points[i][1]);
    }
    
    ctx.closePath();
    
    // Style based on annotation type
    if (annotation.confidence && annotation.confidence > 0.9) {
      ctx.strokeStyle = '#4caf50'; 
    } else if (annotation.confidence && annotation.confidence > 0.7) {
      ctx.strokeStyle = '#ff9800';
    } else {
      ctx.strokeStyle = '#f44336'; 
    }
    
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Fill with transparent color
    ctx.fillStyle = ctx.strokeStyle + '20';
    ctx.fill();
    
    // Draw label
    if (annotation.points.length > 0) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '12px Arial';
      const label = annotation.confidence 
        ? `${annotation.category} (${Math.round(annotation.confidence * 100)}%)`
        : annotation.category;
      ctx.fillText(label, annotation.points[0][0], annotation.points[0][1] - 5);
    }
  };

  const drawCurrentPolygon = (ctx: CanvasRenderingContext2D, points: number[][]) => {
    if (points.length < 2) return;

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
    
    // Draw points
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#2196f3';
      ctx.fill();
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (currentTool === 'polygon') {
      // Add point to current polygon
      const newPoints = [...currentPolygon, [x, y]];
      setCurrentPolygon(newPoints);
    }
  };

  const handleCanvasDoubleClick = () => {
    if (currentTool === 'polygon' && currentPolygon.length >= 3) {
      // Finish polygon
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'polygon',
        points: currentPolygon,
        category: 'Manual Annotation'
      };
      
      onAnnotationsChange([...annotations, newAnnotation]);
      setCurrentPolygon([]);
    }
  };

  const handleCanvasRightClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    // Cancel current drawing
    setCurrentPolygon([]);
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
        cursor: currentTool === 'polygon' ? 'crosshair' : 'default',
        pointerEvents: 'auto',
      }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onContextMenu={handleCanvasRightClick}
    />
  );
};

export default CVATAnnotationCanvas;