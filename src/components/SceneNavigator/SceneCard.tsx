import React, { useState } from 'react';
import { Scene } from '../../hooks/useScenes';
import { Edit, Trash, User, MessageSquare, Camera, GripVertical } from 'lucide-react';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

interface SceneCardProps {
  scene: Scene;
  isActive: boolean;
  onSelect: (sceneId: string) => void;
  onEdit: (scene: Scene) => void;
  onDelete: (sceneId: string) => void;
  index: number;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  index,
  isDragging = false,
  dragHandleProps,
}) => {
  const [showDelete, setShowDelete] = useState(false);
  
  // Parse scene heading to extract type, setting, and time
  const parseSceneHeading = () => {
    // Use scene_heading field if available, otherwise fall back to title
    const sceneHeading = scene.scene_heading || scene.title || '';
    
    // First, try to extract time indicators which can appear in various positions
    const timeKeywords = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING', 'AFTERNOON', 'SUNSET', 'SUNRISE'];
    let time = '';
    
    // Check for time at the end after a dash (most common format)
    const dashTimeMatch = sceneHeading.match(/\s*-\s*([A-Za-zก-๙\s]+)$/);
    if (dashTimeMatch) {
      const possibleTime = dashTimeMatch[1].trim().toUpperCase();
      // Verify it's actually a time indicator
      if (timeKeywords.some(keyword => possibleTime.includes(keyword))) {
        time = dashTimeMatch[1].trim();
      }
    }
    
    // If no time found after dash, look for time keywords anywhere in the string
    if (!time) {
      for (const keyword of timeKeywords) {
        if (sceneHeading.toUpperCase().includes(keyword)) {
          // Found a time keyword - extract it with surrounding context
          const timeRegex = new RegExp(`\\b${keyword}\\b`, 'i');
          const match = sceneHeading.match(timeRegex);
          if (match) {
            time = keyword;
            break;
          }
        }
      }
    }
    
    // Now extract the scene type with priority for combined types
    let type = '';
    
    // Check for combined types first (more specific patterns first)
    const combinedTypePatterns = [
      /^(INT\.\/EXT\.)/i,
      /^(EXT\.\/INT\.)/i,
      /^(I\/E\.)/i,
      /^(E\/I\.)/i
    ];
    
    for (const pattern of combinedTypePatterns) {
      const match = sceneHeading.match(pattern);
      if (match) {
        type = match[0];
        break;
      }
    }
    
    // If no combined type found, check for standard types
    if (!type) {
      const standardTypeMatch = sceneHeading.match(/^(INT\.|EXT\.)/i);
      if (standardTypeMatch) {
        type = standardTypeMatch[0];
      }
    }
    
    // Special case for non-standard formats like "/EXT. บังกาโลตุ๊ดตู่"
    if (!type && sceneHeading.startsWith('/')) {
      const nonStandardMatch = sceneHeading.match(/^\/(INT\.|EXT\.)/i);
      if (nonStandardMatch) {
        type = '/' + nonStandardMatch[1];
      }
    }
    
    // Now extract the setting - everything between type and time
    let setting = sceneHeading;
    
    // Remove the type from the beginning
    if (type) {
      setting = setting.substring(type.length);
    }
    
    // Remove the time from the end if it was found after a dash
    if (time && dashTimeMatch) {
      setting = setting.replace(dashTimeMatch[0], '');
    }
    
    // Clean up the setting
    setting = setting.trim();
    
    // Remove any leading/trailing dashes or periods
    setting = setting.replace(/^[\s\-\.]+|[\s\-\.]+$/g, '');
    
    return { type, setting, time };
  };
  
  // Calculate scene statistics
  const calculateStats = () => {
    const shotBlocks = scene.blocks.filter(block => block.type === 'shot');
    const characterBlocks = scene.blocks.filter(block => block.type === 'character');
    const dialogueBlocks = scene.blocks.filter(block => block.type === 'dialogue');
    
    // Get unique characters
    const uniqueCharacters = new Set();
    characterBlocks.forEach(block => {
      if (block.content) uniqueCharacters.add(block.content.trim());
    });
    
    return {
      shotCount: shotBlocks.length,
      characterCount: uniqueCharacters.size,
      dialogueCount: dialogueBlocks.length
    };
  };
  
  const { type, setting, time } = parseSceneHeading();
  const stats = calculateStats();
  
  // Determine time of day color
  const getTimeColor = () => {
    const timeLower = time.toLowerCase();
    if (timeLower.includes('day')) return 'bg-yellow-500';
    if (timeLower.includes('night')) return 'bg-indigo-800';
    if (timeLower.includes('evening') || timeLower.includes('dusk') || timeLower.includes('sunset')) return 'bg-orange-500';
    if (timeLower.includes('morning') || timeLower.includes('dawn') || timeLower.includes('sunrise')) return 'bg-blue-400';
    return 'bg-gray-500';
  };
  
  // Determine INT/EXT color
  const getTypeColor = () => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('int') && typeLower.includes('ext')) return 'bg-purple-600';
    if (typeLower.includes('int')) return 'bg-green-600';
    if (typeLower.includes('ext')) return 'bg-blue-600';
    return 'bg-gray-600';
  };

  return (
    <div 
      className={`
        p-3 mb-2 rounded-lg cursor-pointer transition-all duration-200
        ${isActive ? 'bg-[#E86F2C]/20 border-l-4 border-[#E86F2C]' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}
        ${isDragging ? 'shadow-lg opacity-90 scale-[1.02]' : 'shadow-sm'}
      `}
      onClick={() => onSelect(scene.id)}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Row 1: Scene number, Drag Handle, Type badge, Time badge */}
      <div className="flex items-center mb-2">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <GripVertical size={16} />
        </div>
        <span className="text-lg font-bold text-gray-700 dark:text-gray-300 w-6">{index + 1}</span>
        
        <div className="flex items-center space-x-2">
          {type && (
            <span className={`px-2 py-0.5 text-xs font-medium text-white rounded-full ${getTypeColor()}`}>
              {type}
            </span>
          )}
          
          {time && (
            <span className={`px-2 py-0.5 text-xs font-medium text-white rounded-full ${getTimeColor()}`}>
              {time}.
            </span>
          )}
        </div>
      </div>
      
      {/* Row 2: Setting text (indented to align with badges) */}
      {setting && (
        <div className="pl-8 mb-2">
          <span className="font-bold text-[#1E4D3A] dark:text-white uppercase">
            {setting}
          </span>
        </div>
      )}
      
      {/* Row 3: Stats and Edit button */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-3 pl-8">
          <div className="flex items-center">
            <User size={12} className="mr-1" />
            <span>{stats.characterCount}</span>
          </div>
          <div className="flex items-center">
            <MessageSquare size={12} className="mr-1" />
            <span>{stats.dialogueCount}</span>
          </div>
          <div className="flex items-center">
            <Camera size={12} className="mr-1" />
            <span>{stats.shotCount}</span>
          </div>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit(scene);
          }}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Edit size={14} />
        </button>
      </div>
    </div>
  );
};

export default SceneCard;
