
import React from 'react';

interface IconProps {
  className?: string;
}

export const UploadIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

export const MusicNoteIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.073 1.935l-3.423 1.935a2.25 2.25 0 01-2.31 0l-3.423-1.935A2.25 2.25 0 019 12.75V9A2.25 2.25 0 0111.25 6.75L12 6.75m0 0H9m3 0L9 9m8.25-3H12m8.25 3l-2.25 2.25M9 12.75V9A2.25 2.25 0 0111.25 6.75L12 6.75M9 9m0 0H6.75A2.25 2.25 0 004.5 11.25v1.5A2.25 2.25 0 006.75 15h.75M12 12.75v3.75a2.25 2.25 0 01-1.073 1.935l-3.423 1.935a2.25 2.25 0 01-2.31 0l-3.423-1.935A2.25 2.25 0 013 16.5V12.75m9-9l3-3m0 0l3 3m-3-3v3.75" />
  </svg>
);

export const MicrophoneIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15c.621 0 1.19-.036 1.75-.105M6.75 15a6.002 6.002 0 0010.5 0m-10.5 0H3M3 15c0-3.412 1.515-6.44 3.75-8.447M21 15c0-3.412-1.515-6.44-3.75-8.447M12 3c2.22 0 4.24.8 5.802 2.113M12 3A7.49 7.49 0 006.198 5.113M12 3v3.75m0 6.75A2.25 2.25 0 0014.25 10.5V8.25A2.25 2.25 0 0012 6V3z" />
  </svg>
);

export const VideoCameraIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 14.846l-1.25.363a2.25 2.25 0 01-1.408-1.408L14.846 11 12 9.813l.363-1.25a2.25 2.25 0 011.408-1.408L14.846 7 17 5.154l1.25.363a2.25 2.25 0 011.408 1.408L20.187 9 22.75 12l-2.563.813a2.25 2.25 0 01-1.408 1.408L18.25 12zM12 2.25l.813.363a2.25 2.25 0 011.408 1.408L14.846 5.25 12 6.187l-2.846-.937a2.25 2.25 0 01-1.408-1.408L7.154 2.25 9.375 0l.363 1.25a2.25 2.25 0 011.408 1.408L12 2.25z" />
  </svg>
);

export const XCircleIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

