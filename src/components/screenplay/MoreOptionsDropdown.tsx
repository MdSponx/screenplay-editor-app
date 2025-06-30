import React from 'react';
import { 
  Pencil, 
  Copy, 
  Download, 
  FileText, 
  Printer, 
  History, 
  Keyboard, 
  Info, 
  Trash 
} from 'lucide-react';

interface MoreOptionsDropdownProps {
  documentTitle: string;
  isDarkMode: boolean;
  onClose: () => void;
  setShowKeyboardShortcuts: (show: boolean) => void;
  handlePrint: () => void;
}

const MoreOptionsDropdown: React.FC<MoreOptionsDropdownProps> = ({
  documentTitle,
  isDarkMode,
  onClose,
  setShowKeyboardShortcuts,
  handlePrint,
}) => {
  return (
    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
      <div className="py-1 divide-y divide-gray-200 dark:divide-gray-700">
        {/* Rename Screenplay */}
        <div className="px-1 py-1">
          <button
            onClick={() => {
              // Focus the title input
              const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
              if (titleInput) {
                titleInput.focus();
                titleInput.select();
              }
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Pencil size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Rename Screenplay
          </button>
        </div>
        
        {/* Document Actions */}
        <div className="px-1 py-1">
          <button
            onClick={() => {
              console.log('Duplicate screenplay');
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Copy size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Make a Copy
          </button>
          
          <div className="relative group">
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <div className="flex items-center">
                <Download size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                Download As
              </div>
              <span className="text-gray-400">›</span>
            </button>
            
            {/* Export Submenu - positioned to the left */}
            <div className="absolute right-full top-0 mr-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block">
              <div className="py-1">
                <button
                  onClick={() => {
                    console.log('Export as PDF');
                    onClose();
                  }}
                  className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                  PDF Document
                </button>
                <button
                  onClick={() => {
                    console.log('Export as TXT');
                    onClose();
                  }}
                  className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                  Plain Text
                </button>
              </div>
            </div>
          </div>
          
          {/* Print Option */}
          <button
            onClick={() => {
              handlePrint();
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Printer size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Print
          </button>
        </div>
        
        {/* History and Info */}
        <div className="px-1 py-1">
          <button
            onClick={() => {
              console.log('View version history');
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <History size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Version History
          </button>
          
          <button
            onClick={() => {
              setShowKeyboardShortcuts(true);
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Keyboard size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Keyboard Shortcuts
          </button>
          
          <button
            onClick={() => {
              console.log('View document details');
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <Info size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
            Document Details
          </button>
        </div>
        
        {/* Danger Zone */}
        <div className="px-1 py-1">
          <button
            onClick={() => {
              console.log('Delete screenplay');
              onClose();
            }}
            className="flex items-center w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
          >
            <Trash size={16} className="mr-3 text-red-500 dark:text-red-400" />
            Delete Screenplay
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoreOptionsDropdown;