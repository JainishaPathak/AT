import React, { useEffect, useRef } from 'react';

interface CVATCanvasProps {
  width: number;
  height: number;
}

const CVATCanvas: React.FC<CVATCanvasProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Sample annotation overlay
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Draw sample polygon
        ctx.beginPath();
        ctx.moveTo(100, 100);
        ctx.lineTo(200, 100);
        ctx.lineTo(200, 200);
        ctx.lineTo(100, 200);
        ctx.closePath();
        ctx.stroke();
        
        // Add label
        ctx.fillStyle = '#ff0000';
        ctx.font = '14px Arial';
        ctx.fillText('Road Crack (AI: 95%)', 105, 95);
      }
    }
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    />
  );
};

export default CVATCanvas;
