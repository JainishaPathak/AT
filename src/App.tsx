import React, { useRef, useEffect, useState, useCallback } from 'react';
import FrameAnnotationCanvas from './components/FrameAnnotationCanvas';
import './App.css';

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

interface AnnotationHistory {
  frameAnnotations: { [frameNumber: number]: FrameAnnotation[] };
  allAnnotations: FrameAnnotation[];
  action: string;
  timestamp: number;
}

interface FrameAnnotationCanvasProps {
  currentTool: string;
  annotations: FrameAnnotation[];
  onAnnotationAdd: (annotation: Omit<FrameAnnotation, 'frameNumber' | 'timestamp'>) => void;
  isPlaying: boolean;
  currentFrame: number;
  onAnnotationDelete: (annotationId: string) => void;
  onAnnotationUpdate: (annotationId: string, updates: Partial<FrameAnnotation>) => void;
  selectedCategory: string;
}

function App() {
  const rawVideoRef = useRef<HTMLVideoElement>(null);
  const mlVideoRef = useRef<HTMLVideoElement>(null);
  
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [currentTool, setCurrentTool] = useState<string>('polygon');
  const [frameAnnotations, setFrameAnnotations] = useState<{[frameNumber: number]: FrameAnnotation[]}>({});
  const [allAnnotations, setAllAnnotations] = useState<FrameAnnotation[]>([]);
  const [history, setHistory] = useState<AnnotationHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('Road Asset');
  const [showAllAnnotations, setShowAllAnnotations] = useState<boolean>(false);

  const categories: string[] = [
    'Street Light',  'Traffic Sign', 'Pothole', 
    'Aligator Crack', 'Construction Zone', 'Vehicle', 'Pedestrian', 'Other'
  ];

  const getCurrentFrame = useCallback((): number => {
    if (mlVideoRef.current) {
      const time = mlVideoRef.current.currentTime;
      const fps = 30;
      return Math.floor(time * fps);
    }
    return 0;
  }, []);

  useEffect(() => {
    const rawVideo = rawVideoRef.current;
    const mlVideo = mlVideoRef.current;
    
    if (!rawVideo || !mlVideo) return;

    const handleTimeUpdate = (): void => {
      const newFrame = getCurrentFrame();
      setCurrentFrame(newFrame);
      
      if (Math.abs(rawVideo.currentTime - mlVideo.currentTime) > 0.1) {
        rawVideo.currentTime = mlVideo.currentTime;
      }
    };

    const handlePlay = (): void => {
      setIsPlaying(true);
      if (rawVideo.paused) rawVideo.play();
    };

    const handlePause = (): void => {
      setIsPlaying(false);
      if (!rawVideo.paused) rawVideo.pause();
    };

    mlVideo.addEventListener('timeupdate', handleTimeUpdate);
    mlVideo.addEventListener('play', handlePlay);
    mlVideo.addEventListener('pause', handlePause);

    return () => {
      mlVideo.removeEventListener('timeupdate', handleTimeUpdate);
      mlVideo.removeEventListener('play', handlePlay);
      mlVideo.removeEventListener('pause', handlePause);
    };
  }, [getCurrentFrame]);

  const getCurrentFrameAnnotations = (): FrameAnnotation[] => {
    return frameAnnotations[currentFrame] || [];
  };

  const addAnnotationToCurrentFrame = (annotation: Omit<FrameAnnotation, 'frameNumber' | 'timestamp'>): void => {
    const timestamp = mlVideoRef.current?.currentTime || 0;
    const newAnnotation: FrameAnnotation = {
      ...annotation,
      frameNumber: currentFrame,
      timestamp: timestamp,
      createdAt: new Date().toISOString()
    };

    const currentFrameAnnots = getCurrentFrameAnnotations();
    const updatedFrameAnnotations = [...currentFrameAnnots, newAnnotation];
    
    const newFrameAnnotations = {
      ...frameAnnotations,
      [currentFrame]: updatedFrameAnnotations
    };

    setFrameAnnotations(newFrameAnnotations);
    const updatedAllAnnotations = [...allAnnotations, newAnnotation];
    setAllAnnotations(updatedAllAnnotations);
    addToHistory(newFrameAnnotations, updatedAllAnnotations, 'add_annotation');
  };

  const deleteAnnotation = (annotationId: string): void => {
    const currentFrameAnnots = getCurrentFrameAnnotations();
    const updatedFrameAnnotations = currentFrameAnnots.filter(ann => ann.id !== annotationId);
    
    const newFrameAnnotations = {
      ...frameAnnotations,
      [currentFrame]: updatedFrameAnnotations
    };

    setFrameAnnotations(newFrameAnnotations);
    const updatedAllAnnotations = allAnnotations.filter(ann => ann.id !== annotationId);
    setAllAnnotations(updatedAllAnnotations);
    addToHistory(newFrameAnnotations, updatedAllAnnotations, 'delete_annotation');
  };

  const updateAnnotation = (annotationId: string, updates: Partial<FrameAnnotation>): void => {
    const currentFrameAnnots = getCurrentFrameAnnotations();
    const updatedFrameAnnotations = currentFrameAnnots.map(ann => 
      ann.id === annotationId ? { ...ann, ...updates } : ann
    );
    
    const newFrameAnnotations = {
      ...frameAnnotations,
      [currentFrame]: updatedFrameAnnotations
    };

    setFrameAnnotations(newFrameAnnotations);
    const updatedAllAnnotations = allAnnotations.map(ann => 
      ann.id === annotationId ? { ...ann, ...updates } : ann
    );
    setAllAnnotations(updatedAllAnnotations);
    addToHistory(newFrameAnnotations, updatedAllAnnotations, 'update_annotation');
  };

  const addToHistory = (
    frameAnns: {[frameNumber: number]: FrameAnnotation[]}, 
    allAnns: FrameAnnotation[], 
    action: string
  ): void => {
    const newHistoryItem: AnnotationHistory = {
      frameAnnotations: { ...frameAnns },
      allAnnotations: [...allAnns],
      action,
      timestamp: Date.now()
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newHistoryItem);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = (): void => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const previousState = history[historyIndex - 1];
      setFrameAnnotations(previousState.frameAnnotations);
      setAllAnnotations(previousState.allAnnotations);
    }
  };

  const redo = (): void => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const nextState = history[historyIndex + 1];
      setFrameAnnotations(nextState.frameAnnotations);
      setAllAnnotations(nextState.allAnnotations);
    }
  };

  const exportAnnotations = (): void => {
    const videoDuration = mlVideoRef.current?.duration || 0;
    const totalFrames = Math.floor(videoDuration * 30);
    
    const exportData = {
      project: {
        name: "Road Annotation Project",
        created: new Date().toISOString(),
        videoFile: "ml-detection.mp4",
        version: "1.0"
      },
      videoInfo: {
        totalFrames: totalFrames,
        fps: 30,
        duration: videoDuration,
        currentFrame: currentFrame
      },
      summary: {
        totalAnnotations: allAnnotations.length,
        annotatedFrames: Object.keys(frameAnnotations).length,
        categories: categories,
        annotationsByCategory: categories.map(cat => ({
          category: cat,
          count: allAnnotations.filter(ann => ann.category === cat).length
        })),
        annotationsByType: {
          polygon: allAnnotations.filter(ann => ann.type === 'polygon').length,
          rectangle: allAnnotations.filter(ann => ann.type === 'rectangle').length
        }
      },
      frameAnnotations: frameAnnotations,
      allAnnotations: allAnnotations.map((ann, index) => ({
        index: index + 1,
        id: ann.id,
        frameNumber: ann.frameNumber,
        timestamp: parseFloat(ann.timestamp.toFixed(3)),
        category: ann.category,
        type: ann.type,
        coordinates: ann.points,
        pointCount: ann.points.length,
        createdAt: ann.createdAt || new Date().toISOString(),
        confidence: ann.confidence
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `road_annotations_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleToolSelect = (tool: string): void => {
    setCurrentTool(tool);
    if ((tool === 'polygon' || tool === 'rectangle') && mlVideoRef.current && !mlVideoRef.current.paused) {
      mlVideoRef.current.pause();
    }
  };

  const jumpToFrame = (frameNumber: number): void => {
    if (mlVideoRef.current) {
      const time = frameNumber / 30;
      mlVideoRef.current.currentTime = time;
      setCurrentFrame(frameNumber);
    }
  };

  const clearAllAnnotations = (): void => {
    if (window.confirm('Are you sure you want to clear all annotations? This cannot be undone.')) {
      setFrameAnnotations({});
      setAllAnnotations([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
  };

  const totalAnnotations = allAnnotations.length;
  const annotatedFramesCount = Object.keys(frameAnnotations).length;
  const currentFrameAnnotationsCount = getCurrentFrameAnnotations().length;
  const annotatedFrameNumbers = Object.keys(frameAnnotations)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      padding: '20px', 
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <header style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#fff', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
          Road Annotation Tool
        </h3>
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          fontSize: '14px'
        }}>
          <span style={{ fontWeight: 'bold', color: '#2196f3' }}>
            Frame: {currentFrame}
          </span>
          <span style={{ color: '#4caf50' }}>
            Current Frame: {currentFrameAnnotationsCount} annotations
          </span>
          <span style={{ color: '#ff9800' }}>
            Total: {totalAnnotations} annotations
          </span>
          <span style={{ color: '#9c27b0' }}>
            Annotated Frames: {annotatedFramesCount}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
  onClick={() => {
    if (mlVideoRef.current) {
      if (isPlaying) {
        mlVideoRef.current.pause();
      } else {
        mlVideoRef.current.play();
      }
    }
  }}
  style={{ 
    padding: '8px 16px', 
    backgroundColor: isPlaying ? '#f44336' : '#4caf50', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer',
    fontSize: '14px',
    minWidth: '80px'
  }}
>
  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
</button>
            
            <button 
              onClick={clearAllAnnotations}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#ff5722', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ Clear All
            </button>
          </div>
        </div>
      </header>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 400px', 
        gap: '20px', 
        height: '600px' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '15px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Raw Video</h3>
          <video 
            ref={rawVideoRef}
            width="100%" 
            height="500"
            controls
            src="/videos/raw-video.mp4"
            style={{ borderRadius: '4px', backgroundColor: '#000' }}
          />
        </div>
        
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '15px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
            ML Detection Video - Frame {currentFrame}
          </h3>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <video 
              ref={mlVideoRef}
              width="640" 
              height="500"
              controls
              src="/videos/ml-detection.mp4"
              style={{ borderRadius: '4px', backgroundColor: '#000' }}
            />
            
            <FrameAnnotationCanvas
  currentTool={currentTool}
  currentFrame={currentFrame}
  annotations={getCurrentFrameAnnotations()}
  onAnnotationAdd={addAnnotationToCurrentFrame}
  onAnnotationDelete={deleteAnnotation}
  onAnnotationUpdate={updateAnnotation}
  isPlaying={isPlaying}
  selectedCategory={selectedCategory}
  videoRef={mlVideoRef as React.RefObject<HTMLVideoElement>}
/>
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#fff', 
          padding: '15px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
          overflow: 'auto' 
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Tools & Annotations</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>Drawing Tools</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
  <button 
    onClick={() => handleToolSelect('smart')}
    style={{ 
      padding: '8px 12px', 
      backgroundColor: currentTool === 'smart' ? '#4caf50' : '#e0e0e0', 
      color: currentTool === 'smart' ? 'white' : '#333',
      border: 'none', 
      borderRadius: '4px', 
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'all 0.2s'
    }}
  >
    🎯 Smart
  </button>
              <button 
                onClick={() => handleToolSelect('polygon')}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: currentTool === 'polygon' ? '#2196f3' : '#e0e0e0', 
                  color: currentTool === 'polygon' ? 'white' : '#333',
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                🔷 Polygon
              </button>
              <button 
                onClick={() => handleToolSelect('rectangle')}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: currentTool === 'rectangle' ? '#2196f3' : '#e0e0e0', 
                  color: currentTool === 'rectangle' ? 'white' : '#333',
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                ▭ Rectangle
              </button>
              <button 
                onClick={() => handleToolSelect('edit')}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: currentTool === 'edit' ? '#2196f3' : '#e0e0e0', 
                  color: currentTool === 'edit' ? 'white' : '#333',
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                ✏️ Edit
              </button>
              <button 
                onClick={() => handleToolSelect('delete')}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: currentTool === 'delete' ? '#2196f3' : '#e0e0e0', 
                  color: currentTool === 'delete' ? 'white' : '#333',
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>Category</h4>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>History</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={undo} 
                disabled={historyIndex <= 0}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: historyIndex <= 0 ? '#ccc' : '#ff9800', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                ↶ Undo
              </button>
              <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: historyIndex >= history.length - 1 ? '#ccc' : '#ff9800', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                ↷ Redo
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>
              Frame {currentFrame} Annotations ({currentFrameAnnotationsCount})
            </h4>
            <div style={{ 
              maxHeight: '150px', 
              overflow: 'auto', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              {getCurrentFrameAnnotations().map((ann, index) => (
                <div key={ann.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '6px 8px', 
                  marginBottom: '4px', 
                  backgroundColor: '#fff', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                      {index + 1}. {ann.category}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      Type: {ann.type} | Points: {ann.points.length} | Frame: {ann.frameNumber}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>
                      Time: {ann.timestamp.toFixed(2)}s
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAnnotation(ann.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
              {currentFrameAnnotationsCount === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '20px',
                  fontSize: '12px'
                }}>
                  No annotations on this frame
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>
              All Annotations ({totalAnnotations})
              <button
                onClick={() => setShowAllAnnotations(!showAllAnnotations)}
                style={{
                  marginLeft: '10px',
                  padding: '2px 6px',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                {showAllAnnotations ? 'Hide' : 'Show'}
              </button>
            </h4>
            {showAllAnnotations && (
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: '4px', 
                padding: '8px',
                backgroundColor: '#f9f9f9'
              }}>
                {allAnnotations.map((ann, index) => (
                  <div key={ann.id} style={{ 
                    padding: '4px 8px', 
                    marginBottom: '2px', 
                    backgroundColor: '#fff', 
                    borderRadius: '3px',
                    fontSize: '11px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    cursor: 'pointer'
                  }}
                  onClick={() => jumpToFrame(ann.frameNumber)}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                      {index + 1}. {ann.category} (Frame {ann.frameNumber})
                    </div>
                    <div style={{ fontSize: '9px', color: '#666' }}>
                      {ann.type} | {ann.points.length} points | {ann.timestamp.toFixed(2)}s
                    </div>
                  </div>
                ))}
                {totalAnnotations === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#999', 
                    padding: '20px',
                    fontSize: '12px'
                  }}>
                    No annotations created yet
                  </div>
                )}
              </div>
            )}
          </div>

          {annotatedFrameNumbers.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>
                Jump to Annotated Frames
              </h4>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '4px',
                maxHeight: '80px',
                overflow: 'auto'
              }}>
                {annotatedFrameNumbers.map(frameNum => (
                  <button
                    key={frameNum}
                    onClick={() => jumpToFrame(frameNum)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: frameNum === currentFrame ? '#2196f3' : '#e0e0e0',
                      color: frameNum === currentFrame ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    {frameNum}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={exportAnnotations} 
            disabled={totalAnnotations === 0}
            style={{ 
              width: '100%',
              padding: '12px', 
              backgroundColor: totalAnnotations === 0 ? '#ccc' : '#4caf50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: totalAnnotations === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            📤 Export Annotations ({totalAnnotations} total, {annotatedFramesCount} frames)
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;