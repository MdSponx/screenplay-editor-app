import React, { useCallback, useRef } from 'react';
import BlockComponentImproved from '../BlockComponentImproved';
import PageHeader from './PageHeader';
import { CharacterDocument, ElementDocument, UniqueSceneHeadingDocument, Comment } from '../../types';

interface PageProps {
  pageIndex: number;
  blocks: Array<{
    id: string;
    type: string;
    content: string;
    number?: number;
  }>;
  isDarkMode: boolean;
  header: {
    title: string;
    author: string;
    contact: string;
  };
  editingHeader: boolean;
  onHeaderChange: (value: string) => void;
  onEditingHeaderChange: (editing: boolean) => void;
  onContentChange: (id: string, content: string, type?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, blockId: string) => void;
  onBlockFocus: (id: string) => void;
  onBlockClick: (id: string, e: React.MouseEvent) => void;
  onBlockMouseDown: (id: string, e: React.MouseEvent) => void;
  onBlockDoubleClick: (id: string, e: React.MouseEvent) => void;
  selectedBlocks: Set<string>;
  activeBlock: string | null;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  projectCharacters?: CharacterDocument[];
  projectElements?: ElementDocument[];
  projectId?: string;
  screenplayId?: string;
  projectUniqueSceneHeadings?: UniqueSceneHeadingDocument[];
  onEnterAction?: () => void;
  isProcessingSuggestion?: boolean;
  setIsProcessingSuggestion?: (processing: boolean) => void;
  onDeselectAll?: () => void;
  isCharacterBlockAfterDialogue?: (blockId: string) => boolean;
  isSceneSelectionActive?: boolean;
  addComment?: (comment: Comment) => Promise<boolean>;
  activeCommentId?: string | null;
  onCommentSelect?: (comment: Comment) => void;
  comments?: Comment[];
  showCommentsPanel?: boolean;
  setShowCommentsPanel?: (show: boolean) => void;
}

const Page: React.FC<PageProps> = ({
  pageIndex,
  blocks,
  isDarkMode,
  header,
  editingHeader,
  onHeaderChange,
  onEditingHeaderChange,
  onContentChange,
  onKeyDown,
  onBlockFocus,
  onBlockClick,
  onBlockMouseDown,
  onBlockDoubleClick,
  selectedBlocks,
  activeBlock,
  blockRefs,
  projectCharacters = [],
  projectElements = [],
  projectId,
  screenplayId,
  projectUniqueSceneHeadings = [],
  onEnterAction,
  isProcessingSuggestion,
  setIsProcessingSuggestion,
  onDeselectAll,
  isCharacterBlockAfterDialogue,
  isSceneSelectionActive = false,
  addComment,
  activeCommentId,
  onCommentSelect,
  comments,
  showCommentsPanel,
  setShowCommentsPanel,
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const isDragSelecting = useRef(false);
  const dragStartPosition = useRef({ x: 0, y: 0 });

  // Handle container-level mouse down for drag selection
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle if clicking on the container itself, not on blocks
    if (e.target === e.currentTarget) {
      e.preventDefault();
      isDragSelecting.current = true;
      dragStartPosition.current = { x: e.clientX, y: e.clientY };
      
      // Create selection overlay
      const overlay = document.createElement('div');
      overlay.id = 'drag-selection-overlay';
      overlay.style.position = 'fixed';
      overlay.style.border = '1px solid #E86F2C';
      overlay.style.backgroundColor = 'rgba(232, 111, 44, 0.1)';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '1000';
      document.body.appendChild(overlay);
      
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragSelecting.current) return;
        
        const overlay = document.getElementById('drag-selection-overlay');
        if (overlay) {
          const left = Math.min(dragStartPosition.current.x, e.clientX);
          const top = Math.min(dragStartPosition.current.y, e.clientY);
          const width = Math.abs(e.clientX - dragStartPosition.current.x);
          const height = Math.abs(e.clientY - dragStartPosition.current.y);
          
          overlay.style.left = `${left}px`;
          overlay.style.top = `${top}px`;
          overlay.style.width = `${width}px`;
          overlay.style.height = `${height}px`;
        }
      };
      
      const handleMouseUp = () => {
        isDragSelecting.current = false;
        
        const overlay = document.getElementById('drag-selection-overlay');
        if (overlay) {
          document.body.removeChild(overlay);
        }
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  }, []);

  // Handle double-click on empty space for deselection
  const handleContainerDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only handle if double-clicking on the container itself, not on blocks
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      
      // Call deselection callback
      onDeselectAll?.();
    }
  }, [onDeselectAll]);
  return (
    <div
      className={`relative w-[210mm] mx-auto shadow-lg transition-colors duration-200 mb-8 screenplay-page ${
        isDarkMode ? 'bg-primary-950 text-gray-100' : 'bg-white text-gray-900'
      }`}
      style={{
        minHeight: '297mm',
        pageBreakAfter: 'always',
      }}
      data-page-index={pageIndex}
    >
      <PageHeader
        isDarkMode={isDarkMode}
        header={header}
        pageNumber={pageIndex + 1}
        editingHeader={editingHeader}
        onHeaderChange={onHeaderChange}
        onEditingHeaderChange={onEditingHeaderChange}
      />

      <div
        ref={pageRef}
        className="px-[20mm] screenplay-content user-select-text"
        style={{
          minHeight: 'calc(297mm - 15mm)',
          paddingTop: '8mm',
          paddingBottom: '8mm',
        }}
        data-screenplay-content="true"
        onMouseDown={handleContainerMouseDown}
        onDoubleClick={handleContainerDoubleClick}
      >
        {blocks.map((block) => (
          <BlockComponentImproved
            key={block.id}
            block={block}
            isDarkMode={isDarkMode}
            onContentChange={onContentChange}
            onKeyDown={onKeyDown}
            onFocus={onBlockFocus}
            onClick={onBlockClick}
            onMouseDown={onBlockMouseDown}
            onDoubleClick={onBlockDoubleClick}
            isSelected={selectedBlocks instanceof Set ? selectedBlocks.has(block.id) : false}
            isActive={block.id === activeBlock}
            blockRefs={blockRefs}
            projectCharacters={projectCharacters}
            projectElements={projectElements}
            projectId={projectId}
            screenplayId={screenplayId}
            projectUniqueSceneHeadings={projectUniqueSceneHeadings}
            onEnterAction={onEnterAction}
            isProcessingSuggestion={isProcessingSuggestion}
            setIsProcessingSuggestion={setIsProcessingSuggestion}
            isCharacterBlockAfterDialogue={isCharacterBlockAfterDialogue}
            isSceneSelectionActive={isSceneSelectionActive}
            addComment={addComment}
            activeCommentId={activeCommentId}
            onCommentSelect={onCommentSelect}
            comments={comments}
            showCommentsPanel={showCommentsPanel}
            setShowCommentsPanel={setShowCommentsPanel}
          />
        ))}
      </div>
    </div>
  );
};

export default Page;
