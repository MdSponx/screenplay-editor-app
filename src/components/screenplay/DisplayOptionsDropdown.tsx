import React from 'react';
import { ZoomIn, ZoomOut, Languages, Moon, Sun } from 'lucide-react';

interface DisplayOptionsDropdownProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  zoomLevel: number;
  setZoomLevel: (zoomLevel: number) => void;
  MIN_ZOOM: number;
  MAX_ZOOM: number;
  ZOOM_STEP: number;
  language: string;
  setLanguage: (lang: string) => void;
  onClose: () => void;
}

const DisplayOptionsDropdown: React.FC<DisplayOptionsDropdownProps> = ({
  isDarkMode,
  toggleDarkMode,
  zoomLevel,
  setZoomLevel,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  language,
  setLanguage,
  onClose,
}) => {
  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM));
  };

  const getNextLanguage = (current: string) => {
    const languages = ['en', 'th', 'zh'];
    const currentIndex = languages.indexOf(current);
    return languages[(currentIndex + 1) % languages.length];
  };

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
      <div className="py-1 divide-y divide-gray-200 dark:divide-gray-700">
        {/* Zoom Controls */}
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Zoom</div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= MIN_ZOOM}
              className={`p-1.5 rounded-lg ${
                isDarkMode
                  ? 'hover:bg-gray-700 disabled:text-gray-600'
                  : 'hover:bg-gray-100 disabled:text-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <ZoomOut size={18} />
            </button>
            
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {zoomLevel}%
            </span>
            
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= MAX_ZOOM}
              className={`p-1.5 rounded-lg ${
                isDarkMode
                  ? 'hover:bg-gray-700 disabled:text-gray-600'
                  : 'hover:bg-gray-100 disabled:text-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
        
        {/* Language Switcher */}
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</div>
          <button
            onClick={() => {
              setLanguage(getNextLanguage(language));
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Languages size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            <span>
              {language === 'en' ? 'English' : language === 'th' ? 'Thai (ไทย)' : 'Chinese (中文)'}
            </span>
          </button>
        </div>
        
        {/* Dark Mode Toggle */}
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Appearance</div>
          <button
            onClick={() => {
              toggleDarkMode();
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            {isDarkMode ? (
              <>
                <Sun size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisplayOptionsDropdown;