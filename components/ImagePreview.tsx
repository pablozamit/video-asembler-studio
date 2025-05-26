
import React from 'react';

interface ImagePreviewProps {
  src: string | null;
  alt?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt = "Preview" }) => {
  if (!src) return (
    <div className="mt-4 w-full aspect-video bg-slate-700 rounded-lg flex items-center justify-center text-slate-500">
      <p>No image selected or generated.</p>
    </div>
  );

  return (
    <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
      <img src={src} alt={alt} className="w-full h-auto object-contain max-h-80 aspect-video" />
    </div>
  );
};
