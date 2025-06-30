import { useCallback } from 'react';
import { Block, BlockHandlers } from '../types';
import { useBlockFocusManagement } from './useBlockFocusManagement';
import { useBlockTypeUtilities } from './useBlockTypeUtilities';
import { useBlockSelection } from './useBlockSelection';
import { useEnterKeyLogic } from './useEnterKeyLogic';
import { useBackspaceKeyLogic } from './useBackspaceKeyLogic';
import { useTabKeyLogic } from './useTabKeyLogic';
import { useBlockFormatting } from './useBlockFormatting';
import { useBlockContentSync } from './useBlockContentSync';
import { useBlockKeyboardInput } from './useBlockKeyboardInput';
import { v4 as uuidv4 } from 'uuid';

interface UseBlockHandlersImprovedProps {
  blocks: Block[];
  activeBlock: string | null;
  textContent: Record<string, string>;
  selectedBlocks: Set<string>;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  addToHistory: (blocks: Block[]) => void;
  updateBlocks: (blocks: Block[]) => void;
  setSelectedBlocks: (blocks: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setHasChanges?: (hasChanges: boolean) => void;
  projectId?: string;
  screenplayId?: string;
  onSceneHeadingUpdate?: () => Promise<void>;
}

export const useBlockHandlersImproved = (
  {
    blocks,
    activeBlock,
    textContent,
    selectedBlocks,
    blockRefs,
    addToHistory,
    updateBlocks,
    setSelectedBlocks,
    setHasChanges,
    projectId,
    screenplayId,
    onSceneHeadingUpdate
  }: UseBlockHandlersImprovedProps
): BlockHandlers => {
  // Initialize focus management
  const { setFocusWithRetry } = useBlockFocusManagement({ blockRefs });

  // Initialize block type utilities
  const { isCharacterBlockAfterDialogue } = useBlockTypeUtilities({ blocks });

  // Initialize block selection
  const { 
    clearSelection,
    handleBlockClick,
    handleBlockDoubleClick,
    handleMouseDown
  } = useBlockSelection({ 
    blocks, 
    selectedBlocks, 
    setSelectedBlocks 
  });

  // Create action block after scene heading
  const createActionBlockAfterSceneHeading = useCallback(() => {
    if (!activeBlock) return;
    
    const currentIndex = blocks.findIndex((b) => b.id === activeBlock);
    if (currentIndex === -1) return;

    const actionBlockId = `action-${uuidv4()}`;
    const actionBlock = {
      id: actionBlockId,
      type: 'action',
      content: '',
    };

    const updatedBlocks = [...blocks];
    updatedBlocks.splice(currentIndex + 1, 0, actionBlock);
    
    updateBlocks(updatedBlocks);
    setHasChanges?.(true);

    // Return the ID so it can be focused later
    return actionBlockId;
  }, [activeBlock, blocks, updateBlocks, setHasChanges]);

  // Initialize block formatting
  const { handleFormatChange } = useBlockFormatting({
    blocks,
    activeBlock,
    updateBlocks,
    addToHistory,
    setHasChanges,
    blockRefs
  });

  // Initialize Enter key logic
  const { handleEnterKey } = useEnterKeyLogic({
    blocks,
    updateBlocks,
    addToHistory,
    setHasChanges,
    blockRefs,
    setFocusWithRetry,
    createActionBlockAfterSceneHeading
  });

  // Initialize Backspace key logic
  const { handleBackspaceInEmptyBlock } = useBackspaceKeyLogic({
    blocks,
    updateBlocks,
    addToHistory,
    setHasChanges,
    blockRefs
  });

  // Initialize Tab key logic
  const { handleTabKey } = useTabKeyLogic({
    blocks,
    activeBlock,
    handleFormatChange
  });

  // Initialize content sync
  const { handleContentChange } = useBlockContentSync({
    blocks,
    updateBlocks,
    addToHistory,
    setHasChanges,
    blockRefs,
    projectId,
    screenplayId,
    onSceneHeadingUpdate
  });

  // Initialize keyboard input handling
  const { handleKeyDown } = useBlockKeyboardInput({
    blocks,
    activeBlock,
    handleEnterKey,
    handleTabKey,
    handleBackspaceInEmptyBlock,
    setHasChanges,
    selectedBlocks,
    setSelectedBlocks
  });

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
    createActionBlockAfterSceneHeading
  };
};