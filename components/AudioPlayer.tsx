
import React from 'react';

interface AudioPlayerProps {
  src: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  if (!src) return null;

  return (
    <div className="mt-3">
      <audio controls src={src} className="w-full h-10 rounded-md">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};
