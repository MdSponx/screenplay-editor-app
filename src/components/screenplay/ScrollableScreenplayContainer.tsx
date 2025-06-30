import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableScreenplayContainerProps {
  title: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const ScrollableScreenplayContainer: React.FC<ScrollableScreenplayContainerProps> = ({
  title,
  children,
  isDarkMode = false
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentSceneNumber, setCurrentSceneNumber] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate total pages based on content height
  useEffect(() => {
    if (!contentRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (contentRef.current && containerRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const containerHeight = containerRef.current.clientHeight - 64; // Subtract header height
        const calculatedPages = Math.ceil(contentHeight / containerHeight);
        setTotalPages(Math.max(1, calculatedPages));
      }
    });
    
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // Detect current scene based on scroll position
  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      
      // Calculate current page based on scroll position
      const scrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight - 64; // Subtract header height
      const currentPageCalc = Math.floor(scrollTop / containerHeight) + 1;
      setCurrentPage(currentPageCalc);
      
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
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    
    setCurrentPage(newPage);
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight - 64; // Subtract header height
      containerRef.current.scrollTop = (newPage - 1) * containerHeight;
    }
  };

  return (
    <div 
      className={`flex flex-col h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
    >
      {/* Fixed Header */}
      <div 
        className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } shadow-sm z-10`}
      >
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {currentSceneNumber !== null && (
            <div className={`px-3 py-1 rounded-full text-sm ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              Scene {currentSceneNumber}
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`p-1 rounded-full ${
                isDarkMode 
                  ? 'hover:bg-gray-700 disabled:text-gray-600' 
                  : 'hover:bg-gray-100 disabled:text-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <ChevronLeft size={20} />
            </button>
            
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className={`p-1 rounded-full ${
                isDarkMode 
                  ? 'hover:bg-gray-700 disabled:text-gray-600' 
                  : 'hover:bg-gray-100 disabled:text-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div ref={contentRef} className="screenplay-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ScrollableScreenplayContainer;