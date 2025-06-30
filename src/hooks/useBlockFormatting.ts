import { useCallback } from 'react';
import { Block } from '../types';

interface UseBlockFormattingProps {
  blocks: Block[];
  activeBlock: string | null;
  updateBlocks: (blocks: Block[]) => void;
  addToHistory: (blocks: Block[]) => void;
  setHasChanges?: (hasChanges: boolean) => void;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export const useBlockFormatting = ({
  blocks,
  activeBlock,
  updateBlocks,
  addToHistory,
  setHasChanges,
  blockRefs
}: UseBlockFormattingProps) => {
  /**
   * Changes the format of the active block
   */
  const handleFormatChange = useCallback((type: string) => {
    if (activeBlock) {
      addToHistory(blocks);
      const currentBlock = blocks.find((b) => b.id === activeBlock);
      if (!currentBlock) return;

      const selection = window.getSelection();
      const activeElement = blockRefs.current[activeBlock];
      let cursorPosition = 0;
      let hasSelection = false;
      let selectionStart = 0;
      let selectionEnd = 0;

      if (selection && selection.rangeCount > 0 && activeElement) {
        const range = selection.getRangeAt(0);
        if (range.startContainer.parentNode === activeElement || range.startContainer === activeElement) {
          cursorPosition = range.startOffset;
          hasSelection = !range.collapsed;
          selectionStart = range.startOffset;
          selectionEnd = range.endOffset;
        }
      }

      let newContent = currentBlock.content;
      let newBlockId = currentBlock.id;

      if (type === 'scene-heading' && currentBlock.type !== 'scene-heading') {
          newBlockId = `scene-${uuidv4()}`;
          if (newContent.trim() === '') {
              newContent = '';
          } else {
              newContent = newContent.toUpperCase();
          }
      } else if (type === 'scene-heading' && currentBlock.type === 'scene-heading') {
          newContent = newContent.toUpperCase();
      }
      
      else if (type === 'parenthetical') {
        const content = currentBlock.content.trim();
        if (content === '' || content === '()') {
          newContent = '()';
          cursorPosition = 1;
          selectionStart = 1;
          selectionEnd = 1;
        } else if (!content.startsWith('(') || !content.endsWith(')')) {
          newContent = `(${content.replace(/^\(|\)$/g, '')})`;
          cursorPosition = Math.min(cursorPosition + 1, newContent.length - 1);
          selectionStart = Math.min(selectionStart + 1, newContent.length - 1);
          selectionEnd = Math.min(selectionEnd + 1, newContent.length - 1);
        }
      } 
      else if (currentBlock.type === 'parenthetical' && type !== 'parenthetical') {
        newContent = currentBlock.content.replace(/^\(|\)$/g, '').trim();
        cursorPosition = Math.max(0, cursorPosition - 1);
        selectionStart = Math.max(0, selectionStart - 1);
        selectionEnd = Math.max(0, selectionEnd - 1);
      }

      if (type === 'character' && currentBlock.type !== 'character') {
        newContent = newContent.toUpperCase();
      }
      
      if (type === 'transition' && currentBlock.type !== 'transition') {
        if (newContent.trim() === '') {
          newContent = '';
        } else {
          newContent = newContent.toUpperCase();
          if (!newContent.endsWith('TO:') && !/^FADE (IN|OUT)|^DISSOLVE/i.test(newContent)) {
            newContent = newContent + ' TO:';
          }
        }
      } else if (type === 'transition' && currentBlock.type === 'transition') {
          newContent = newContent.toUpperCase();
      }

      if (setHasChanges) {
        setHasChanges(true);
      }

      const updatedBlocks = blocks.map((block) => {
        if (block.id === activeBlock) {
          return {
            ...block,
            id: newBlockId,
            type: type,
            content: newContent
          };
        }
        return block;
      });

      updateBlocks(updatedBlocks);

      setTimeout(() => {
        const el = blockRefs.current[newBlockId];
        if (!el) return;

        el.focus();

        if ((type === 'scene-heading' || type === 'transition' || type === 'shot') && newContent.trim() === '') {
          el.dispatchEvent(new FocusEvent('focus'));
          return;
        }

        try {
          const range = document.createRange();
          const textNode = el.firstChild || el;
          
          if (hasSelection) {
            const contentLengthRatio = newContent.length / currentBlock.content.length;
            const adjustedStart = Math.min(Math.round(selectionStart * contentLengthRatio), newContent.length);
            const adjustedEnd = Math.min(Math.round(selectionEnd * contentLengthRatio), newContent.length);
            
            range.setStart(textNode, adjustedStart);
            range.setEnd(textNode, adjustedEnd);
          } else {
            const adjustedPosition = Math.min(cursorPosition, newContent.length);
            range.setStart(textNode, adjustedPosition);
            range.collapse(true);
          }
          
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (err) {
          console.error("Error restoring cursor/selection:", err);
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }, 0);
    }
  }, [activeBlock, blocks, addToHistory, updateBlocks, setHasChanges, blockRefs]);

  return {
    handleFormatChange
  };
};

// Import uuid for generating new block IDs
import { v4 as uuidv4 } from 'uuid';