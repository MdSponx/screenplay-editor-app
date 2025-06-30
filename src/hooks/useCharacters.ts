import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Character {
  id: string;
  name: string;
  fullName?: string;
  description?: string;
  age?: string;
  notes?: string;
  createdAt?: any;
}

export const useCharacters = (projectId: string) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const charactersPath = `projects/${projectId}/characters`;
    const charactersRef = collection(db, charactersPath);
    const charactersQuery = query(charactersRef, orderBy('name'));

    const unsubscribe = onSnapshot(
      charactersQuery,
      (snapshot) => {
        const charactersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Character[];
        
        setCharacters(charactersList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching characters:', err);
        setError('Failed to load characters');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const addCharacter = useCallback(
    async (character: Omit<Character, 'id'>) => {
      try {
        const charactersPath = `projects/${projectId}/characters`;
        const charactersRef = collection(db, charactersPath);
        
        const newCharacter = {
          ...character,
          createdAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(charactersRef, newCharacter);
        return docRef.id;
      } catch (err) {
        console.error('Error adding character:', err);
        setError('Failed to add character');
        throw err;
      }
    },
    [projectId]
  );

  const updateCharacter = useCallback(
    async (id: string, updates: Partial<Character>) => {
      try {
        const characterPath = `projects/${projectId}/characters/${id}`;
        const characterRef = doc(db, characterPath);
        
        await updateDoc(characterRef, updates);
      } catch (err) {
        console.error('Error updating character:', err);
        setError('Failed to update character');
        throw err;
      }
    },
    [projectId]
  );

  const deleteCharacter = useCallback(
    async (id: string) => {
      try {
        const characterPath = `projects/${projectId}/characters/${id}`;
        const characterRef = doc(db, characterPath);
        
        await deleteDoc(characterRef);
      } catch (err) {
        console.error('Error deleting character:', err);
        setError('Failed to delete character');
        throw err;
      }
    },
    [projectId]
  );

  return {
    characters,
    loading,
    error,
    addCharacter,
    updateCharacter,
    deleteCharacter,
  };
};