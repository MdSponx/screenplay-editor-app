import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';

interface CommentInputPopupProps {
  position: { top: number; left: number };
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

const CommentInputPopup: React.FC<CommentInputPopupProps> = ({
  position,
  onSubmit,
  onCancel
}) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onSubmit(commentText.trim());
    }
  };

  // Calculate position to ensure the popup stays within viewport
  const calculatePosition = () => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Default position from props
    let { top, left } = position;
    
    // Estimate popup dimensions (can be adjusted based on actual design)
    const popupHeight = 180; // Estimated height
    const popupWidth = 300; // Estimated width
    
    // Ensure popup doesn't go off the bottom of the screen
    if (top + popupHeight > viewportHeight) {
      top = Math.max(10, viewportHeight - popupHeight - 10);
    }
    
    // Ensure popup doesn't go off the right of the screen
    if (left + popupWidth > viewportWidth) {
      left = Math.max(10, viewportWidth - popupWidth - 10);
    }
    
    // Ensure popup doesn't go off the left of the screen
    if (left < 10) {
      left = 10;
    }
    
    return { top, left };
  };
  
  const { top, left } = calculatePosition();

  return (
    <div 
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[300px]"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-[#1E4D3A] dark:text-white">Add Comment</h3>
        <button 
          onClick={onCancel}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          <X size={16} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-3">
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Type your comment here..."
          className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 text-[#1E4D3A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E86F2C] focus:border-transparent resize-none"
          rows={4}
          autoFocus
        />
        
        <div className="flex justify-end mt-3 space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-[#E86F2C] text-white flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} className="mr-1" />
            Comment
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentInputPopup;