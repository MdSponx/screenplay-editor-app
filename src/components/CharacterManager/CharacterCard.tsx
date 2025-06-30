import React from 'react';
import { Character } from '../../hooks/useCharacters';
import { Edit, Trash, User } from 'lucide-react';

interface CharacterCardProps {
  character: Character;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onEdit,
  onDelete,
}) => {
  // Generate initials from character name
  const getInitials = () => {
    if (!character.name) return '?';
    return character.name.charAt(0).toUpperCase();
  };

  // Generate a consistent color based on character name
  const getColorClass = () => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    
    // Simple hash function to get a consistent color
    let hash = 0;
    for (let i = 0; i < character.name.length; i++) {
      hash = character.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full ${getColorClass()} flex items-center justify-center text-white font-medium`}>
            {getInitials()}
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-[#1E4D3A] dark:text-white">{character.name}</h3>
            {character.fullName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{character.fullName}</p>
            )}
          </div>
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={() => onEdit(character)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={() => onDelete(character.id)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
      
      {(character.age || character.description) && (
        <div className="mb-3">
          {character.age && (
            <div className="inline-block px-2 py-1 mr-2 mb-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              Age: {character.age}
            </div>
          )}
          {character.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {character.description}
            </p>
          )}
        </div>
      )}
      
      {character.notes && (
        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
          {character.notes}
        </div>
      )}
    </div>
  );
};

export default CharacterCard;