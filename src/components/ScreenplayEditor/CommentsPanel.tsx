// src/components/ScreenplayEditor/CommentsPanel.tsx
import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { Comment } from '../../types';
import CommentCard from './CommentCard';
import { MessageSquare, Filter, X, Plus } from 'lucide-react';

interface CommentsPanelProps {
  comments: Comment[];
  activeBlock: string | null;
  activeCommentId: string | null;
  onResolveComment: (commentId: string, isResolved: boolean) => void;
  onCommentSelect: (comment: Comment) => void;
  commentCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  blockPositions: Record<string, number>;
  editorScrollHeight: number;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
}

const CommentsPanel = forwardRef<HTMLDivElement, CommentsPanelProps>(({ 
  comments, 
  activeBlock,
  activeCommentId,
  onResolveComment,
  onCommentSelect,
  commentCardRefs,
  blockPositions,
  editorScrollHeight,
  onScroll
}, ref) => {
  const [showResolved, setShowResolved] = useState(false);
  const [filterByActiveBlock, setFilterByActiveBlock] = useState(false);
  
  // Log comments prop when component renders or when comments change
  useEffect(() => {
    console.log('CommentsPanel received comments:', comments);
    console.log('CommentsPanel comments count:', comments.length);
  }, [comments]);
  
  // Filter comments based on resolved status and optionally activeBlock
  const filteredComments = comments.filter(comment => {
    const matchesResolved = showResolved || !comment.isResolved;
    const matchesBlock = !filterByActiveBlock || (activeBlock && comment.blockId === activeBlock);
    return matchesResolved && matchesBlock;
  });
  
  // Sort comments by their block positions to prepare for overlap prevention
  const sortedComments = [...filteredComments].sort((a, b) => {
    const posA = blockPositions[a.blockId] || 0;
    const posB = blockPositions[b.blockId] || 0;
    return posA - posB;
  });
  
  // Apply vertical offset to fix positioning
  const cardVerticalOffset = -20; // Adjust this value to fine-tune card positioning
  
  // Prevent overlapping cards by adjusting positions
  const positionedComments = (() => {
    let lastCardBottom = 0;
    const baseCardHeight = 140; // Base height of a comment card
    const expandedCardHeight = 220; // Height when reply input is expanded
    const cardMargin = 16; // Increased margin between cards for better spacing
    
    return sortedComments.map(comment => {
      const blockPosition = blockPositions[comment.blockId];
      
      if (blockPosition === undefined) {
        return { comment, position: null };
      }
      
      // Apply the vertical offset to align with the block
      let position = blockPosition + cardVerticalOffset;
      
      // Prevent overlapping by ensuring this card starts after the previous one ends
      if (position < lastCardBottom) {
        position = lastCardBottom + cardMargin;
      }
      
      // Determine card height based on whether it's active (potentially expanded)
      const cardHeight = comment.id === activeCommentId ? expandedCardHeight : baseCardHeight;
      
      // Update the bottom position for the next card
      lastCardBottom = position + cardHeight;
      
      return { comment, position };
    });
  })();
  
  console.log('CommentsPanel filtered comments count:', filteredComments.length);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header - Now properly pinned like scene navigator */}
      <div className="p-4 border-b border-[#577B92]/10 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center">
          <MessageSquare size={18} className="text-[#E86F2C] mr-2" />
          <h3 className="text-lg font-medium text-[#1E4D3A] dark:text-white">Comments</h3>
          <span className="ml-2 px-2 py-0.5 bg-[#E86F2C]/10 text-[#E86F2C] rounded-full text-xs">
            {filteredComments.length}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterByActiveBlock(!filterByActiveBlock)}
            className={`p-1.5 rounded-lg transition-colors ${
              filterByActiveBlock
                ? 'bg-[#E86F2C]/10 text-[#E86F2C]'
                : 'text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={filterByActiveBlock ? 'Show all comments' : 'Show comments for active block only'}
          >
            <X size={16} />
          </button>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`p-1.5 rounded-lg transition-colors ${
              showResolved
                ? 'bg-[#E86F2C]/10 text-[#E86F2C]'
                : 'text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={showResolved ? 'Hide resolved comments' : 'Show resolved comments'}
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Comments List - Scrollable with spatial awareness */}
      <div 
        ref={ref} 
        onScroll={onScroll}
        className="flex-1 overflow-y-auto relative"
      >
        {/* Canvas for absolute positioning of comments */}
        <div 
          className="relative w-full" 
          style={{ height: `${editorScrollHeight}px` }}
        >
          {positionedComments.length > 0 ? (
            positionedComments.map(({ comment, position }) => {
              // Only render if we have a valid position
              if (position !== null) {
                return (
                  <div 
                    key={comment.id} 
                    ref={(el) => {
                      if (commentCardRefs) {
                        commentCardRefs.current[comment.id] = el;
                      }
                    }}
                    onClick={() => onCommentSelect(comment)}
                    className="cursor-pointer absolute left-0 right-0 px-4"
                    style={{ top: `${position}px` }}
                  >
                    <CommentCard
                      comment={comment}
                      onResolve={onResolveComment}
                      isActive={comment.id === activeCommentId}
                    />
                  </div>
                );
              }
              return null; // Don't render if no position found
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-[#E86F2C]/10 dark:bg-[#E86F2C]/20 flex items-center justify-center mb-3">
                <MessageSquare size={24} className="text-[#E86F2C]" />
              </div>
              <h4 className="text-[#1E4D3A] dark:text-white font-medium mb-1">No comments yet</h4>
              <p className="text-[#577B92] dark:text-gray-400 text-sm max-w-xs">
                {comments.length === 0 
                  ? "Select text in a block and click the comment button to add a comment."
                  : showResolved 
                    ? "No comments match your filters."
                    : "No unresolved comments. Click the filter button to show resolved comments."}
              </p>
              <button className="mt-4 px-4 py-2 bg-[#E86F2C]/10 text-[#E86F2C] rounded-lg flex items-center hover:bg-[#E86F2C]/20 transition-colors">
                <Plus size={16} className="mr-1" />
                Add Comment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Comment Button (Fixed at bottom) */}
      {filteredComments.length > 0 && (
        <div className="p-4 border-t border-[#577B92]/10 dark:border-gray-700 flex-shrink-0">
          <button className="w-full py-2 bg-[#E86F2C]/10 text-[#E86F2C] rounded-lg flex items-center justify-center hover:bg-[#E86F2C]/20 transition-colors">
            <Plus size={16} className="mr-1" />
            Add Comment
          </button>
        </div>
      )}
    </div>
  );
});

CommentsPanel.displayName = 'CommentsPanel';

export default CommentsPanel;