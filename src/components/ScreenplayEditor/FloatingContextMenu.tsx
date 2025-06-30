import React from 'react';
import { menuIcons, MenuAction } from './ContextMenuIcons';

interface FloatingContextMenuProps {
  position: { top: number; left: number };
  onMenuClick: (action: MenuAction) => void;
}

const FloatingContextMenu: React.FC<FloatingContextMenuProps> = ({ position, onMenuClick }) => {
  // Define menu items with their action types, labels, and disabled state
  const menuItems = [
    { action: 'bold' as MenuAction, label: 'Bold', disabled: true },
    { action: 'italic' as MenuAction, label: 'Italic', disabled: true },
    { action: 'underline' as MenuAction, label: 'Underline', disabled: true },
    { action: 'highlight' as MenuAction, label: 'Highlight', disabled: true },
    { action: 'textColor' as MenuAction, label: 'Text Color', disabled: true },
    { action: 'elements' as MenuAction, label: 'Add Element', disabled: true },
    { action: 'comments' as MenuAction, label: 'Add Comment', disabled: false }
  ];

  return (
    <div 
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex p-1"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
        transform: 'translateY(-100%)'
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.action}
          onClick={() => !item.disabled && onMenuClick(item.action)}
          className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mx-0.5 group relative ${
            item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          disabled={item.disabled}
          title={item.label}
        >
          <div className={item.disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
            {menuIcons[item.action]}
          </div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            {item.label}
            {item.disabled && " (Coming Soon)"}
          </div>
        </button>
      ))}
    </div>
  );
};

export default FloatingContextMenu;