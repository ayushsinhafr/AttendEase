import { useEffect, useState } from 'react';
import { modelPreloader } from '@/lib/face/modelPreloader';

interface PreloadStatus {
  total: number;
  loaded: number;
  isComplete: boolean;
}

export const ModelPreloadIndicator = () => {
  const [status, setStatus] = useState<PreloadStatus>({ total: 2, loaded: 0, isComplete: false });
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const currentStatus = modelPreloader.getPreloadStatus();
      setStatus(currentStatus);
      
      // Show indicator only while loading
      setShowIndicator(!currentStatus.isComplete && currentStatus.loaded < currentStatus.total);
    };

    // Check status immediately
    checkStatus();

    // Check status periodically while loading
    const interval = setInterval(checkStatus, 1000);

    // Clean up
    return () => clearInterval(interval);
  }, []);

  if (!showIndicator) return null;

  const progress = (status.loaded / status.total) * 100;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      <div className="flex items-center gap-2 text-sm">
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
        <span>Loading face recognition models...</span>
        <span className="font-mono">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-blue-500 rounded-full h-1 mt-1">
        <div 
          className="bg-white h-1 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};