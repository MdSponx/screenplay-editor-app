import React, { useState, useEffect, useRef } from 'react';
import { Block } from '../../types';
import { getBlockStyle, getBlockMargin } from '../../utils/styleUtils';
import ScrollableScreenplayContainer from './ScrollableScreenplayContainer';

interface ScrollableScreenplayWithEditorProps {
  blocks: Block[];
  title: string;
  isDarkMode: boolean;
  onContentChange: (id: string, content: string, type?: string) => void;
  onBlockFocus: (id: string) => void;
  activeBlock: string | null;
  blockRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

const ScrollableScreenplayWithEditor: React.FC<ScrollableScreenplayWithEditorProps> = ({
  blocks,
  title,
  isDarkMode,
  onContentChange,
  onBlockFocus,
  activeBlock,
  blockRefs
}) => {
  const [currentSceneNumber, setCurrentSceneNumber] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update scene numbers for scene heading blocks
  const blocksWithSceneNumbers = blocks.map((block, index) => {
    if (block.type === 'scene-heading') {
      const sceneNumber = blocks.slice(0, index)
        .filter(b => b.type === 'scene-heading')
        .length + 1;
      return { ...block, sceneNumber };
    }
    return block;
  });

  // Detect current scene based on scroll position
  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      
      // Find the current scene by checking which scene heading is visible
      const sceneHeadings = containerRef.current.querySelectorAll('[data-block-type="scene-heading"]');
      let currentScene: Element | null = null;
      
      sceneHeadings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        // If the scene heading is visible in the viewport
        if (rect.top >= 64 && rect.top <= containerRef.current!.clientHeight) {
          currentScene = heading;
        }
      });
      
      if (currentScene) {
        const sceneNumber = currentScene.getAttribute('data-scene-number');
        setCurrentSceneNumber(sceneNumber ? parseInt(sceneNumber) : null);
      }
    };

    containerRef.current.addEventListener('scroll', handleScroll);
    return () => {
      containerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [blocks]);

  return (
    <ScrollableScreenplayContainer
      title={title}
      isDarkMode={isDarkMode}
    >
      <div 
        ref={containerRef}
        className="max-w-4xl mx-auto p-8"
      >
        {blocksWithSceneNumbers.map((block) => (
          <div 
            key={block.id}
            className={`relative screenplay-block ${getBlockMargin(block.type)}`}
            data-block-id={block.id}
            data-block-type={block.type}
            data-scene-number={block.type === 'scene-heading' ? block.sceneNumber : undefined}
          >
            {block.type === 'scene-heading' && (
              <div
                className={`absolute inset-0 ${
                  isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100'
                } rounded`}
                style={{
                  transform: 'translateY(2px)',
                  height: '1.75rem',
                }}
              />
            )}
            <div
              ref={(el) => {
                if (blockRefs && blockRefs.current) {
                  blockRefs.current[block.id] = el;
                }
              }}
              contentEditable
              suppressContentEditableWarning
              className={`block-editor ${getBlockStyle({ type: block.type, isDarkMode, isSelected: false })} ${
                block.id === activeBlock ? (isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100') : ''
              }`}
              onFocus={() => onBlockFocus(block.id)}
              onBlur={(e) => onContentChange(block.id, e.currentTarget.textContent || '')}
              data-block-id={block.id}
              style={{
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text',
                userSelect: 'text',
              }}
            >
              {block.content}
            </div>
            {block.type === 'scene-heading' && block.sceneNumber && (
              <div
                className={`absolute -left-8 top-1/2 -translate-y-1/2 text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {block.sceneNumber}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollableScreenplayContainer>
  );
};

export default ScrollableScreenplayWithEditor;