import { useState, useCallback, useEffect } from 'react';
import { Block, EditorState, Comment } from '../types';
import { updateBlockNumbers } from '../utils/blockUtils';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useEditorState = (projectId?: string, screenplayId?: string) => {
  const [state, setState] = useState<EditorState>({
    blocks: [],
    activeBlock: null,
    selectedBlocks: new Set<string>(),
    textContent: {},
    header: { title: '', author: '', contact: '' }, // Initialized as an object
    editingHeader: false,
    undoStack: [],
    redoStack: [],
    comments: [], // Initialize comments array
  });

  // Load existing comments when screenplayId changes
  useEffect(() => {
    const fetchComments = async () => {
      if (!projectId || !screenplayId) {
        console.log('Cannot fetch comments: Missing projectId or screenplayId', { projectId, screenplayId });
        return;
      }

      try {
        console.log('[DEBUG] Fetching comments for screenplay:', screenplayId);
        const commentsColRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        console.log(`Fetching comments for project: ${projectId}, screenplay: ${screenplayId}`);
        
        // Create a reference to the comments subcollection
        const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        
        // Create a query to order comments by creation time
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
        console.log('[DEBUG] Using Firestore path:', commentsColRef.path);

        // Fetch all comments
        const querySnapshot = await getDocs(commentsQuery);
        
        console.log(`Found ${querySnapshot.docs.length} comment documents in Firestore`);
        console.log('[DEBUG] Firestore query returned. Empty?', querySnapshot.empty, 'Size:', querySnapshot.size);
        
        // Map the documents to Comment objects
        const comments = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            blockId: data.blockId,
            authorId: data.authorId,
            authorName: data.authorName,
            text: data.text,
            createdAt: data.createdAt,
            isResolved: data.isResolved || false,
            startOffset: data.startOffset,
            endOffset: data.endOffset,
            parentId: data.parentId,
            highlightedText: data.highlightedText
          } as Comment;
        });
        
        console.log('Mapped comment objects:', comments);
        console.log('[DEBUG] Mapped comments array:', comments);
        
        // Update the state with the fetched comments
        setState(prev => {
          console.log('[DEBUG] About to call setState with', comments.length, 'comments.');
          console.log('Updating state with comments. Previous comments count:', prev.comments.length);
          console.log('New comments count:', comments.length);
          return {
            ...prev,
            comments
          };
        });
        
        console.log(`Successfully loaded ${comments.length} comments for screenplay ${screenplayId}`);
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    if (projectId && screenplayId) {
      fetchComments();
    }
  }, [projectId, screenplayId]);

  const addToHistory = useCallback((blocks: Block[]) => {
    setState(prev => ({
      ...prev,
      undoStack: [...prev.undoStack, prev.blocks],
      redoStack: [],
    }));
  }, []);

  const handleUndo = useCallback(() => {
    setState(prev => {
      if (prev.undoStack.length === 0) return prev;
      
      const previousState = prev.undoStack[prev.undoStack.length - 1];
      return {
        ...prev,
        blocks: previousState,
        redoStack: [...prev.redoStack, prev.blocks],
        undoStack: prev.undoStack.slice(0, -1),
        selectedBlocks: new Set<string>(),
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setState(prev => {
      if (prev.redoStack.length === 0) return prev;
      
      const nextState = prev.redoStack[prev.redoStack.length - 1];
      return {
        ...prev,
        blocks: nextState,
        undoStack: [...prev.undoStack, prev.blocks],
        redoStack: prev.redoStack.slice(0, -1),
        selectedBlocks: new Set<string>(),
      };
    });
  }, []);

  const updateBlocks = useCallback((newBlocks: Block[]) => {
    setState(prev => ({
      ...prev,
      blocks: updateBlockNumbers(newBlocks),
    }));
  }, []);

  const selectAllBlocks = useCallback(() => {
    setState(prev => {
      const allBlockIds = new Set(prev.blocks.map(block => block.id));
      return {
        ...prev,
        selectedBlocks: allBlockIds
      };
    });
  }, []);

  // Modified function to add a comment with Firestore integration
  const addComment = useCallback(async (projectId: string, screenplayId: string, commentData: Comment): Promise<boolean> => {
    if (!projectId || !screenplayId) {
      console.error('Cannot save comment: Missing projectId or screenplayId');
      return false;
    }

    try {
      console.log(`Adding comment to project: ${projectId}, screenplay: ${screenplayId}`, commentData);
      
      // Create a reference to the comments subcollection using the correct nested path
      const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
      
      // Add the comment to Firestore
      const docRef = await addDoc(commentsRef, {
        ...commentData,
        createdAt: serverTimestamp() // Use server timestamp for Firestore
      });
      
      console.log('Comment added to Firestore with ID:', docRef.id);
      
      // Update the local state with the new comment ONLY after successful Firestore write
      setState(prev => {
        const newComment = {
          ...commentData,
          id: docRef.id, // Use the Firestore-generated ID
          createdAt: Timestamp.now() // Use client-side timestamp for immediate display
        };
        
        console.log('Updating state with new comment. Current comments count:', prev.comments.length);
        const updatedComments = [...prev.comments, newComment];
        console.log('New comments count will be:', updatedComments.length);
        
        return {
          ...prev,
          comments: updatedComments
        };
      });
      
      console.log('Comment added successfully with ID:', docRef.id);
      return true; // Return success
    } catch (error) {
      console.error('Error adding comment to Firestore:', error);
      return false; // Return failure
    }
  }, []);

  // Function to resolve/unresolve a comment
  const resolveComment = useCallback(async (commentId: string, isResolved: boolean, projectId?: string, screenplayId?: string) => {
    console.log(`Resolving comment ${commentId} to isResolved=${isResolved}`);
    
    // Update local state immediately for responsive UI
    setState(prev => {
      const updatedComments = prev.comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, isResolved } 
          : comment
      );
      
      console.log(`Updated comment in state. Comments count: ${updatedComments.length}`);
      
      return {
        ...prev,
        comments: updatedComments
      };
    });
    
    // If projectId and screenplayId are provided, update the comment in Firestore
    if (projectId && screenplayId) {
      try {
        // This would be implemented with Firestore update logic
        console.log(`Updating comment ${commentId} in project ${projectId}, screenplay ${screenplayId} to isResolved=${isResolved}`);
        // Example: await updateDoc(doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId), { isResolved });
      } catch (error) {
        console.error('Error updating comment in Firestore:', error);
      }
    }
  }, []);

  return {
    state,
    setState,
    addToHistory,
    handleUndo,
    handleRedo,
    updateBlocks,
    selectAllBlocks,
    addComment,
    resolveComment,
  };
};