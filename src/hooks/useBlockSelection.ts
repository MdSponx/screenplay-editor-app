import { useCallback, useRef } from 'react';
import { Block } from '../types';

interface UseBlockSelectionProps {
  blocks: Block[];
  selectedBlocks: Set<string>;
  setSelectedBlocks: (blocks: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

export const useBlockSelection = ({
  blocks,
  selectedBlocks,
  setSelectedBlocks
}: UseBlockSelectionProps) => {
  const lastClickedBlock = useRef<string | null>(null);
  const isDragging = useRef(false);
  const dragStartBlock = useRef<string | null>(null);
  const dragEndBlock = useRef<string | null>(null);
  const isTextSelection = useRef(false);

  /**
   * Clears the current selection
   */
  const clearSelection = useCallback(() => {
    setSelectedBlocks(new Set());
  }, [setSelectedBlocks]);

  /**
   * Handles clicking on a block
   */
  const handleBlockClick = useCallback((id: string, e: React.MouseEvent) => {
    if (isTextSelection.current) return;

    if (!isDragging.current) {
      lastClickedBlock.current = id;
    }
  }, []);

  /**
   * Handles double-clicking on a block
   */
  const handleBlockDoubleClick = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedBlock.current) {
      const startIdx = blocks.findIndex(b => b.id === lastClickedBlock.current);
      const endIdx = blocks.findIndex(b => b.id === id);
      const [start, end] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      
      const newSelection = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSelection.add(blocks[i].id);
      }
      setSelectedBlocks(newSelection);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedBlocks((prev: Set<string>) => {
        const newSelection = new Set(prev);
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
        return newSelection;
      });
    } else {
      setSelectedBlocks(new Set([id]));
    }
  }, [blocks, setSelectedBlocks]);

  /**
   * Handles mouse down on a block (for drag selection)
   */
  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const isContentEditable = target.hasAttribute('contenteditable');
    
    if (isContentEditable) {
      isTextSelection.current = true;
      return;
    }

    e.preventDefault();
    isDragging.current = true;
    dragStartBlock.current = id;
    dragEndBlock.current = id;
  }, []);

  return {
    clearSelection,
    handleBlockClick,
    handleBlockDoubleClick,
    handleMouseDown
  };
};