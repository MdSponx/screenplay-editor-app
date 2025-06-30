import { useCallback, useRef, useEffect } from 'react';
import { Block, BlockHandlers } from '../types';
import { BLOCK_TYPES } from '../constants/editorConstants';
import { 
  detectFormat, 
  getNextBlockType, 
  updateBlockNumbers,
  createSceneHeadingHash
} from '../utils/blockUtils';
import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc, setDoc, updateDoc, collection, arrayUnion, serverTimestamp, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MultiBlockSelection {
  startBlock: string | null;
  startOffset: number;
  endBlock: string | null;
  endOffset: number;
  selectedText: string;
  selectedBlocks: Block[];
}

interface ClipboardData {
  blocks: Block[];
  text: string;
  timestamp: number;
}

export const useBlockHandlersImproved = (
  state: {
    blocks: Block[];
    activeBlock: string | null;
    textContent: Record<string, string>;
    selectedBlocks: Set<string>;
  },
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  addToHistory: (blocks: Block[]) => void,
  updateBlocks: (blocks: Block[]) => void,
  setSelectedBlocks: (blocks: Set<string> | ((prev: Set<string>) => Set<string>)) => void,
  setHasChanges?: (hasChanges: boolean) => void,
  projectId?: string,
  screenplayId?: string,
  onSceneHeadingUpdate?: () => Promise<void>
): BlockHandlers => {
  const lastKeyPressTime = useRef<number>(0);
  const lastClickedBlock = useRef<string | null>(null);
  const isDragging = useRef(false);
  const dragStartBlock = useRef<string | null>(null);
  const dragEndBlock = useRef<string | null>(null);
  const isTextSelection = useRef(false);
  const selectionStartBlock = useRef<string | null>(null);
  const selectionStartOffset = useRef<number>(0);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const multiBlockSelection = useRef<MultiBlockSelection>({
    startBlock: null,
    startOffset: 0,
    endBlock: null,
    endOffset: 0,
    selectedText: '',
    selectedBlocks: []
  });
  
  // New refs for tracking character block behavior after dialogue
  const characterBlockAfterDialogue = useRef<Set<string>>(new Set());
  const characterBlockEnterCount = useRef<Record<string, number>>({});
  
  // New refs for drag selection
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const dragCurrentPosition = useRef({ x: 0, y: 0 });
  const isDragSelecting = useRef(false);
  const dragSelectionBlocks = useRef<Set<string>>(new Set());

  // Enhanced focus management utility
  const setFocusWithRetry = useCallback((blockId: string, cursorPosition: 'start' | 'end' | number = 'start', maxRetries = 3) => {
    let retryCount = 0;
    
    const attemptFocus = () => {
      const el = blockRefs.current[blockId];
      if (!el) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptFocus, 10 * retryCount); // Exponential backoff
        }
        return;
      }

      // Ensure element is focusable
      if (!el.hasAttribute('contenteditable')) {
        el.setAttribute('contenteditable', 'true');
      }

      // Focus the element
      el.focus();

      // Set cursor position with enhanced reliability
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (!selection) return;

        // Ensure there's content to work with
        if (!el.firstChild) {
          const textNode = document.createTextNode('');
          el.appendChild(textNode);
        }

        let textNode = el.firstChild;
        
        // Find the first text node if the first child isn't a text node
        while (textNode && textNode.nodeType !== Node.TEXT_NODE) {
          textNode = textNode.firstChild || textNode.nextSibling;
        }

        if (!textNode) {
          // Create a text node if none exists
          textNode = document.createTextNode('');
          el.appendChild(textNode);
        }

        const textContent = textNode.textContent || '';
        let position = 0;

        if (cursorPosition === 'end') {
          position = textContent.length;
        } else if (cursorPosition === 'start') {
          position = 0;
        } else if (typeof cursorPosition === 'number') {
          position = Math.min(cursorPosition, textContent.length);
        }

        range.setStart(textNode, position);
        range.setEnd(textNode, position);
        
        selection.removeAllRanges();
        selection.addRange(range);

        // Verify focus was successful
        if (document.activeElement !== el && retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptFocus, 10 * retryCount);
        }
      } catch (error) {
        console.error('Error setting cursor position:', error);
        // Fallback: just focus the element
        el.focus();
      }
    };

    // Use requestAnimationFrame for better timing
    requestAnimationFrame(attemptFocus);
  }, [blockRefs]);

  // Enhanced action block creation after scene heading
  const createActionBlockAfterSceneHeading = useCallback((sceneHeadingBlockId: string) => {
    const currentIndex = state.blocks.findIndex(b => b.id === sceneHeadingBlockId);
    if (currentIndex === -1) return null;

    const actionBlockId = `action-${uuidv4()}`;
    const actionBlock: Block = {
      id: actionBlockId,
      type: 'action',
      content: '',
    };

    const updatedBlocks = [...state.blocks];
    updatedBlocks.splice(currentIndex + 1, 0, actionBlock);
    
    updateBlocks(updateBlockNumbers(updatedBlocks));
    
    if (setHasChanges) {
      setHasChanges(true);
    }

    // Enhanced focus management for action block
    setTimeout(() => {
      setFocusWithRetry(actionBlockId, 'start');
    }, 50); // Slightly longer delay for scene heading processing

    return actionBlockId;
  }, [state.blocks, updateBlocks, setHasChanges, setFocusWithRetry]);

  // Find Block ID from a DOM node
  const findBlockIdFromNode = (node: Node | null): string | null => {
    if (!node) return null;
    
    let current = node;
    while (current && !(current instanceof HTMLElement && current.hasAttribute('data-block-id'))) {
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        return null;
      }
    }
    
    return current instanceof HTMLElement ? current.getAttribute('data-block-id') : null;
  };

  const handleEnterKey = useCallback((blockId: string, element: HTMLDivElement): string => {
    const selection = window.getSelection();
    if (!selection) return blockId;

    const range = selection.getRangeAt(0);
    const currentBlock = state.blocks.find((b) => b.id === blockId);
    if (!currentBlock) return blockId;

    const content = element.textContent || '';
    const caretPos = range.startOffset;
    const textBefore = content.substring(0, caretPos);
    const textAfter = content.substring(caretPos);

    const now = Date.now();
    const isDoubleEnter = now - lastKeyPressTime.current < 500;
    lastKeyPressTime.current = now;

    addToHistory(state.blocks);

    // Special handling for transitions: immediately create a new scene heading block
    if (currentBlock.type === 'transition') {
        const newSceneId = `scene-${uuidv4()}`;
        
        const newBlock: Block = {
            id: newSceneId,
            type: 'scene-heading',
            content: '',
        };

        const updatedBlocks = [...state.blocks];
        const currentIndex = state.blocks.findIndex((b) => b.id === blockId);
        
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
        updateBlocks(updateBlockNumbers(updatedBlocks));

        if (setHasChanges) {
            setHasChanges(true);
        }

        setTimeout(() => {
            setFocusWithRetry(newBlock.id, 'start');
        }, 0);
        return newBlock.id;
    }

    // ========== CHARACTER BLOCK LOGIC ==========
    if (currentBlock.type === 'character') {
        const currentIndex = state.blocks.findIndex(b => b.id === blockId);
        if (currentIndex === -1) return blockId;

        // Check if this character block was created after dialogue (special behavior)
        const isCharacterAfterDialogue = characterBlockAfterDialogue.current.has(blockId);

        if (isCharacterAfterDialogue) {
            // NEW BEHAVIOR: Character block created after dialogue
            
            // Track Enter key presses for this block
            const currentEnterCount = characterBlockEnterCount.current[blockId] || 0;
            characterBlockEnterCount.current[blockId] = currentEnterCount + 1;

            // If this is the second Enter press, convert to action block
            if (characterBlockEnterCount.current[blockId] >= 2) {
                const newBlockId = `block-${uuidv4()}`;
                const newBlock: Block = {
                    id: newBlockId,
                    type: 'action',
                    content: textAfter.trim(),
                };

                const updatedBlocks = [...state.blocks];
                
                // If character block has content, keep it; otherwise replace it
                if (textBefore.trim() !== '') {
                    updatedBlocks[currentIndex] = {
                        ...currentBlock,
                        content: textBefore.trim().toUpperCase(),
                    };
                    updatedBlocks.splice(currentIndex + 1, 0, newBlock);
                } else {
                    updatedBlocks.splice(currentIndex, 1, newBlock);
                }
                
                // Clean up tracking for this block
                characterBlockAfterDialogue.current.delete(blockId);
                delete characterBlockEnterCount.current[blockId];
                
                updateBlocks(updateBlockNumbers(updatedBlocks));
                if (setHasChanges) {
                    setHasChanges(true);
                }

                setTimeout(() => {
                    setFocusWithRetry(newBlock.id, 'start');
                }, 0);
                return newBlock.id;
            } else {
                // First Enter press - do nothing, just wait for user input or second Enter
                // Don't create any new blocks, just stay in the character block
                return blockId;
            }
        } else {
            // ORIGINAL BEHAVIOR: Character block not created after dialogue
            
            // Check if the character block is empty
            if (textBefore.trim() === '' && textAfter.trim() === '') {
                // Empty character block - check what's next to toggle between dialogue and action
                const nextBlock = state.blocks[currentIndex + 1];
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

                const updatedBlocks = [...state.blocks];
                updatedBlocks.splice(currentIndex, 1, newBlock); // Replace character block
                
                updateBlocks(updateBlockNumbers(updatedBlocks));
                if (setHasChanges) {
                    setHasChanges(true);
                }

                setTimeout(() => {
                    setFocusWithRetry(newBlock.id, 'start');
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

                const updatedBlocks = [...state.blocks];
                updatedBlocks[currentIndex] = {
                    ...currentBlock,
                    content: textBefore.trim().toUpperCase(),
                };
                updatedBlocks.splice(currentIndex + 1, 0, newBlock);
                
                updateBlocks(updateBlockNumbers(updatedBlocks));
                if (setHasChanges) {
                    setHasChanges(true);
                }

                setTimeout(() => {
                    setFocusWithRetry(newBlock.id, 'start');
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

                const updatedBlocks = [...state.blocks];
                updatedBlocks[currentIndex] = {
                    ...currentBlock,
                    content: textBefore.trim().toUpperCase(),
                };
                updatedBlocks.splice(currentIndex + 1, 0, newBlock);
                
                updateBlocks(updateBlockNumbers(updatedBlocks));
                if (setHasChanges) {
                    setHasChanges(true);
                }

                setTimeout(() => {
                    setFocusWithRetry(newBlock.id, 'start');
                }, 0);
                return newBlock.id;
            }
        }
    }
    // ========== END CHARACTER BLOCK LOGIC ==========

    // Handle dialogue block Enter behavior
    if (currentBlock.type === 'dialogue') {
        const currentIndex = state.blocks.findIndex(b => b.id === blockId);
        if (currentIndex === -1) return blockId;

        // Double Enter in dialogue creates an action block immediately
        if (isDoubleEnter && textBefore.trim() === '') {
            const newBlockId = `block-${uuidv4()}`;
            const newBlock: Block = {
                id: newBlockId,
                type: 'action',
                content: textAfter.trim(),
            };

            const updatedBlocks = [...state.blocks];
            if (textBefore.trim() === '' && textAfter.trim() === '') {
              updatedBlocks.splice(currentIndex, 1, newBlock);
            } else {
              updatedBlocks[currentIndex] = {
                  ...currentBlock,
                  content: textBefore.trim(),
              };
              updatedBlocks.splice(currentIndex + 1, 0, newBlock);
            }
            
            updateBlocks(updateBlockNumbers(updatedBlocks));
            if (setHasChanges) {
              setHasChanges(true);
            }

            setTimeout(() => {
                setFocusWithRetry(newBlock.id, 'start');
            }, 0);
            return newBlock.id;
        }

        // Single Enter in dialogue creates a character block (NEW BEHAVIOR)
        // Mark this character block as created after dialogue for special handling
        const newCharacterBlockId = `block-${uuidv4()}`;
        const newCharacterBlock: Block = {
            id: newCharacterBlockId,
            type: 'character',
            content: textAfter.trim(),
        };

        const updatedBlocks = [...state.blocks];
        updatedBlocks[currentIndex] = {
            ...currentBlock,
            content: textBefore.trim(),
        };
        updatedBlocks.splice(currentIndex + 1, 0, newCharacterBlock);
        
        // Track that this character block was created after dialogue
        characterBlockAfterDialogue.current.add(newCharacterBlockId);
        characterBlockEnterCount.current[newCharacterBlockId] = 0;
        
        updateBlocks(updateBlockNumbers(updatedBlocks));
        if (setHasChanges) {
            setHasChanges(true);
        }

        setTimeout(() => {
            setFocusWithRetry(newCharacterBlockId, 'start');
        }, 0);
        return newCharacterBlockId;
    }

    if (currentBlock.type === 'parenthetical') {
      const updatedBlocks = [...state.blocks];
      const currentIndex = state.blocks.findIndex((b) => b.id === blockId);

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
      updateBlocks(updateBlockNumbers(updatedBlocks));
      if (setHasChanges) {
          setHasChanges(true);
      }

      setTimeout(() => {
          setFocusWithRetry(newBlock.id, 'start');
      }, 0);
      return newBlock.id;
    }

    const nextBlockType = getNextBlockType(currentBlock.type, textBefore, false);
    
    const newBlockId = nextBlockType === 'scene-heading' 
      ? `scene-${uuidv4()}` 
      : `block-${uuidv4()}`;
    
    const currentIndex = state.blocks.findIndex((b) => b.id === blockId);
    const updatedBlocks = [...state.blocks];

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
    updateBlocks(updateBlockNumbers(updatedBlocks));
    if (setHasChanges) {
      setHasChanges(true);
    }

    // Enhanced focus management based on block type
    setTimeout(() => {
      if (newBlock.type === 'scene-heading') {
        // For scene headings, set cursor to end and trigger suggestions
        setFocusWithRetry(newBlock.id, 'end');
        
        // Trigger focus event for scene heading suggestions after a brief delay
        setTimeout(() => {
          const el = blockRefs.current[newBlock.id];
          if (el) {
            el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
          }
        }, 100);
      } else {
        // For other block types (especially action blocks), set cursor to start
        setFocusWithRetry(newBlock.id, 'start');
      }
    }, 0);

    return newBlock.id;
  }, [state.blocks, addToHistory, updateBlocks, setHasChanges, setFocusWithRetry, blockRefs]);

  const handleFormatChange = useCallback((type: string) => {
    if (state.activeBlock) {
      addToHistory(state.blocks);
      const currentBlock = state.blocks.find((b) => b.id === state.activeBlock);
      if (!currentBlock) return;

      const selection = window.getSelection();
      const activeElement = blockRefs.current[state.activeBlock];
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

      const updatedBlocks = state.blocks.map((block) => {
        if (block.id === state.activeBlock) {
          return {
            ...block,
            id: newBlockId,
            type: type,
            content: newContent
          };
        }
        return block;
      });

      updateBlocks(updateBlockNumbers(updatedBlocks));

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
  }, [state.activeBlock, state.blocks, addToHistory, updateBlocks, setHasChanges]);

  const handleContentChange = useCallback(async (id: string, newContent: string, forcedType?: string) => {
    const currentBlockIndex = state.blocks.findIndex(b => b.id === id);
    const currentBlock = state.blocks[currentBlockIndex];
    
    if (!currentBlock) return;

    // Clean up tracking for character blocks that are being removed or changed
    if (characterBlockAfterDialogue.current.has(id)) {
      if (newContent.trim() === '' || (forcedType && forcedType !== 'character')) {
        // Block is being removed or changed to a different type
        characterBlockAfterDialogue.current.delete(id);
        delete characterBlockEnterCount.current[id];
      } else if (currentBlock.type === 'character' && newContent.trim().length > 0 && currentBlock.content.trim() === '') {
        // Character block just got content (likely from suggestion selection)
        // Remove from special tracking since user has selected a character
        characterBlockAfterDialogue.current.delete(id);
        delete characterBlockEnterCount.current[id];
      }
    }

    if (newContent.trim() === '' && state.blocks.length > 1 && !forcedType) {
      addToHistory(state.blocks);
      const updatedBlocks = state.blocks.filter((_, index) => index !== currentBlockIndex);
      updateBlocks(updatedBlocks);
      if (setHasChanges) {
        setHasChanges(true);
      }
      return;
    }
    
    addToHistory(state.blocks);
    if (setHasChanges) {
      setHasChanges(true);
    }

    let updatedBlocks = [...state.blocks];
    let blockToFocusId: string | null = null;
    
    let effectiveType = forcedType;
    if (!effectiveType) {
        const detectedFormat = detectFormat(newContent);
        effectiveType = detectedFormat || currentBlock.type;
    }

    updatedBlocks[currentBlockIndex] = {
      ...updatedBlocks[currentBlockIndex],
      content: newContent,
      type: effectiveType,
    };

    // Special handling for scene-heading creation/update from content change
    if (effectiveType === 'scene-heading' && projectId && screenplayId) {
        const sceneHeadingText = newContent.trim().toUpperCase();
        
        // Helper function to check if text is a prefix-only entry
        const isPrefixOnly = (text: string): boolean => {
            const trimmedText = text.trim().toUpperCase();
            const prefixPatterns = [
                'INT.',
                'EXT.',
                'INT./EXT.',
                'EXT./INT.',
                'I/E.'
            ];
            return prefixPatterns.includes(trimmedText);
        };

        // Only save to unique_scene_headings if it's not a prefix-only entry and not empty
        if (sceneHeadingText.length > 0 && !isPrefixOnly(sceneHeadingText)) {
            const sceneHeadingHash = createSceneHeadingHash(sceneHeadingText);
            const uniqueSceneHeadingRef = doc(db, `projects/${projectId}/unique_scene_headings`, sceneHeadingHash);

            try {
                // Helper function to count scene headings currently in the editor
                const countSceneHeadingsInEditor = async (): Promise<Record<string, number>> => {
                    try {
                        // Fetch current screenplay blocks from scenes collection
                        const scenesRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`);
                        const scenesQuery = query(scenesRef, orderBy('order'));
                        const scenesSnapshot = await getDocs(scenesQuery);
                        
                        const sceneHeadingCounts: Record<string, number> = {};
                        
                        scenesSnapshot.docs.forEach(doc => {
                            const sceneData = doc.data();
                            const sceneHeading = sceneData.scene_heading?.trim().toUpperCase();
                            
                            if (sceneHeading && !isPrefixOnly(sceneHeading)) {
                                sceneHeadingCounts[sceneHeading] = (sceneHeadingCounts[sceneHeading] || 0) + 1;
                            }
                        });
                        
                        return sceneHeadingCounts;
                    } catch (error) {
                        console.error('Error counting scene headings in editor:', error);
                        return {};
                    }
                };

                // Get current usage count from the editor
                const editorCounts = await countSceneHeadingsInEditor();
                const currentUsageCount = editorCounts[sceneHeadingText] || 0;

                const uniqueSceneHeadingSnap = await getDoc(uniqueSceneHeadingRef);
                const batch = writeBatch(db);
                
                if (uniqueSceneHeadingSnap.exists()) {
                    // Update existing scene heading with current editor count
                    batch.update(uniqueSceneHeadingRef, {
                        count: currentUsageCount,
                        lastUsed: serverTimestamp(),
                        screenplayIds: arrayUnion(screenplayId)
                    });
                    console.log(`Updated existing scene heading: ${sceneHeadingText} (count: ${currentUsageCount})`);
                } else {
                    // Create new scene heading with current editor count
                    batch.set(uniqueSceneHeadingRef, {
                        id: sceneHeadingHash,
                        text: sceneHeadingText,
                        text_uppercase: sceneHeadingText,
                        count: currentUsageCount,
                        lastUsed: serverTimestamp(),
                        screenplayIds: [screenplayId],
                        associated_characters: [],
                        associated_elements: []
                    });
                    console.log(`Created new scene heading: ${sceneHeadingText} (count: ${currentUsageCount})`);
                }
                
                await batch.commit();
                
                // Call the callback to refresh scene headings in the parent component
                if (onSceneHeadingUpdate) {
                    await onSceneHeadingUpdate();
                }
            } catch (firestoreError) {
                console.error("Error updating unique_scene_headings in handleContentChange:", firestoreError);
            }
        } else if (sceneHeadingText.length > 0 && isPrefixOnly(sceneHeadingText)) {
            console.log(`Skipped saving prefix-only scene heading: ${sceneHeadingText}`);
        }
    }
    
    if (effectiveType === 'character' && currentBlock.type !== 'character' && newContent.trim()) {
      const dialogueBlockId = `block-${uuidv4()}`;
      const dialogueBlock: Block = {
          id: dialogueBlockId,
          type: 'dialogue',
          content: '',
      };
      updatedBlocks.splice(currentBlockIndex + 1, 0, dialogueBlock);
      blockToFocusId = dialogueBlockId;
    } else if (currentBlock.type === 'character' && newContent.trim() && currentBlock.content.trim() === '') {
      // Character block just got content (e.g., from suggestion selection)
      // Check if there's already a dialogue block after this character block
      const nextBlockIndex = currentBlockIndex + 1;
      const nextBlock = state.blocks[nextBlockIndex];
      
      if (!nextBlock || nextBlock.type !== 'dialogue') {
        // Create a new dialogue block
        const dialogueBlockId = `block-${uuidv4()}`;
        const dialogueBlock: Block = {
            id: dialogueBlockId,
            type: 'dialogue',
            content: '',
        };
        updatedBlocks.splice(currentBlockIndex + 1, 0, dialogueBlock);
        blockToFocusId = dialogueBlockId;
      } else {
        // Focus the existing dialogue block
        blockToFocusId = nextBlock.id;
      }
    }

    updateBlocks(updateBlockNumbers(updatedBlocks));
    
    if (blockToFocusId) {
      setTimeout(() => {
        setFocusWithRetry(blockToFocusId!, 'start');
      }, 0);
    }
  }, [state.blocks, addToHistory, updateBlocks, setHasChanges, projectId, screenplayId, onSceneHeadingUpdate, setFocusWithRetry]);

  const handleCopyMultiBlockSelection = useCallback(() => {
    if (!multiBlockSelection.current.startBlock || 
        !multiBlockSelection.current.endBlock || 
        !multiBlockSelection.current.selectedText) {
      return;
    }

    const selectedText = multiBlockSelection.current.selectedText;
    const formattedText = selectedText;
    
    navigator.clipboard.writeText(formattedText).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }, []);

  const handleCutMultiBlockSelection = useCallback(() => {
    if (!multiBlockSelection.current.startBlock || 
        !multiBlockSelection.current.endBlock || 
        !multiBlockSelection.current.selectedText) {
      return;
    }

    // Copy the selection first
    handleCopyMultiBlockSelection();
    addToHistory(state.blocks);
    
    const startIdx = state.blocks.findIndex(b => b.id === multiBlockSelection.current.startBlock);
    const endIdx = state.blocks.findIndex(b => b.id === multiBlockSelection.current.endBlock);
    
    if (startIdx === -1 || endIdx === -1) return;
    
    // Remove the selected blocks
    const [minIndex, maxIndex] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const updatedBlocks = [
      ...state.blocks.slice(0, minIndex),
      ...state.blocks.slice(maxIndex + 1)
    ];
    
    updateBlocks(updatedBlocks);
    if (setHasChanges) {
      setHasChanges(true);
    }
    
    // Clear selection
    setSelectedBlocks(new Set());
    
    // Focus the block before the cut selection, or the first block if cutting from the beginning
    const focusIndex = Math.max(0, minIndex - 1);
    if (updatedBlocks.length > 0 && updatedBlocks[focusIndex]) {
      setTimeout(() => {
        setFocusWithRetry(updatedBlocks[focusIndex].id, 'end');
      }, 0);
    }
    
    multiBlockSelection.current = {
      startBlock: null,
      startOffset: 0,
      endBlock: null,
      endOffset: 0,
      selectedText: '',
      selectedBlocks: []
    };
  }, [addToHistory, handleCopyMultiBlockSelection, state.blocks, updateBlocks, setHasChanges, setSelectedBlocks, setFocusWithRetry]);

  // Enhanced copy function that preserves block metadata
  const handleCopySelectedBlocks = useCallback(() => {
    if (state.selectedBlocks.size === 0) return;
    
    const selectedBlockIds = Array.from(state.selectedBlocks);
    const selectedBlocks = state.blocks.filter(block => selectedBlockIds.includes(block.id));
    
    // Sort blocks by their order in the document
    selectedBlocks.sort((a, b) => {
      const aIndex = state.blocks.findIndex(block => block.id === a.id);
      const bIndex = state.blocks.findIndex(block => block.id === b.id);
      return aIndex - bIndex;
    });
    
    // Create clipboard data with both text and structured data
    const clipboardData: ClipboardData = {
      blocks: selectedBlocks,
      text: selectedBlocks.map(block => block.content).join('\n\n'),
      timestamp: Date.now()
    };
    
    // Store in both clipboard and a custom data attribute for internal use
    navigator.clipboard.writeText(clipboardData.text).catch(err => {
      console.error('Failed to copy text: ', err);
    });
    
    // Store structured data in sessionStorage for internal paste operations
    try {
      sessionStorage.setItem('screenplay-clipboard', JSON.stringify(clipboardData));
    } catch (err) {
      console.error('Failed to store clipboard data:', err);
    }
    
    // Update multi-block selection for consistency
    if (selectedBlocks.length > 0) {
      multiBlockSelection.current = {
        startBlock: selectedBlocks[0].id,
        startOffset: 0,
        endBlock: selectedBlocks[selectedBlocks.length - 1].id,
        endOffset: selectedBlocks[selectedBlocks.length - 1].content.length,
        selectedText: clipboardData.text,
        selectedBlocks: selectedBlocks
      };
    }
  }, [state.selectedBlocks, state.blocks]);

  // Enhanced cut function
  const handleCutSelectedBlocks = useCallback(() => {
    if (state.selectedBlocks.size === 0) return;
    
    // Copy first
    handleCopySelectedBlocks();
    addToHistory(state.blocks);
    
    const selectedBlockIds = Array.from(state.selectedBlocks);
    const updatedBlocks = state.blocks.filter(block => !selectedBlockIds.includes(block.id));
    
    updateBlocks(updatedBlocks);
    if (setHasChanges) {
      setHasChanges(true);
    }
    
    // Clear selection
    setSelectedBlocks(new Set());
    
    // Focus appropriate block after cut
    if (updatedBlocks.length > 0) {
      // Find the first remaining block after the cut position
      const firstSelectedIndex = state.blocks.findIndex(block => selectedBlockIds.includes(block.id));
      const focusIndex = Math.min(firstSelectedIndex, updatedBlocks.length - 1);
      
      setTimeout(() => {
        setFocusWithRetry(updatedBlocks[focusIndex].id, 'start');
      }, 0);
    }
  }, [state.selectedBlocks, state.blocks, handleCopySelectedBlocks, addToHistory, updateBlocks, setHasChanges, setSelectedBlocks, setFocusWithRetry]);

  // Paste function that handles both text and structured block data
  const handlePasteBlocks = useCallback(async () => {
    if (!state.activeBlock) return;
    
    try {
      // First try to get structured data from sessionStorage
      const storedData = sessionStorage.getItem('screenplay-clipboard');
      let clipboardData: ClipboardData | null = null;
      
      if (storedData) {
        try {
          clipboardData = JSON.parse(storedData);
          // Validate the data is recent (within 1 hour)
          if (clipboardData && Date.now() - clipboardData.timestamp > 3600000) {
            clipboardData = null;
          }
        } catch (err) {
          console.error('Failed to parse stored clipboard data:', err);
        }
      }
      
      // If we have structured data, use it; otherwise fall back to text
      if (clipboardData && clipboardData.blocks.length > 0) {
        addToHistory(state.blocks);
        
        const currentIndex = state.blocks.findIndex(b => b.id === state.activeBlock);
        if (currentIndex === -1) return;
        
        // Create new blocks with new IDs but preserve types and content
        const newBlocks = clipboardData.blocks.map(block => ({
          ...block,
          id: block.type === 'scene-heading' ? `scene-${uuidv4()}` : `block-${uuidv4()}`
        }));
        
        // Insert the new blocks after the current active block
        const updatedBlocks = [
          ...state.blocks.slice(0, currentIndex + 1),
          ...newBlocks,
          ...state.blocks.slice(currentIndex + 1)
        ];
        
        updateBlocks(updatedBlocks);
        if (setHasChanges) {
          setHasChanges(true);
        }
        
        // Focus the first pasted block
        if (newBlocks.length > 0) {
          setTimeout(() => {
            setFocusWithRetry(newBlocks[0].id, 'start');
          }, 0);
        }
      } else {
        // Fall back to text-based paste
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          addToHistory(state.blocks);
          
          const currentIndex = state.blocks.findIndex(b => b.id === state.activeBlock);
          if (currentIndex === -1) return;
          
          // Split text into lines and create blocks
          const lines = text.split('\n').filter(line => line.trim());
          const newBlocks: Block[] = lines.map(line => {
            const detectedType = detectFormat(line) || 'action';
            return {
              id: detectedType === 'scene-heading' ? `scene-${uuidv4()}` : `block-${uuidv4()}`,
              type: detectedType,
              content: line.trim()
            };
          });
          
          // Insert the new blocks after the current active block
          const updatedBlocks = [
            ...state.blocks.slice(0, currentIndex + 1),
            ...newBlocks,
            ...state.blocks.slice(currentIndex + 1)
          ];
          
          updateBlocks(updatedBlocks);
          if (setHasChanges) {
            setHasChanges(true);
          }
          
          // Focus the first pasted block
          if (newBlocks.length > 0) {
            setTimeout(() => {
              setFocusWithRetry(newBlocks[0].id, 'start');
            }, 0);
          }
        }
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, [state.activeBlock, state.blocks, addToHistory, updateBlocks, setHasChanges, setFocusWithRetry]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, blockId: string) => {
    const el = e.target as HTMLDivElement;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'c') {
        // Handle copy for both multi-block selection and regular block selection
        if (state.selectedBlocks.size > 1) {
          e.preventDefault();
          handleCopySelectedBlocks();
        } else if (multiBlockSelection.current.startBlock && 
            multiBlockSelection.current.endBlock && 
            multiBlockSelection.current.startBlock !== multiBlockSelection.current.endBlock &&
            multiBlockSelection.current.selectedText) {
          e.preventDefault();
          handleCopyMultiBlockSelection();
        }
        return;
      }
      
      if (e.key === 'x') {
        // Handle cut for both multi-block selection and regular block selection
        if (state.selectedBlocks.size > 1) {
          e.preventDefault();
          handleCutSelectedBlocks();
        } else if (multiBlockSelection.current.startBlock && 
            multiBlockSelection.current.endBlock && 
            multiBlockSelection.current.startBlock !== multiBlockSelection.current.endBlock &&
            multiBlockSelection.current.selectedText) {
          e.preventDefault();
          handleCutMultiBlockSelection();
        }
        return;
      }
      
      if (e.key === 'v') {
        // Handle paste
        e.preventDefault();
        handlePasteBlocks();
        return;
      }
    }

    // Handle Shift+ArrowUp and Shift+ArrowDown for multi-selection
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();

      const currentIndex = state.blocks.findIndex(b => b.id === blockId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowUp') {
        // Shift+ArrowUp: Extend selection upward
        if (currentIndex > 0) {
          const previousBlock = state.blocks[currentIndex - 1];
          const newSelectedBlocks = new Set(state.selectedBlocks);
          
          // If this is the first selection with shift, add the current block too
          if (newSelectedBlocks.size === 0) {
            newSelectedBlocks.add(blockId);
          }
          
          // Add the previous block to selection
          newSelectedBlocks.add(previousBlock.id);
          
          // Update selected blocks
          setSelectedBlocks(newSelectedBlocks);
          
          // Move focus to the previous block
          setFocusWithRetry(previousBlock.id, 'start');
        }
      } else if (e.key === 'ArrowDown') {
        // Shift+ArrowDown: Extend selection downward
        if (currentIndex < state.blocks.length - 1) {
          const nextBlock = state.blocks[currentIndex + 1];
          const newSelectedBlocks = new Set(state.selectedBlocks);
          
          // If this is the first selection with shift, add the current block too
          if (newSelectedBlocks.size === 0) {
            newSelectedBlocks.add(blockId);
          }
          
          // Add the next block to selection
          newSelectedBlocks.add(nextBlock.id);
          
          // Update selected blocks
          setSelectedBlocks(newSelectedBlocks);
          
          // Move focus to the next block
          setFocusWithRetry(nextBlock.id, 'start');
        }
      }
      return;
    }
    
    // Handle regular ArrowUp and ArrowDown without Shift
    if (!e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // Only handle if we're at the beginning or end of the content
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const content = el.textContent || '';
      
      // For ArrowUp, check if we're at the beginning of the content
      if (e.key === 'ArrowUp' && range.startOffset === 0) {
        const currentIndex = state.blocks.findIndex(b => b.id === blockId);
        if (currentIndex > 0) {
          e.preventDefault();
          
          // Clear selection unless Ctrl/Cmd is pressed
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedBlocks(new Set());
          }
          
          // Move to previous block
          const prevBlock = state.blocks[currentIndex - 1];
          setFocusWithRetry(prevBlock.id, 'end');
        }
      }
      
      // For ArrowDown, check if we're at the end of the content
      if (e.key === 'ArrowDown' && range.endOffset === content.length) {
        const currentIndex = state.blocks.findIndex(b => b.id === blockId);
        if (currentIndex < state.blocks.length - 1) {
          e.preventDefault();
          
          // Clear selection unless Ctrl/Cmd is pressed
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedBlocks(new Set());
          }
          
          // Move to next block
          const nextBlock = state.blocks[currentIndex + 1];
          setFocusWithRetry(nextBlock.id, 'start');
        }
      }
    }

    if (setHasChanges) {
      setHasChanges(true);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterKey(blockId, el);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const currentBlock = state.blocks.find((b) => b.id === blockId);
      if (!currentBlock) return;

      const currentIndex = BLOCK_TYPES.indexOf(currentBlock.type as any);
      const nextType = BLOCK_TYPES[(currentIndex + 1) % BLOCK_TYPES.length];

      handleFormatChange(nextType);
    }

    if (e.key === 'Backspace' && el.textContent === '') {
      e.preventDefault();
      e.stopPropagation();

      if (state.blocks.length <= 1) {
        return;
      }

      const currentIndex = state.blocks.findIndex((b) => b.id === blockId);
      if (currentIndex > 0) {
        addToHistory(state.blocks);
        
        const previousBlock = state.blocks[currentIndex - 1];
        const updatedBlocks = state.blocks.filter((b) => b.id !== blockId);
        updateBlocks(updatedBlocks);

        setTimeout(() => {
          setFocusWithRetry(previousBlock.id, 'end');
        }, 0);
      }
    }
  }, [state.blocks, state.selectedBlocks, handleEnterKey, handleFormatChange, addToHistory, updateBlocks, setHasChanges, setFocusWithRetry, setSelectedBlocks, handleCopySelectedBlocks, handleCutSelectedBlocks, handlePasteBlocks, handleCopyMultiBlockSelection, handleCutMultiBlockSelection]);

  // Helper function to get block element by ID
  const getBlockElement = useCallback((blockId: string): HTMLElement | null => {
    return blockRefs.current[blockId] || document.querySelector(`[data-block-id="${blockId}"]`);
  }, [blockRefs]);

  // Get all blocks between two block IDs
  const getBlocksBetween = useCallback((startBlockId: string, endBlockId: string): string[] => {
    const startIndex = state.blocks.findIndex(b => b.id === startBlockId);
    const endIndex = state.blocks.findIndex(b => b.id === endBlockId);
    
    if (startIndex === -1 || endIndex === -1) return [];
    
    const [minIndex, maxIndex] = startIndex <= endIndex 
      ? [startIndex, endIndex] 
      : [endIndex, startIndex];
    
    return state.blocks
      .slice(minIndex, maxIndex + 1)
      .map(block => block.id);
  }, [state.blocks]);

  // Function to serialize selected blocks for clipboard
  const serializeBlocks = useCallback((blockIds: string[]): string => {
    const selectedBlocks = state.blocks.filter(block => blockIds.includes(block.id));
    
    // Simple serialization - just join the content with newlines
    // In a real implementation, you might want to use JSON or a custom format
    // that preserves block types and other metadata
    return selectedBlocks.map(block => block.content).join('\n\n');
  }, [state.blocks]);

  // Handle mouse down to start drag selection
  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left mouse button

    const target = e.target as HTMLElement;
    const isContentEditable = target.hasAttribute('contenteditable') || target.closest('[contenteditable="true"]');
    
    lastMousePosition.current = { x: e.clientX, y: e.clientY };

    // Check if suggestions are currently showing for this block
    const suggestionElements = document.querySelectorAll('.scene-heading-suggestions-improved, .transition-suggestions, .shot-type-suggestions, .character-suggestions, .element-suggestions');
    const hasSuggestionsOpen = suggestionElements.length > 0;

    // If clicking on contentEditable and not holding Ctrl/Cmd, allow normal text selection
    if (isContentEditable && !e.ctrlKey && !e.metaKey && !hasSuggestionsOpen) {
      // Check if this is a click in empty space around the text (for block selection)
      const rect = target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // If clicking in the padding area (not on text), treat as block selection
      const textContent = target.textContent || '';
      const hasText = textContent.trim().length > 0;
      
      // For empty blocks or clicks in padding, allow block selection
      if (!hasText || clickX < 10 || clickX > rect.width - 10) {
        // This is a block selection, not text selection
        e.preventDefault();
      } else {
        // This is text selection within the block
        isTextSelection.current = true;
        selectionStartBlock.current = id;
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          selectionStartOffset.current = range.startOffset;
          
          multiBlockSelection.current = {
            startBlock: id,
            startOffset: range.startOffset,
            endBlock: id,
            endOffset: range.startOffset,
            selectedText: '',
            selectedBlocks: []
          };
        }
        return;
      }
    }

    // Start drag selection
    e.preventDefault();
    isDragSelecting.current = true;
    dragStartBlock.current = id;
    dragStartPosition.current = { x: e.clientX, y: e.clientY };
    dragCurrentPosition.current = { x: e.clientX, y: e.clientY };
    
    // Clear existing selection unless Shift is pressed
    if (!e.shiftKey) {
      setSelectedBlocks(new Set([id]));
    } else {
      // Add to existing selection if Shift is pressed
      setSelectedBlocks(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    }
    
    // Create selection overlay element
    const overlay = document.createElement('div');
    overlay.id = 'drag-selection-overlay';
    overlay.style.position = 'fixed';
    overlay.style.border = '1px solid #E86F2C';
    overlay.style.backgroundColor = 'rgba(232, 111, 44, 0.1)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1000';
    document.body.appendChild(overlay);
    
    // Add mousemove and mouseup event listeners to document
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragSelecting.current) return;
      
      dragCurrentPosition.current = { x: e.clientX, y: e.clientY };
      
      // Update selection overlay
      const overlay = document.getElementById('drag-selection-overlay');
      if (overlay) {
        const left = Math.min(dragStartPosition.current.x, dragCurrentPosition.current.x);
        const top = Math.min(dragStartPosition.current.y, dragCurrentPosition.current.y);
        const width = Math.abs(dragCurrentPosition.current.x - dragStartPosition.current.x);
        const height = Math.abs(dragCurrentPosition.current.y - dragStartPosition.current.y);
        
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
      }
      
      // Find blocks that intersect with the selection rectangle
      const selectionRect = {
        left: Math.min(dragStartPosition.current.x, dragCurrentPosition.current.x),
        top: Math.min(dragStartPosition.current.y, dragCurrentPosition.current.y),
        right: Math.max(dragStartPosition.current.x, dragCurrentPosition.current.x),
        bottom: Math.max(dragStartPosition.current.y, dragCurrentPosition.current.y)
      };
      
      // Get all block elements
      const blockElements = document.querySelectorAll('[data-block-id]');
      const selectedIds = new Set<string>();
      
      // Check each block for intersection with selection rectangle
      blockElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        
        // Check if the block intersects with the selection rectangle
        if (rect.left < selectionRect.right && 
            rect.right > selectionRect.left && 
            rect.top < selectionRect.bottom && 
            rect.bottom > selectionRect.top) {
          
          const blockId = element.getAttribute('data-block-id');
          if (blockId) {
            selectedIds.add(blockId);
          }
        }
      });
      
      // Update selected blocks
      if (selectedIds.size > 0) {
        setSelectedBlocks(selectedIds);
        dragSelectionBlocks.current = selectedIds;
      }
    };
    
    const handleMouseUp = () => {
      isDragSelecting.current = false;
      
      // Remove selection overlay
      const overlay = document.getElementById('drag-selection-overlay');
      if (overlay) {
        document.body.removeChild(overlay);
      }
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // If we have selected blocks, prepare for copy/cut operations
      if (dragSelectionBlocks.current.size > 0) {
        const blockIds = Array.from(dragSelectionBlocks.current);
        if (blockIds.length > 1) {
          // Find the first and last block in the selection
          const firstBlockId = blockIds[0];
          const lastBlockId = blockIds[blockIds.length - 1];
          
          // Set up multi-block selection for copy/cut operations
          multiBlockSelection.current = {
            startBlock: firstBlockId,
            startOffset: 0,
            endBlock: lastBlockId,
            endOffset: state.blocks.find(b => b.id === lastBlockId)?.content.length || 0,
            selectedText: serializeBlocks(blockIds),
            selectedBlocks: state.blocks.filter(b => blockIds.includes(b.id))
          };
        }
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [state.blocks, setSelectedBlocks, serializeBlocks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (multiBlockSelection.current.startBlock && 
            multiBlockSelection.current.endBlock && 
            multiBlockSelection.current.startBlock !== multiBlockSelection.current.endBlock &&
            multiBlockSelection.current.selectedText) {
            
          if (e.key === 'c') {
            handleCopyMultiBlockSelection();
          }
          
          if (e.key === 'x') {
            handleCutMultiBlockSelection();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCopyMultiBlockSelection, handleCutMultiBlockSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || 
          e.key === 'Shift' || e.key === 'Tab' || 
          e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
          e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        return;
      }

      if (state.selectedBlocks.size > 0) {
        setSelectedBlocks(new Set());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedBlocks, setSelectedBlocks]);

  // Add click-outside-to-deselect functionality
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Check if the click is outside the screenplay editor area
      const target = e.target as HTMLElement;
      
      // Don't deselect if clicking on:
      // 1. A block element or its children
      // 2. The screenplay content area
      // 3. Format buttons or other UI elements
      // 4. Suggestion dropdowns
      const isBlockClick = target.closest('[data-block-id]');
      const isScreenplayContent = target.closest('[data-screenplay-content="true"]');
      const isScreenplayEditor = target.closest('[data-screenplay-editor="true"]');
      const isFormatButton = target.closest('.format-buttons');
      const isSuggestionDropdown = target.closest('.scene-heading-suggestions-improved, .transition-suggestions, .shot-type-suggestions, .character-suggestions, .element-suggestions');
      
      // If clicking outside all screenplay-related elements, deselect
      if (!isBlockClick && !isScreenplayContent && !isScreenplayEditor && !isFormatButton && !isSuggestionDropdown) {
        if (state.selectedBlocks.size > 0) {
          setSelectedBlocks(new Set());
          
          // Also clear multi-block selection
          multiBlockSelection.current = {
            startBlock: null,
            startOffset: 0,
            endBlock: null,
            endOffset: 0,
            selectedText: '',
            selectedBlocks: []
          };
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [state.selectedBlocks, setSelectedBlocks]);

  const handleBlockClick = useCallback((id: string, e: React.MouseEvent) => {
    if (isTextSelection.current) return;

    if (!isDragging.current) {
      lastClickedBlock.current = id;
    }
  }, []);

  const handleBlockDoubleClick = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedBlock.current) {
      const startIdx = state.blocks.findIndex(b => b.id === lastClickedBlock.current);
      const endIdx = state.blocks.findIndex(b => b.id === id);
      const [start, end] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      
      const newSelection = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSelection.add(state.blocks[i].id);
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
  }, [state.blocks, setSelectedBlocks]);

  // Add a clear selection function that can be called externally
  const clearSelection = useCallback(() => {
    setSelectedBlocks(new Set());
    
    // Clear multi-block selection
    multiBlockSelection.current = {
      startBlock: null,
      startOffset: 0,
      endBlock: null,
      endOffset: 0,
      selectedText: '',
      selectedBlocks: []
    };
  }, [setSelectedBlocks]);

  // Function to check if a character block was created after dialogue
  const isCharacterBlockAfterDialogue = useCallback((blockId: string): boolean => {
    return characterBlockAfterDialogue.current.has(blockId);
  }, []);

  return {
    handleContentChange,
    handleEnterKey,
    handleKeyDown,
    handleBlockClick,
    handleBlockDoubleClick,
    handleFormatChange,
    handleMouseDown,
    clearSelection,
    isCharacterBlockAfterDialogue,
  };
};
