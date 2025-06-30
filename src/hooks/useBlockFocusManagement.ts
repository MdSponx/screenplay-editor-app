import { useCallback, useRef } from 'react';

interface UseBlockFocusManagementProps {
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export const useBlockFocusManagement = ({ blockRefs }: UseBlockFocusManagementProps) => {
  const focusAttempts = useRef<Record<string, number>>({});

  /**
   * Sets focus to a block with retry mechanism and cursor positioning
   */
  const setFocusWithRetry = useCallback((
    blockId: string, 
    cursorPosition: 'start' | 'end' | number = 'start', 
    maxRetries = 3
  ) => {
    // Reset retry count for this block
    focusAttempts.current[blockId] = 0;
    
    const attemptFocus = () => {
      const el = blockRefs.current[blockId];
      if (!el) {
        // If element not found and we haven't exceeded max retries
        if ((focusAttempts.current[blockId] || 0) < maxRetries) {
          // Increment retry count
          focusAttempts.current[blockId] = (focusAttempts.current[blockId] || 0) + 1;
          
          // Exponential backoff for retries
          const delay = 10 * Math.pow(2, focusAttempts.current[blockId]);
          setTimeout(attemptFocus, delay);
        }
        return;
      }

      // Element found, focus it
      el.focus();
      
      // Position cursor
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Ensure there's a text node to work with
        if (!el.firstChild) {
          const textNode = document.createTextNode('');
          el.appendChild(textNode);
        }
        
        const textNode = el.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const textLength = textNode.textContent?.length || 0;
          
          if (cursorPosition === 'start') {
            range.setStart(textNode, 0);
            range.setEnd(textNode, 0);
          } else if (cursorPosition === 'end') {
            range.setStart(textNode, textLength);
            range.setEnd(textNode, textLength);
          } else if (typeof cursorPosition === 'number') {
            const pos = Math.min(cursorPosition, textLength);
            range.setStart(textNode, pos);
            range.setEnd(textNode, pos);
          }
          
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch (err) {
        console.error('Error positioning cursor:', err);
      }
    };
    
    // Start the focus attempt process
    requestAnimationFrame(attemptFocus);
  }, [blockRefs]);

  return {
    setFocusWithRetry
  };
};