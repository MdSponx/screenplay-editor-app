import { useCallback } from 'react';
import { Block } from '../types';
import { detectFormat, createSceneHeadingHash } from '../utils/blockUtils';
import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc, setDoc, updateDoc, collection, arrayUnion, serverTimestamp, writeBatch, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UseBlockContentSyncProps {
  blocks: Block[];
  updateBlocks: (blocks: Block[]) => void;
  addToHistory: (blocks: Block[]) => void;
  setHasChanges?: (hasChanges: boolean) => void;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  projectId?: string;
  screenplayId?: string;
  onSceneHeadingUpdate?: () => Promise<void>;
}

export const useBlockContentSync = ({
  blocks,
  updateBlocks,
  addToHistory,
  setHasChanges,
  blockRefs,
  projectId,
  screenplayId,
  onSceneHeadingUpdate
}: UseBlockContentSyncProps) => {
  /**
   * Helper function to check if text is a prefix-only entry
   */
  const isPrefixOnly = useCallback((text: string): boolean => {
    const trimmedText = text.trim().toUpperCase();
    const prefixPatterns = [
      'INT.',
      'EXT.',
      'INT./EXT.',
      'EXT./INT.',
      'I/E.'
    ];
    return prefixPatterns.includes(trimmedText);
  }, []);

  /**
   * Count scene headings currently in the editor
   */
  const countSceneHeadingsInEditor = useCallback(async (): Promise<Record<string, number>> => {
    if (!projectId || !screenplayId) {
      return {};
    }

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
  }, [projectId, screenplayId, isPrefixOnly]);

  /**
   * Handles content changes in blocks, including auto-formatting and Firestore sync
   */
  const handleContentChange = useCallback(async (id: string, newContent: string, forcedType?: string) => {
    const currentBlockIndex = blocks.findIndex(b => b.id === id);
    const currentBlock = blocks[currentBlockIndex];
    
    if (!currentBlock) return;

    if (newContent.trim() === '' && blocks.length > 1 && !forcedType) {
      addToHistory?.(blocks);
      const updatedBlocks = blocks.filter((_, index) => index !== currentBlockIndex);
      updateBlocks(updatedBlocks);
      if (setHasChanges) {
        setHasChanges(true);
      }
      return;
    }
    
    addToHistory?.(blocks);
    if (setHasChanges) {
      setHasChanges(true);
    }

    let updatedBlocks = [...blocks];
    let blockToFocusId: string | null = null;
    
    let effectiveType = forcedType;
    if (!effectiveType) {
        const detectedFormat = detectFormat(newContent);
        effectiveType = detectedFormat || currentBlock.type;
    }

    // Check if this is a type change from non-scene-heading to scene-heading
    const isNewSceneHeading = currentBlock.type !== 'scene-heading' && effectiveType === 'scene-heading';

    // Update the block with new content and type
    updatedBlocks[currentBlockIndex] = {
      ...updatedBlocks[currentBlockIndex],
      content: newContent,
      type: effectiveType,
    };

    // Special handling for scene-heading creation/update from content change
    if (effectiveType === 'scene-heading' && projectId && screenplayId) {
        const sceneHeadingText = newContent.trim().toUpperCase();
        
        // Only save to unique_scene_headings if it's not a prefix-only entry and not empty
        if (sceneHeadingText.length > 0 && !isPrefixOnly(sceneHeadingText)) {
            const sceneHeadingHash = createSceneHeadingHash(sceneHeadingText);
            const uniqueSceneHeadingRef = doc(db, `projects/${projectId}/unique_scene_headings`, sceneHeadingHash);

            try {
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
    }

    updateBlocks(updatedBlocks);
    
    if (blockToFocusId) {
      setTimeout(() => {
        const el = blockRefs.current[blockToFocusId!];
        if (el) {
          el.focus();
          const range = document.createRange();
          const textNode = el.firstChild || el;
          range.setStart(textNode, 0);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }, 0);
    }
  }, [blocks, addToHistory, updateBlocks, setHasChanges, blockRefs, projectId, screenplayId, onSceneHeadingUpdate, isPrefixOnly, countSceneHeadingsInEditor]);

  return {
    handleContentChange
  };
};