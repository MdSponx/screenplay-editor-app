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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Block {
  id: string;
  type: string;
  content: string;
  characterId?: string;
}

export interface Scene {
  id: string;
  title?: string;
  scene_heading?: string;
  order: number;
  blocks: Block[];
  createdAt?: any;
}

export const useScenes = (projectId: string, screenplayId: string) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !screenplayId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const scenesPath = `projects/${projectId}/screenplays/${screenplayId}/scenes`;
    const scenesRef = collection(db, scenesPath);
    const scenesQuery = query(scenesRef, orderBy('order'));

    const unsubscribe = onSnapshot(
      scenesQuery,
      (snapshot) => {
        const scenesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Scene[];
        
        console.log("useScenes: onSnapshot fired. Received scenes (IDs):", scenesList.map(s => s.id));
        setScenes(scenesList);
        setLoading(false);
      },
      (err) => {
        console.error('useScenes: Error fetching scenes from onSnapshot:', err);
        setError('Failed to load scenes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, screenplayId]);

  const addScene = useCallback(
    async (scene: Omit<Scene, 'id' | 'order'>) => {
      try {
        const scenesPath = `projects/${projectId}/screenplays/${screenplayId}/scenes`;
        const scenesRef = collection(db, scenesPath);
        
        const newScene = {
          ...scene,
          order: scenes.length, // Add at the end
          createdAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(scenesRef, newScene);
        return docRef.id;
      } catch (err) {
        console.error('Error adding scene:', err);
        setError('Failed to add scene');
        throw err;
      }
    },
    [projectId, screenplayId, scenes.length]
  );

  const updateScene = useCallback(
    async (id: string, updates: Partial<Scene>) => {
      try {
        const scenePath = `projects/${projectId}/screenplays/${screenplayId}/scenes/${id}`;
        const sceneRef = doc(db, scenePath);
        
        await updateDoc(sceneRef, updates);
      } catch (err) {
        console.error('Error updating scene:', err);
        setError('Failed to update scene');
        throw err;
      }
    },
    [projectId, screenplayId]
  );

  const deleteScene = useCallback(
    async (id: string) => {
      try {
        const scenePath = `projects/${projectId}/screenplays/${screenplayId}/scenes/${id}`;
        const sceneRef = doc(db, scenePath);
        
        await deleteDoc(sceneRef);
        
        // Update the order of remaining scenes
        const updatedScenes = scenes.filter(scene => scene.id !== id);
        persistSceneOrder(updatedScenes);
      } catch (err) {
        console.error('Error deleting scene:', err);
        setError('Failed to delete scene');
        throw err;
      }
    },
    [projectId, screenplayId, scenes]
  );

  // MODIFIED: reorderScenes now returns the reordered scenes instead of updating Firestore directly
  const reorderScenes = useCallback(
    async (reorderedScenes: Scene[]): Promise<Scene[]> => {
      try {
        setError(null); // Clear any previous errors
        
        // Return the reordered scenes without updating Firestore
        // The actual persistence will be handled by the central save mechanism
        console.log("useScenes: Returning reordered scenes without updating Firestore.");
        return reorderedScenes;
      } catch (err) {
        console.error('useScenes: Error reordering scenes:', err);
        setError('Failed to reorder scenes');
        throw err;
      }
    },
    [projectId, screenplayId]
  );

  // NEW: Function to persist scene order to Firestore (called by the central save mechanism)
  const persistSceneOrder = useCallback(
    async (reorderedScenes: Scene[]): Promise<void> => {
      try {
        setError(null);
        
        // Create a batch operation
        const batch = writeBatch(db);
        
        // Update each scene's order in the batch
        reorderedScenes.forEach((scene, index) => {
          const scenePath = `projects/${projectId}/screenplays/${screenplayId}/scenes/${scene.id}`;
          const sceneRef = doc(db, scenePath);
          
          batch.update(sceneRef, { 
            order: index,
            // Add a timestamp to ensure the update is recognized as a change
            lastModified: serverTimestamp()
          });
        });
        
        // Commit the batch
        console.log("useScenes: Committing batch to Firestore for scene order persistence.");
        await batch.commit();
        console.log("useScenes: Batch committed successfully.");
      } catch (err) {
        console.error('useScenes: Error persisting scene order:', err);
        setError('Failed to persist scene order');
        throw err;
      }
    },
    [projectId, screenplayId]
  );

  return {
    scenes,
    loading,
    error,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    persistSceneOrder, // Export the new function
  };
};