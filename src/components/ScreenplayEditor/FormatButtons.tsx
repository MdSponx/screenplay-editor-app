import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Block } from '../../types';
import { BLOCK_TYPES } from '../../constants/editorConstants';
import { Minimize2, Maximize2 } from 'lucide-react';

interface FormatButtonsProps {
  isDarkMode: boolean;
  activeBlock: string | null;
  onFormatChange: (type: string) => void;
  blocks: Block[];
  className?: string;
}

const FormatButtons: React.FC<FormatButtonsProps> = ({
  isDarkMode,
  activeBlock,
  onFormatChange,
  blocks,
  className = '',
}) => {
  const { t } = useLanguage();
  const [isMinimized, setIsMinimized] = useState(false);
  const [showMinimizeButton, setShowMinimizeButton] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [prevActiveType, setPrevActiveType] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const formats = [
    { type: 'scene-heading', emoji: '🎬' },
    { type: 'action', emoji: '🎭' },
    { type: 'character', emoji: '👤' },
    { type: 'parenthetical', emoji: '💭' },
    { type: 'dialogue', emoji: '💬' },
    { type: 'transition', emoji: '🔄' },
    { type: 'text', emoji: '📝' },
    { type: 'shot', emoji: '🎥' },
  ];

  // Update active type when activeBlock changes
  useEffect(() => {
    if (activeBlock) {
      const currentBlock = blocks.find((b) => b.id === activeBlock);
      if (currentBlock) {
        setPrevActiveType(activeType);
        setActiveType(currentBlock.type);
        setIsTransitioning(true);
        
        // Reset transition state after animation completes
        const timer = setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
        
        return () => clearTimeout(timer);
      }
    }
  }, [activeBlock, blocks, activeType]);

  const handleFormatClick = (type: string) => {
    if (!activeBlock) {
      // If no active block, do nothing
      return;
    }
    
    // Apply the format change
    onFormatChange(type);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const getActiveEmoji = () => {
    const format = formats.find(f => f.type === activeType);
    return format ? format.emoji : '📝';
  };

  const getActiveTypeName = () => {
    return activeType ? t(activeType) : 'Text';
  };

  return (
    <>
      <div className="h-24" />
      
      <div 
        className={`fixed bottom-8 ${isMinimized ? 'right-8' : 'left-1/2 -translate-x-1/2'} z-50 ${className}`}
        onMouseEnter={() => {
          setShowMinimizeButton(true);
          setShowExpandButton(true);
        }}
        onMouseLeave={() => {
          setShowMinimizeButton(false);
          setShowExpandButton(false);
        }}
      >
        {isMinimized ? (
          <button
            onClick={toggleMinimize}
            className={`rounded-full shadow-lg px-4 py-2 border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-[#1E4D3A]/90 border-primary-800 text-white' 
                : 'bg-white/90 border-gray-200 text-gray-700'
            }`}
          >
            <div className="relative flex items-center">
              <span className="text-xl mr-2">{getActiveEmoji()}</span>
              <span className="text-sm font-medium">{getActiveTypeName()}</span>
              {showExpandButton && (
                <div className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm">
                  <Maximize2 size={14} className="text-gray-500 dark:text-gray-400" />
                </div>
              )}
            </div>
          </button>
        ) : (
          <div 
            className={`rounded-full shadow-lg px-4 py-2 border backdrop-blur-sm
              ${isDarkMode 
                ? 'bg-[#1E4D3A]/90 border-primary-800' 
                : 'bg-white/90 border-gray-200'
              }`}
          >
            <div className="relative">
              {showMinimizeButton && (
                <button
                  onClick={toggleMinimize}
                  className="absolute -top-3 -right-3 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm"
                >
                  <Minimize2 size={14} className="text-gray-500 dark:text-gray-400" />
                </button>
              )}
              <div className="flex items-center space-x-2">
                {formats.map(({ type, emoji }) => {
                  const isActiveType = activeType === type;
                  return (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-200 flex items-center space-x-1.5 ${
                        isActiveType
                          ? 'bg-accent-500 text-white border-accent-600'
                          : isDarkMode
                          ? 'bg-[#1E4D3A] text-[#F5F5F2] border-primary-800 hover:bg-primary-800'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleFormatClick(type)}
                      aria-label={`Format as ${t(type)}`}
                      title={`Format as ${t(type)}`}
                    >
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="font-medium">{t(type)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transition effect for minimized state */}
      {isMinimized && isTransitioning && (
        <div className="fixed bottom-8 right-8 z-40 pointer-events-none">
          <div className={`absolute transition-all duration-300 ${
            prevActiveType === activeType ? 'opacity-0 scale-100' : 'opacity-0 scale-75'
          }`}>
            <span className="text-2xl">{
              formats.find(f => f.type === prevActiveType)?.emoji || '📝'
            }</span>
          </div>
          <div className={`transition-all duration-300 ${
            prevActiveType === activeType ? 'opacity-100 scale-100' : 'opacity-100 scale-100'
          }`}>
            <span className="text-2xl">{getActiveEmoji()}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default FormatButtons;