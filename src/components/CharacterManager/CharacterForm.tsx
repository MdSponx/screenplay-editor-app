import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Character } from '../../hooks/useCharacters';

interface CharacterFormProps {
  character?: Character;
  onSubmit: (character: Omit<Character, 'id'>) => void;
  onCancel: () => void;
}

const CharacterForm: React.FC<CharacterFormProps> = ({
  character,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Omit<Character, 'id'>>({
    name: '',
    fullName: '',
    description: '',
    age: '',
    notes: '',
  });

  useEffect(() => {
    if (character) {
      setFormData({
        name: character.name || '',
        fullName: character.fullName || '',
        description: character.description || '',
        age: character.age || '',
        notes: character.notes || '',
      });
    }
  }, [character]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-[#1E4D3A] dark:text-white">
          {character ? 'Edit Character' : 'Add Character'}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X size={18} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Character Name*
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
              placeholder="E.g., JOHN"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Character names are typically in ALL CAPS in screenplays
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
              placeholder="E.g., John Smith"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Age
              </label>
              <input
                type="text"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
                placeholder="E.g., 30s"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
              placeholder="Brief description of the character"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
              placeholder="Additional notes about the character"
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[#E86F2C] text-white rounded-lg hover:bg-[#E86F2C]/90"
            >
              {character ? 'Update' : 'Add'} Character
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CharacterForm;