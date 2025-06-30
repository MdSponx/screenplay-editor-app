import { useCallback } from 'react';
import { Block } from '../types';
import { BLOCK_TYPES } from '../constants/editorConstants';

interface UseTabKeyLogicProps {
  blocks: Block[];
  activeBlock: string | null;
  handleFormatChange: (type: string) => void;
}

export const useTabKeyLogic = ({
  blocks,
  activeBlock,
  handleFormatChange
}: UseTabKeyLogicProps) => {
  /**
   * Handles tab key to cycle through block formats
   */
  const handleTabKey = useCallback(() => {
    if (!activeBlock) return false;
    
    const currentBlock = blocks.find((b) => b.id === activeBlock);
    if (!currentBlock) return false;

    const currentIndex = BLOCK_TYPES.indexOf(currentBlock.type as any);
    const nextType = BLOCK_TYPES[(currentIndex + 1) % BLOCK_TYPES.length];

    handleFormatChange(nextType);
    return true; // Handled tab
  }, [blocks, activeBlock, handleFormatChange]);

  return {
    handleTabKey
  };
};