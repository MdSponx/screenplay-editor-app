import React from 'react';
import { 
  Type, 
  Italic, 
  Underline, 
  Highlighter, 
  Palette, 
  ListPlus, 
  MessageSquarePlus,
  Bold
} from 'lucide-react';

export const menuIcons = {
  bold: <Bold size={16} />,
  italic: <Italic size={16} />,
  underline: <Underline size={16} />,
  highlight: <Highlighter size={16} />,
  textColor: <Palette size={16} />,
  elements: <ListPlus size={16} />,
  comments: <MessageSquarePlus size={16} />
};

export type MenuAction = 'bold' | 'italic' | 'underline' | 'highlight' | 'textColor' | 'elements' | 'comments';