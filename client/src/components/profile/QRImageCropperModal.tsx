import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crop,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Check,
  ZoomIn,
  ZoomOut,
  X,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

export const QRImageCropperModal: React.FC<QRImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onApply,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<number>(300);

  // Responsive canvas size adjustment based on viewport
  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;
      if (screenWidth < 360) {
        setCanvasSize(240);
      } else if (screenWidth < 480) {
        setCanvasSize(270);
      } else {
        setCanvasSize(320);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Reset editor parameters
  const handleReset = useCallback(() => {
    setZoom(1.0);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setErrorMessage(null);
  }, []);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      loadedImageRef.current = null;
      return;
    }

    handleReset();
    setErrorMessage(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      renderCanvas();
    };
    img.onerror = () => {
      setErrorMessage('Unable to load image. Please select a valid image file.');
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc, handleReset]);

  // Render canvas preview
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasSize;
    const height = canvasSize;
    canvas.width = width;
    canvas.height = height;

    // Clear background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Center + pan offset
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);

    // Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // Scale aspect fit base
    const imgAspect = img.width / img.height;
    let drawWidth = width;
    let drawHeight = height;

    if (imgAspect > 1) {
      drawWidth = height * imgAspect;
      drawHeight = height;
    } else {
      drawWidth = width;
      drawHeight = width / imgAspect;
    }

    drawWidth *= zoom;
    drawHeight *= zoom;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    // Viewfinder & Outer Mask
    const cropMargin = 16;
    const cropBoxSize = width - cropMargin * 2;
    const cropX = cropMargin;
    const cropY = cropMargin;

    // Dark semi-transparent mask outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, width, cropY);
    ctx.fillRect(0, cropY + cropBoxSize, width, cropY);
    ctx.fillRect(0, cropY, cropX, cropBoxSize);
    ctx.fillRect(cropX + cropBoxSize, cropY, cropX, cropBoxSize);

    // Viewfinder Dashed Outline
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cropX, cropY, cropBoxSize, cropBoxSize);
    ctx.setLineDash([]);

    // Corner Alignment Brackets
    const cornerLength = 18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(cropX, cropY + cornerLength);
    ctx.lineTo(cropX, cropY);
    ctx.lineTo(cropX + cornerLength, cropY);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(cropX + cropBoxSize - cornerLength, cropY);
    ctx.lineTo(cropX + cropBoxSize, cropY);
    ctx.lineTo(cropX + cropBoxSize, cropY + cornerLength);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(cropX, cropY + cropBoxSize - cornerLength);
    ctx.lineTo(cropX, cropY + cropBoxSize);
    ctx.lineTo(cropX + cornerLength, cropY + cropBoxSize);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(cropX + cropBoxSize - cornerLength, cropY + cropBoxSize);
    ctx.lineTo(cropX + cropBoxSize, cropY + cropBoxSize);
    ctx.lineTo(cropX + cropBoxSize, cropY + cropBoxSize - cornerLength);
    ctx.stroke();
  }, [canvasSize, pan, rotation, zoom]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, zoom, rotation, pan]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((prev) => Math.min(3.0, Math.max(1.0, Math.round((prev + delta) * 100) / 100)));
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      setTouchStartDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchStartDist) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const diff = dist - touchStartDist;
      const delta = diff * 0.005;
      setZoom((prev) => Math.min(3.0, Math.max(1.0, Math.round((prev + delta) * 100) / 100)));
      setTouchStartDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStartDist(null);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Export cropped square image
  const handleApply = () => {
    const img = loadedImageRef.current;
    if (!img) {
      setErrorMessage('No image available to process.');
      return;
    }

    try {
      setIsProcessing(true);

      const exportSize = 600;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportSize;
      exportCanvas.height = exportSize;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Crisp white background for QR code
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);

      const cropMargin = 16;
      const previewCropBox = canvasSize - cropMargin * 2;
      const scaleMultiplier = exportSize / previewCropBox;

      ctx.save();
      ctx.translate(
        exportSize / 2 + pan.x * scaleMultiplier,
        exportSize / 2 + pan.y * scaleMultiplier,
      );
      ctx.rotate((rotation * Math.PI) / 180);

      const imgAspect = img.width / img.height;
      let drawWidth = canvasSize;
      let drawHeight = canvasSize;

      if (imgAspect > 1) {
        drawWidth = canvasSize * imgAspect;
        drawHeight = canvasSize;
      } else {
        drawWidth = canvasSize;
        drawHeight = canvasSize / imgAspect;
      }

      drawWidth *= zoom * scaleMultiplier;
      drawHeight *= zoom * scaleMultiplier;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92);
      setIsProcessing(false);
      onApply(dataUrl);
      onClose();
    } catch (err) {
      console.error('QR Export Error:', err);
      setIsProcessing(false);
      setErrorMessage('Export failed. Please check image permissions.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in-0">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Crop className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Crop Payment QR</h3>
              <p className="text-xs text-slate-500">Center your QR code within the square frame</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Canvas Container */}
          <div className="flex flex-col items-center justify-center bg-slate-950 rounded-2xl p-3 relative overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="block rounded-lg shadow-md cursor-grab active:cursor-grabbing touch-none select-none"
            />
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 select-none">
              <Info className="h-3 w-3 text-slate-400" />
              Drag to reposition • Scroll or pinch to zoom
            </p>
          </div>

          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Zoom</span>
              <span className="font-mono text-slate-500">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1.0, Math.round((prev - 0.1) * 10) / 10))}
                disabled={zoom <= 1.0}
                className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3.0, Math.round((prev + 0.1) * 10) / 10))}
                disabled={zoom >= 3.0}
                className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Rotation & Reset Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleRotateLeft}
              className="px-2 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rotate Left
            </button>
            <button
              type="button"
              onClick={handleRotateRight}
              className="px-2 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotate Right
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>

          {/* Tip */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed">
            Ensure the complete QR code and UPI details remain inside the frame for reliable payment scanning.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            isLoading={isProcessing}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Apply Crop
          </Button>
        </div>
      </div>
    </div>
  );
};

