import { useCallback, useRef } from 'react';
import { Block } from '../types';
import { getNextBlockType } from '../utils/blockUtils';
import { v4 as uuidv4 } from 'uuid';

interface UseEnterKeyLogicProps {
  blocks: Block[];
  updateBlocks: (blocks: Block[]) => void;
  addToHistory: (blocks: Block[]) => void;
  setHasChanges?: (hasChanges: boolean) => void;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  setFocusWithRetry: (blockId: string, cursorPosition?: 'start' | 'end' | number, maxRetries?: number) => void;
  createActionBlockAfterSceneHeading?: () => void;
}

export const useEnterKeyLogic = ({
  blocks,
  updateBlocks,
  addToHistory,
  setHasChanges,
  blockRefs,
  setFocusWithRetry,
  createActionBlockAfterSceneHeading
}: UseEnterKeyLogicProps) => {
  const lastKeyPressTime = useRef<number>(0);

  /**
   * Handles the Enter key press in a block
   */
  const handleEnterKey = useCallback((blockId: string, element: HTMLDivElement): string => {
    const selection = window.getSelection();
    if (!selection) return blockId;

    const range = selection.getRangeAt(0);
    const currentBlock = blocks.find((b) => b.id === blockId);
    if (!currentBlock) return blockId;

    const content = element.textContent || '';
    const caretPos = range.startOffset;
    const textBefore = content.substring(0, caretPos);
    const textAfter = content.substring(caretPos);

    const now = Date.now();
    const isDoubleEnter = now - lastKeyPressTime.current < 500;
    lastKeyPressTime.current = now;

    addToHistory(blocks);

    // Special handling for transitions: immediately create a new scene heading block
    if (currentBlock.type === 'transition') {
        const newSceneId = `scene-${uuidv4()}`;
        
        const newBlock: Block = {
            id: newSceneId,
            type: 'scene-heading',
            content: '',
        };

        const updatedBlocks = [...blocks];
        const currentIndex = blocks.findIndex((b) => b.id === blockId);
        
        if (textBefore.trim() !== '') {
          updatedBlocks[currentIndex] = {
            ...currentBlock,
            content: textBefore.trim().toUpperCase(),
          };
        } else {
          updatedBlocks[currentIndex] = {
            ...currentBlock,
            content: currentBlock.content.trim().toUpperCase(),
          };
        }

        updatedBlocks.splice(currentIndex + 1, 0, newBlock);
        updateBlocks(updatedBlocks);

        if (setHasChanges) {
            setHasChanges(true);
        }

        setTimeout(() => {
            setFocusWithRetry(newBlock.id);
        }, 0);
        return newBlock.id;
    }

    // ========== CHARACTER BLOCK LOGIC ==========
    if (currentBlock.type === 'character') {
        const currentIndex = blocks.findIndex(b => b.id === blockId);
        if (currentIndex === -1) return blockId;

        // Check if the character block is empty
        if (textBefore.trim() === '' && textAfter.trim() === '') {
            // Empty character block - check what's next to toggle between dialogue and action
            const nextBlock = blocks[currentIndex + 1];
            let newBlockType: string;
            
            if (nextBlock && nextBlock.type === 'dialogue') {
                newBlockType = 'action';
            } else {
                newBlockType = 'dialogue';
            }

            const newBlockId = `block-${uuidv4()}`;
            const newBlock: Block = {
                id: newBlockId,
                type: newBlockType,
                content: '',
            };

            const updatedBlocks = [...blocks];
            updatedBlocks.splice(currentIndex, 1, newBlock); // Replace character block
            
            updateBlocks(updatedBlocks);
            if (setHasChanges) {
                setHasChanges(true);
            }

            setTimeout(() => {
                setFocusWithRetry(newBlock.id);
            }, 0);
            return newBlock.id;
        }

        // Character block with content
        if (isDoubleEnter) {
            // Double enter: create action block
            const newBlockId = `block-${uuidv4()}`;
            const newBlock: Block = {
                id: newBlockId,
                type: 'action',
                content: textAfter.trim(),
            };

            const updatedBlocks = [...blocks];
            updatedBlocks[currentIndex] = {
                ...currentBlock,
                content: textBefore.trim().toUpperCase(),
            };
            updatedBlocks.splice(currentIndex + 1, 0, newBlock);
            
            updateBlocks(updatedBlocks);
            if (setHasChanges) {
                setHasChanges(true);
            }

            setTimeout(() => {
                setFocusWithRetry(newBlock.id);
            }, 0);
            return newBlock.id;
        } else {
            // Single enter: create dialogue block
            const newBlockId = `block-${uuidv4()}`;
            const newBlock: Block = {
                id: newBlockId,
                type: 'dialogue',
                content: textAfter.trim(),
            };

            const updatedBlocks = [...blocks];
            updatedBlocks[currentIndex] = {
                ...currentBlock,
                content: textBefore.trim().toUpperCase(),
            };
            updatedBlocks.splice(currentIndex + 1, 0, newBlock);
            
            updateBlocks(updatedBlocks);
            if (setHasChanges) {
                setHasChanges(true);
            }

            setTimeout(() => {
                setFocusWithRetry(newBlock.id);
            }, 0);
            return newBlock.id;
        }
    }
    // ========== END CHARACTER BLOCK LOGIC ==========

    // Double Enter in dialogue creates an action block immediately
    if (isDoubleEnter && currentBlock.type === 'dialogue' && textBefore.trim() === '') {
        const currentIndex = blocks.findIndex(b => b.id === blockId);
        if (currentIndex === -1) return blockId;

        const newBlockId = `block-${uuidv4()}`;
        const newBlock: Block = {
            id: newBlockId,
            type: 'action',
            content: textAfter.trim(),
        };

        const updatedBlocks = [...blocks];
        if (textBefore.trim() === '' && textAfter.trim() === '') {
          updatedBlocks.splice(currentIndex, 1, newBlock);
        } else {
          updatedBlocks[currentIndex] = {
              ...currentBlock,
              content: textBefore.trim(),
          };
          updatedBlocks.splice(currentIndex + 1, 0, newBlock);
        }
        
        updateBlocks(updatedBlocks);
        if (setHasChanges) {
          setHasChanges(true);
        }

        setTimeout(() => {
            setFocusWithRetry(newBlock.id);
        }, 0);
        return newBlock.id;
    }

    if (currentBlock.type === 'parenthetical') {
      const updatedBlocks = [...blocks];
      const currentIndex = blocks.findIndex((b) => b.id === blockId);

      let finalContent = textBefore;
      if (finalContent.startsWith('(') && !finalContent.endsWith(')')) {
        finalContent += ')';
      } else if (!finalContent.startsWith('(') && finalContent.endsWith(')')) {
        finalContent = `(${finalContent}`;
      }
      
      updatedBlocks[currentIndex] = {
          ...currentBlock,
          content: finalContent,
      };

      const newBlockId = `block-${uuidv4()}`;
      const newBlock: Block = {
          id: newBlockId,
          type: 'dialogue',
          content: textAfter.replace(/^\)/, '').trim(),
      };

      updatedBlocks.splice(currentIndex + 1, 0, newBlock);
      updateBlocks(updatedBlocks);
      if (setHasChanges) {
          setHasChanges(true);
      }

      setTimeout(() => {
          setFocusWithRetry(newBlock.id);
      }, 0);
      return newBlock.id;
    }

    const nextBlockType = getNextBlockType(currentBlock.type, textBefore, false);
    
    const newBlockId = nextBlockType === 'scene-heading' 
      ? `scene-${uuidv4()}` 
      : `block-${uuidv4()}`;
    
    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    const updatedBlocks = [...blocks];

    updatedBlocks[currentIndex] = {
      ...currentBlock,
      content: textBefore,
    };

    const newBlock: Block = {
      id: newBlockId,
      type: nextBlockType,
      content: textAfter,
    };

    updatedBlocks.splice(currentIndex + 1, 0, newBlock);
    updateBlocks(updatedBlocks);
    if (setHasChanges) {
      setHasChanges(true);
    }

    setTimeout(() => {
      if (newBlock.type === 'scene-heading') {
        // ========== SCENE HEADING CURSOR FIX ==========
        // Set cursor to end of text instead of beginning
        const el = blockRefs.current[newBlock.id];
        if (el) {
          el.focus();
          
          const range = document.createRange();
          const textNode = el.firstChild || el;
          const textLength = textAfter.length;
          range.setStart(textNode, textLength);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          // Trigger focus event for scene heading suggestions
          el.dispatchEvent(new FocusEvent('focus'));
        }
        // ========== END SCENE HEADING CURSOR FIX ==========
      } else {
        setFocusWithRetry(newBlock.id);
      }
    }, 0);

    return newBlock.id;
  }, [blocks, addToHistory, updateBlocks, setHasChanges, blockRefs, setFocusWithRetry]);

  return {
    handleEnterKey
  };
};