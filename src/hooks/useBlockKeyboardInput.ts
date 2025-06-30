import { useCallback } from 'react';
import { Block } from '../types';

interface UseBlockKeyboardInputProps {
  blocks: Block[];
  activeBlock: string | null;
  handleEnterKey: (blockId: string, element: HTMLDivElement) => string;
  handleTabKey: () => boolean;
  handleBackspaceInEmptyBlock: (blockId: string) => boolean;
  setHasChanges?: (hasChanges: boolean) => void;
  selectedBlocks: Set<string>;
  setSelectedBlocks: (blocks: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

export const useBlockKeyboardInput = ({
  blocks,
  activeBlock,
  handleEnterKey,
  handleTabKey,
  handleBackspaceInEmptyBlock,
  setHasChanges,
  selectedBlocks,
  setSelectedBlocks
}: UseBlockKeyboardInputProps) => {
  /**
   * Main keyboard event handler for blocks
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, blockId: string) => {
    const el = e.target as HTMLDivElement;

    if (setHasChanges) {
      setHasChanges(true);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterKey(blockId, el);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabKey();
    }

    if (e.key === 'Backspace' && el.textContent === '') {
      e.preventDefault();
      e.stopPropagation();
      handleBackspaceInEmptyBlock(blockId);
    }
  }, [handleEnterKey, handleTabKey, handleBackspaceInEmptyBlock, setHasChanges]);

  // Clear selection on any key press (except modifiers and navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || 
          e.key === 'Shift' || e.key === 'Tab' || 
          e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
          e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        return;
      }

      if (selectedBlocks.size > 0) {
        setSelectedBlocks(new Set());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlocks, setSelectedBlocks]);

  return {
    handleKeyDown
  };
};

// Import React hooks
import { useCallback, useEffect } from 'react';