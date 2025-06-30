import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  MoreVertical,
  Check,
  X,
  User,
  Save,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import ConflictDialog from './screenplay/ConflictDialog';
import type { SaveResult } from '../types/screenplay';
import DisplayOptionsDropdown from './screenplay/DisplayOptionsDropdown';
import MoreOptionsDropdown from './screenplay/MoreOptionsDropdown';

interface ScreenplayNavigatorProps {
  projectId: string | undefined;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  zoomLevel: number;
  setZoomLevel: (zoomLevel: number) => void;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  onSave?: () => Promise<SaveResult>;
  isSaving?: boolean;
  hasChanges?: boolean;
}

const ScreenplayNavigator: React.FC<ScreenplayNavigatorProps> = ({
  projectId,
  isDarkMode,
  toggleDarkMode,
  zoomLevel,
  setZoomLevel,
  documentTitle,
  setDocumentTitle,
  onSave,
  isSaving = false,
  hasChanges = false,
}) => {
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflicts, setConflicts] = useState<
    NonNullable<SaveResult['conflicts']>
  >([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const displayOptionsRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const MIN_ZOOM = 25;
  const MAX_ZOOM = 200;
  const ZOOM_STEP = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(event.target as Node)) {
        setShowMoreOptions(false);
      }
      if (displayOptionsRef.current && !displayOptionsRef.current.contains(event.target as Node)) {
        setShowDisplayOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSave = async () => {
    if (!onSave || isSaving || !hasChanges) return;
    
    try {
      setSaveError(null);
      const result = await onSave();

      if (!result.success) {
        if (result.conflicts) {
          setConflicts(result.conflicts);
          setShowConflictDialog(true);
        } else {
          setSaveError(result.error || 'Failed to save screenplay');
        }
      } else {
        // Show success message briefly
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error saving screenplay:', err);
      setSaveError('Failed to save screenplay');
    }
  };

  const handleConflictResolution = async (
    action: 'overwrite' | 'merge' | 'cancel'
  ) => {
    setShowConflictDialog(false);
    
    if (action === 'cancel') {
      // Just close the dialog, no action needed
      return;
    }
    
    if (!onSave) {
      setSaveError('Save function is not available');
      return;
    }
    
    try {
      setSaveError(null);
      
      // Add conflict resolution action to the URL as a query parameter
      // This will be picked up by the useScreenplaySave hook
      const url = new URL(window.location.href);
      url.searchParams.set('conflict_resolution', action);
      window.history.replaceState({}, '', url.toString());
      
      // Try saving again with the conflict resolution strategy
      const result = await onSave();
      
      // Remove the conflict resolution parameter
      url.searchParams.delete('conflict_resolution');
      window.history.replaceState({}, '', url.toString());
      
      if (!result.success) {
        if (result.conflicts) {
          // If we still have conflicts, show the dialog again
          setConflicts(result.conflicts);
          setShowConflictDialog(true);
        } else {
          setSaveError(result.error || 'Failed to save screenplay');
        }
      } else {
        // Show success message briefly
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error resolving conflicts:', err);
      setSaveError('Failed to resolve conflicts');
      
      // Remove the conflict resolution parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('conflict_resolution');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] ${
        isDarkMode ? 'bg-[#1E4D3A]' : 'bg-[#F5F5F2]'
      } shadow-sm`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar with Navigation */}
        <div className="h-16 flex items-center justify-between border-b border-[#577B92]/20">
          {/* Left Section with Back Button, Logo and Title */}
          <div className="flex items-center flex-1 space-x-4">
            <button
              onClick={() => {
                if (projectId) {
                  navigate(`/projects/${projectId}/writing`);
                } else {
                  navigate('/projects');
                }
              }}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'text-[#F5F5F2] hover:bg-[#577B92]/20'
                  : 'text-[#1E4D3A] hover:bg-[#577B92]/10'
              }`}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => navigate('/')}
              className={`text-2xl font-semibold px-4 py-1 rounded-full font-mukta transition-colors duration-200
                ${
                  isDarkMode
                    ? 'bg-[#F5F5F2] text-[#1E4D3A] hover:bg-[#E8E8E5]'
                    : 'bg-[#1E4D3A] text-[#F5F5F2] hover:bg-[#1A4433]'
                }`}
            >
              LiQid
            </button>
            <div className="h-4 w-px bg-[#577B92]/20" />
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className={`text-lg font-medium bg-transparent border-b-2 border-transparent hover:border-[#577B92]/30 focus:border-[#E86F2C] focus:outline-none transition-colors duration-200 ${
                  isDarkMode ? 'text-[#F5F5F2]' : 'text-[#1E4D3A]'
                } px-2 py-1`}
                placeholder="Untitled Screenplay"
              />
            </div>
          </div>

          {/* Right Section with User Presence, Display Options, and More Options */}
          <div className="flex items-center space-x-3">
            {/* Collaborators */}
            <div className="flex -space-x-2">
              {[1, 2, 3].map((id) => (
                <div key={id} className="relative group">
                  <button className={`p-2 rounded-full ${
                    id === 1 ? 'bg-blue-500' : id === 2 ? 'bg-green-500' : 'bg-orange-500'
                  } text-white`}>
                    <User size={16} />
                  </button>
                  <span className="absolute top-10 right-0 w-max bg-[#1E4D3A] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {id === 1 ? 'You' : id === 2 ? 'Sarah Chen' : 'Mike Johnson'}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center ${
                hasChanges
                  ? 'bg-gradient-to-r from-[#2563eb] via-[#9333ea] to-[#db2777] text-white hover:opacity-90'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              } ${!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save size={18} className="mr-2" />
              )}
              <span>Save</span>
            </button>
            
            {/* Display Options Button */}
            <div className="relative" ref={displayOptionsRef}>
              <button
                onClick={() => setShowDisplayOptions(!showDisplayOptions)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode
                    ? 'text-[#F5F5F2] hover:bg-[#577B92]/20'
                    : 'text-[#1E4D3A] hover:bg-[#577B92]/10'
                }`}
                aria-label="Display options"
              >
                <Eye size={18} />
              </button>
              
              {/* Display Options Dropdown */}
              {showDisplayOptions && (
                <DisplayOptionsDropdown
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                  zoomLevel={zoomLevel}
                  setZoomLevel={setZoomLevel}
                  MIN_ZOOM={MIN_ZOOM}
                  MAX_ZOOM={MAX_ZOOM}
                  ZOOM_STEP={ZOOM_STEP}
                  language={language}
                  setLanguage={setLanguage}
                  onClose={() => setShowDisplayOptions(false)}
                />
              )}
            </div>
            
            {/* More Options Button */}
            <div className="relative" ref={moreOptionsRef}>
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode
                    ? 'text-[#F5F5F2] hover:bg-[#577B92]/20'
                    : 'text-[#1E4D3A] hover:bg-[#577B92]/10'
                }`}
                aria-label="More options"
              >
                <MoreVertical size={20} />
              </button>
              
              {/* More Options Dropdown */}
              {showMoreOptions && (
                <MoreOptionsDropdown
                  documentTitle={documentTitle}
                  isDarkMode={isDarkMode}
                  onClose={() => setShowMoreOptions(false)}
                  setShowKeyboardShortcuts={setShowKeyboardShortcuts}
                  handlePrint={handlePrint}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsDialog
          isDarkMode={isDarkMode}
          onClose={() => setShowKeyboardShortcuts(false)}
        />
      )}

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && (
        <ConflictDialog
          conflicts={conflicts}
          onResolve={handleConflictResolution}
        />
      )}

      {/* Save Error Toast */}
      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <X size={16} className="mr-2" />
          {saveError}
        </div>
      )}

      {/* Save Success Toast */}
      {showSaveSuccess && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <Check size={16} className="mr-2" />
          Changes saved successfully
        </div>
      )}
    </header>
  );
};

export default ScreenplayNavigator;