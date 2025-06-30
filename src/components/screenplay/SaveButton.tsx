import React from 'react';
import { Save } from 'lucide-react';

interface SaveButtonProps {
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
  className?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  onSave,
  isSaving,
  hasChanges,
  className = ''
}) => {
  // For use in the ScreenplayNavigator
  const isNavigatorButton = className === '';
  
  if (isNavigatorButton) {
    return (
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges}
        className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center ${
          hasChanges
            ? 'bg-gradient-to-r from-[#2563eb] via-[#9333ea] to-[#db2777] text-white hover:opacity-90'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        } ${!hasChanges ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {isSaving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
        ) : (
          <Save size={18} className="mr-2" />
        )}
        <span>Save</span>
      </button>
    );
  }
  
  // For use as a floating button elsewhere
  return (
    <button
      onClick={onSave}
      disabled={isSaving || !hasChanges}
      className={`fixed bottom-8 right-8 p-4 rounded-full shadow-lg transition-all duration-200 ${
        hasChanges
          ? 'bg-[#E86F2C] hover:bg-[#E86F2C]/90 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
      } ${className}`}
    >
      {isSaving ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <Save size={24} />
      )}
    </button>
  );
};

export default SaveButton;