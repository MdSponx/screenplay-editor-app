import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Comment } from '../../types';

interface CommentTooltipProps {
  comments: Comment[];
  position: { x: number; y: number };
  isVisible: boolean;
  onClose: () => void;
}

const CommentTooltip: React.FC<CommentTooltipProps> = ({
  comments,
  position,
  isVisible,
  onClose
}) => {
  const [tooltipPosition, setTooltipPosition] = useState(position);
  const [isRendered, setIsRendered] = useState(false);

  // Calculate smart positioning to avoid viewport edges
  useEffect(() => {
    if (!isVisible) return;

    const calculatePosition = () => {
      const tooltipWidth = 300; // Approximate tooltip width
      const tooltipHeight = 80; // Approximate tooltip height
      const margin = 10; // Margin from viewport edges
      
      let { x, y } = position;
      
      // Adjust horizontal position
      if (x + tooltipWidth > window.innerWidth - margin) {
        x = window.innerWidth - tooltipWidth - margin;
      }
      if (x < margin) {
        x = margin;
      }
      
      // Adjust vertical position (show above the highlight)
      y = y - tooltipHeight - 10; // 10px gap above highlight
      if (y < margin) {
        y = position.y + 25; // Show below if not enough space above
      }
      
      setTooltipPosition({ x, y });
    };

    calculatePosition();
    
    // Add scroll listener to reposition on scroll
    const handleScroll = () => {
      if (isVisible) {
        calculatePosition();
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [position, isVisible]);

  // Handle visibility state with delay for smooth animations
  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
    } else {
      // Delay unmounting to allow fade-out animation
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Truncate text to maximum length
  const truncateText = (text: string, maxLength: number = 150): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  // Format comment content for display with bold author names
  const formatCommentContent = (): React.ReactNode => {
    if (comments.length === 0) return '';
    
    if (comments.length === 1) {
      const comment = comments[0];
      return (
        <>
          <strong>{comment.authorName}</strong>: {truncateText(comment.text)}
        </>
      );
    }
    
    // Multiple comments - show count and first comment with bold author
    const firstComment = comments[0];
    const truncatedText = truncateText(firstComment.text, 100); // Shorter for multiple
    return (
      <>
        {comments.length} comments - <strong>{firstComment.authorName}</strong>: {truncatedText}
      </>
    );
  };

  if (!isRendered) return null;

  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(
    <div
      className={`comment-tooltip ${isVisible ? 'visible' : ''}`}
      style={{
        position: 'fixed',
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
        zIndex: 1000,
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={onClose}
    >
      <div className="tooltip-content">
        <div className="tooltip-text">
          {formatCommentContent()}
        </div>
        {comments.length > 1 && (
          <div className="tooltip-meta">
            Click to view all {comments.length} comments
          </div>
        )}
      </div>
      {/* Tooltip arrow */}
      <div className="tooltip-arrow" />
    </div>,
    portalRoot
  );
};

export default CommentTooltip;
