import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  lineWidth: number;
}

interface WhiteboardProps {
  onStroke: (stroke: Stroke) => void;
  incomingStrokes: Stroke[];
}

export default function Whiteboard({ onStroke, incomingStrokes }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [color] = useState('#4f46e5');
  const [lineWidth] = useState(3);

  // Store strokes completed by this local user
  const [completedStrokes, setCompletedStrokes] = useState<Stroke[]>([]);

  // Redraw whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes: local + remote
    const allStrokes = [...completedStrokes, ...incomingStrokes];
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke);
    }

    // Draw the current in‑progress stroke
    if (currentStroke.length >= 2) {
      drawStroke(ctx, {
        points: currentStroke,
        color,
        lineWidth,
      });
    }
  }, [completedStrokes, incomingStrokes, currentStroke, color, lineWidth]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCoordinates(e);
    setCurrentStroke([point]);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCoordinates(e);
    setCurrentStroke((prev) => [...prev, point]);
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.length > 0) {
      // Send stroke to server
      const stroke: Stroke = { points: currentStroke, color, lineWidth };
      onStroke(stroke);
      // Keep it locally so it stays visible
      setCompletedStrokes((prev) => [...prev, stroke]);
    }
    setCurrentStroke([]);
  };

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{ display: 'block', background: '#fff', touchAction: 'none' }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={endDrawing}
    />
  );
}
