
import React, { useRef } from 'react';
import { UploadIcon, XCircleIcon } from './icons'; // Assuming icons.tsx

interface FileUploadProps {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onClear: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ id, label, accept, file, onChange, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onChange(event.target.files[0]);
    } else {
      onChange(null);
    }
    // Reset file input value to allow re-uploading the same file after clearing
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClear();
    if(fileInputRef.current) {
      fileInputRef.current.value = ''; // Ensure input is cleared for re-upload
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 sr-only">
        {label}
      </label>
      <div className="mt-1 flex items-center space-x-3">
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex-grow flex items-center justify-center px-4 py-2.5 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 transition-colors"
        >
          <UploadIcon className="w-5 h-5 mr-2 text-sky-400" />
          {file ? 'Change File' : label}
        </button>
        <input
          id={id}
          name={id}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          ref={fileInputRef}
          className="sr-only"
          aria-hidden="true" // Hidden from AT, button is the control
        />
        {file && (
           <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            aria-label={`Clear selected file: ${file.name}`}
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        )}
      </div>
      {file && (
        <p className="text-xs text-slate-400 truncate" title={file.name}>
          Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}
    </div>
  );
};
