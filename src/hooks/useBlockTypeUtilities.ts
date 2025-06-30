import { useCallback } from 'react';
import { Block } from '../types';

interface UseBlockTypeUtilitiesProps {
  blocks: Block[];
}

export const useBlockTypeUtilities = ({ blocks }: UseBlockTypeUtilitiesProps) => {
  /**
   * Checks if a character block was created after a dialogue block
   */
  const isCharacterBlockAfterDialogue = useCallback((blockId: string): boolean => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex <= 0) return false;
    
    const previousBlock = blocks[blockIndex - 1];
    return previousBlock.type === 'dialogue';
  }, [blocks]);

  /**
   * Checks if a block is a scene heading
   */
  const isSceneHeading = useCallback((blockId: string): boolean => {
    const block = blocks.find(b => b.id === blockId);
    return block?.type === 'scene-heading';
  }, [blocks]);

  /**
   * Checks if a block is a character block
   */
  const isCharacterBlock = useCallback((blockId: string): boolean => {
    const block = blocks.find(b => b.id === blockId);
    return block?.type === 'character';
  }, [blocks]);

  /**
   * Checks if a block is a dialogue block
   */
  const isDialogueBlock = useCallback((blockId: string): boolean => {
    const block = blocks.find(b => b.id === blockId);
    return block?.type === 'dialogue';
  }, [blocks]);

  /**
   * Gets the block type for a given block ID
   */
  const getBlockType = useCallback((blockId: string): string | undefined => {
    const block = blocks.find(b => b.id === blockId);
    return block?.type;
  }, [blocks]);

  return {
    isCharacterBlockAfterDialogue,
    isSceneHeading,
    isCharacterBlock,
    isDialogueBlock,
    getBlockType
  };
};