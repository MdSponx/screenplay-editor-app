import { useCallback } from 'react';
import { Block } from '../types';

interface UseBackspaceKeyLogicProps {
  blocks: Block[];
  updateBlocks: (blocks: Block[]) => void;
  addToHistory: (blocks: Block[]) => void;
  setHasChanges?: (hasChanges: boolean) => void;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export const useBackspaceKeyLogic = ({
  blocks,
  updateBlocks,
  addToHistory,
  setHasChanges,
  blockRefs
}: UseBackspaceKeyLogicProps) => {
  /**
   * Handles backspace key in empty blocks
   */
  const handleBackspaceInEmptyBlock = useCallback((blockId: string) => {
    if (blocks.length <= 1) {
      return false; // Don't delete the last block
    }

    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    if (currentIndex <= 0) {
      return false; // Can't delete if it's the first block or not found
    }

    addToHistory(blocks);
    
    const previousBlock = blocks[currentIndex - 1];
    const prevEl = blockRefs.current[previousBlock.id];

    const updatedBlocks = blocks.filter((b) => b.id !== blockId);
    updateBlocks(updatedBlocks);

    if (setHasChanges) {
      setHasChanges(true);
    }

    if (prevEl) {
      prevEl.focus();
      const range = document.createRange();
      
      if (!prevEl.firstChild) {
        prevEl.textContent = '';
      }
      
      const textNode = prevEl.firstChild || prevEl;
      const position = previousBlock.content.length;
      
      try {
        range.setStart(textNode, position);
        range.setEnd(textNode, position);
        
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (err) {
        range.selectNodeContents(prevEl);
        range.collapse(false);
        
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }

    return true; // Handled backspace
  }, [blocks, addToHistory, updateBlocks, setHasChanges, blockRefs]);

  return {
    handleBackspaceInEmptyBlock
  };
};