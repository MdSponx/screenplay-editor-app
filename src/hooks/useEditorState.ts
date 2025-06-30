// src/hooks/useEditorState.ts
import { useState, useCallback, useEffect } from 'react';
import { Block, EditorState, Comment } from '../types';
import { updateBlockNumbers } from '../utils/blockUtils';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, orderBy, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
            highlightedText: data.highlightedText,
            replies: data.replies || [],
            reactions: data.reactions || []
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
      console.error('Missing projectId or screenplayId for saving comment');
      return false;
    }

    try {
      console.log(`Adding comment to project: ${projectId}, screenplay: ${screenplayId}`, commentData);
      
      // Create a reference to the comments subcollection using the correct nested path
      const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
      
      // Add the comment to Firestore
      const docRef = await addDoc(commentsRef, {
        ...commentData,
        replies: commentData.replies || [],
        reactions: commentData.reactions || [],
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
  const resolveComment = useCallback(async (commentId: string, isResolved: boolean, currentProjectId?: string, currentScreenplayId?: string) => {
    console.log(`Resolving comment ${commentId} to isResolved=${isResolved}`);
    
    // Use provided IDs or fall back to hook parameters
    const targetProjectId = currentProjectId || projectId;
    const targetScreenplayId = currentScreenplayId || screenplayId;
    
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
    
    // Update the comment in Firestore
    if (targetProjectId && targetScreenplayId) {
      try {
        console.log(`Updating comment ${commentId} in project ${targetProjectId}, screenplay ${targetScreenplayId} to isResolved=${isResolved}`);
        
        const commentRef = doc(db, `projects/${targetProjectId}/screenplays/${targetScreenplayId}/comments`, commentId);
        await updateDoc(commentRef, { isResolved });
        
        console.log('Comment resolve status updated in Firestore successfully');
      } catch (error) {
        console.error('Error updating comment in Firestore:', error);
        
        // Revert local state on error
        setState(prev => {
          const revertedComments = prev.comments.map(comment => 
            comment.id === commentId 
              ? { ...comment, isResolved: !isResolved } 
              : comment
          );
          
          return {
            ...prev,
            comments: revertedComments
          };
        });
      }
    }
  }, [projectId, screenplayId]);

  // Function to add a reply to a comment
  const addReply = useCallback(async (parentId: string, replyText: string, currentUserId: string = 'user1', currentUserName: string = 'Current User'): Promise<void> => {
    console.log(`Adding reply to comment ${parentId}: ${replyText}`);
    
    if (!projectId || !screenplayId) {
      console.error('Missing projectId or screenplayId for saving reply');
      return;
    }

    // Find the parent comment to get blockId and other info
    const parentComment = state.comments.find(comment => comment.id === parentId);
    if (!parentComment) {
      console.error('Parent comment not found');
      return;
    }

    // Create the reply comment object (without temporary ID for Firestore)
    const replyComment = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authorId: currentUserId,
      authorName: currentUserName,
      text: replyText,
      createdAt: serverTimestamp()
    };

    // Update local state immediately for responsive UI
    const localReplyComment: Comment = {
      ...replyComment,
      blockId: parentComment.blockId,
      isResolved: false,
      startOffset: parentComment.startOffset,
      endOffset: parentComment.endOffset,
      parentId: parentId,
      highlightedText: parentComment.highlightedText,
      replies: [],
      reactions: [],
      createdAt: Timestamp.now() // Use client timestamp for immediate display
    };

    setState(prev => {
      const updatedComments = prev.comments.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), localReplyComment]
          };
        }
        return comment;
      });
      
      return {
        ...prev,
        comments: updatedComments
      };
    });

    // Add reply to Firestore using arrayUnion
    try {
      console.log(`Adding reply to Firestore for comment ${parentId}`);
      
      const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, parentId);
      await updateDoc(commentRef, {
        replies: arrayUnion(replyComment)
      });
      
      console.log('Reply added to Firestore successfully');
    } catch (error) {
      console.error('Error adding reply to Firestore:', error);
      
      // Revert local state on error
      setState(prev => {
        const revertedComments = prev.comments.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: (comment.replies || []).filter(reply => reply.id !== localReplyComment.id)
            };
          }
          return comment;
        });
        
        return {
          ...prev,
          comments: revertedComments
        };
      });
    }
  }, [state.comments, projectId, screenplayId]);

  // Function to add/remove emoji reaction
  const addReaction = useCallback(async (commentId: string, emoji: string, currentUserId: string = 'user1', currentUserName: string = 'Current User'): Promise<void> => {
    console.log(`Adding reaction ${emoji} to comment ${commentId}`);
    
    if (!projectId || !screenplayId) {
      console.error('Missing projectId or screenplayId for saving reaction');
      return;
    }

    // Find the current comment to check existing reactions
    const currentComment = state.comments.find(comment => comment.id === commentId);
    if (!currentComment) {
      console.error('Comment not found for reaction');
      return;
    }

    const reactions = currentComment.reactions || [];
    const existingReaction = reactions.find(
      reaction => reaction.userId === currentUserId && reaction.emoji === emoji
    );

    let isRemoving = false;
    let reactionToAdd = null;
    let reactionToRemove = null;

    if (existingReaction) {
      // Remove existing reaction (toggle off)
      isRemoving = true;
      reactionToRemove = existingReaction;
    } else {
      // Add new reaction
      reactionToAdd = {
        id: `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        emoji,
        userId: currentUserId,
        userName: currentUserName,
        createdAt: serverTimestamp()
      };
    }

    // Update local state immediately for responsive UI
    setState(prev => {
      const updatedComments = prev.comments.map(comment => {
        if (comment.id === commentId) {
          const currentReactions = comment.reactions || [];
          
          let newReactions;
          if (isRemoving) {
            // Remove existing reaction
            newReactions = currentReactions.filter(reaction => 
              !(reaction.userId === currentUserId && reaction.emoji === emoji)
            );
          } else {
            // Add new reaction
            const localReaction = {
              ...reactionToAdd!,
              createdAt: Timestamp.now() // Use client timestamp for immediate display
            };
            newReactions = [...currentReactions, localReaction];
          }
          
          return {
            ...comment,
            reactions: newReactions
          };
        }
        return comment;
      });
      
      return {
        ...prev,
        comments: updatedComments
      };
    });

    // Update reaction in Firestore
    try {
      console.log(`${isRemoving ? 'Removing' : 'Adding'} reaction ${emoji} ${isRemoving ? 'from' : 'to'} comment ${commentId} in Firestore`);
      
      const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
      
      if (isRemoving && reactionToRemove) {
        // Remove reaction using arrayRemove
        await updateDoc(commentRef, {
          reactions: arrayRemove(reactionToRemove)
        });
      } else if (reactionToAdd) {
        // Add reaction using arrayUnion
        await updateDoc(commentRef, {
          reactions: arrayUnion(reactionToAdd)
        });
      }
      
      console.log('Reaction updated in Firestore successfully');
    } catch (error) {
      console.error('Error updating reaction in Firestore:', error);
      
      // Revert local state on error
      setState(prev => {
        const revertedComments = prev.comments.map(comment => {
          if (comment.id === commentId) {
            // Revert to original reactions
            return {
              ...comment,
              reactions: reactions
            };
          }
          return comment;
        });
        
        return {
          ...prev,
          comments: revertedComments
        };
      });
    }
  }, [state.comments, projectId, screenplayId]);

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
    addReply,
    addReaction,
  };
};
