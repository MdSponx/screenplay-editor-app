import React, { useState } from 'react';
import { Plus, Search, User } from 'lucide-react';
import { Character, useCharacters } from '../../hooks/useCharacters';
import CharacterCard from './CharacterCard';
import CharacterForm from './CharacterForm';

interface CharacterManagerProps {
  projectId: string;
  screenplayId: string;
}

const CharacterManager: React.FC<CharacterManagerProps> = ({
  projectId,
  screenplayId, // We still keep this prop for future use, even though we're not using it for data fetching
}) => {
  const { characters, loading, error, addCharacter, updateCharacter, deleteCharacter } = useCharacters(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const handleAddCharacter = async (character: Omit<Character, 'id'>) => {
    await addCharacter(character);
    setShowAddForm(false);
  };

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setShowAddForm(true);
  };

  const handleUpdateCharacter = async (updatedCharacter: Omit<Character, 'id'>) => {
    if (editingCharacter) {
      await updateCharacter(editingCharacter.id, updatedCharacter);
      setEditingCharacter(null);
      setShowAddForm(false);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (confirm('Are you sure you want to delete this character?')) {
      await deleteCharacter(characterId);
    }
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingCharacter(null);
  };

  const filteredCharacters = characters.filter(character => 
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (character.fullName && character.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
            />
          </div>
          <button
            onClick={() => {
              setEditingCharacter(null);
              setShowAddForm(true);
            }}
            className="ml-2 p-2 bg-[#E86F2C] text-white rounded-lg hover:bg-[#E86F2C]/90 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {showAddForm && (
          <CharacterForm
            character={editingCharacter || undefined}
            onSubmit={editingCharacter ? handleUpdateCharacter : handleAddCharacter}
            onCancel={handleCancelForm}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredCharacters.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No characters match your search' : 'No characters yet. Add your first character!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCharacters.map(character => (
              <CharacterCard
                key={character.id}
                character={character}
                onEdit={handleEditCharacter}
                onDelete={handleDeleteCharacter}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterManager;