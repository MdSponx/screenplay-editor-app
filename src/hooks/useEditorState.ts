import { useState, useCallback, useEffect } from 'react';
import { Block, EditorState, Comment, UserMention } from '../types';
import { updateBlockNumbers } from '../utils/blockUtils';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, setDoc, where } from 'firebase/firestore';
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
            depth: data.depth || 0,
            mentions: data.mentions || []
          } as Comment;
        });
        
        console.log('Mapped comment objects:', comments);
        console.log('[DEBUG] Mapped comments array:', comments);
        
        // Organize comments into a tree structure
        const commentMap = new Map<string, Comment>();
        const rootComments: Comment[] = [];
        
        // First pass: create a map of all comments by ID
        comments.forEach(comment => {
          commentMap.set(comment.id, {...comment, replies: []});
        });
        
        // Second pass: build the tree structure
        comments.forEach(comment => {
          if (comment.parentId && commentMap.has(comment.parentId)) {
            // This is a reply, add it to its parent's replies array
            const parent = commentMap.get(comment.parentId)!;
            if (!parent.replies) parent.replies = [];
            parent.replies.push(commentMap.get(comment.id)!);
          } else {
            // This is a root comment
            rootComments.push(commentMap.get(comment.id)!);
          }
        });
        
        // Update the state with the organized comments
        setState(prev => {
          console.log('[DEBUG] About to call setState with', rootComments.length, 'root comments.');
          console.log('Updating state with comments. Previous comments count:', prev.comments.length);
          console.log('New comments count:', rootComments.length);
          return {
            ...prev,
            comments: rootComments
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

  // Parse text for @mentions and return array of user IDs
  const parseMentions = useCallback(async (text: string): Promise<string[]> => {
    // Regular expression to match @username patterns
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    
    if (!matches) return [];
    
    // Extract usernames without the @ symbol
    const usernames = matches.map(match => match.substring(1));
    
    try {
      // Query Firestore for users with matching usernames or email prefixes
      const usersRef = collection(db, 'users');
      const userPromises = usernames.map(username => {
        // Try to match by nickname, firstName, or email
        const nicknameQuery = query(usersRef, where('nickname', '==', username));
        const firstNameQuery = query(usersRef, where('firstName', '==', username));
        const emailQuery = query(usersRef, where('email', '>=', username), where('email', '<=', username + '\uf8ff'));
        
        return Promise.all([
          getDocs(nicknameQuery),
          getDocs(firstNameQuery),
          getDocs(emailQuery)
        ]);
      });
      
      const userResults = await Promise.all(userPromises);
      
      // Collect all user IDs from the query results
      const mentionedUserIds: string[] = [];
      
      userResults.forEach(([nicknameSnap, firstNameSnap, emailSnap]) => {
        // Check nickname results
        nicknameSnap.forEach(doc => {
          mentionedUserIds.push(doc.id);
        });
        
        // Check firstName results
        firstNameSnap.forEach(doc => {
          if (!mentionedUserIds.includes(doc.id)) {
            mentionedUserIds.push(doc.id);
          }
        });
        
        // Check email results
        emailSnap.forEach(doc => {
          if (!mentionedUserIds.includes(doc.id)) {
            mentionedUserIds.push(doc.id);
          }
        });
      });
      
      return mentionedUserIds;
    } catch (error) {
      console.error('Error parsing mentions:', error);
      return [];
    }
  }, []);

  // Modified function to add a comment with Firestore integration and mentions support
  const addComment = useCallback(async (projectId: string, screenplayId: string, commentData: Comment): Promise<boolean> => {
    if (!projectId || !screenplayId) {
      console.error('Cannot save comment: Missing projectId or screenplayId');
      return false;
    }

    try {
      console.log(`Adding comment to project: ${projectId}, screenplay: ${screenplayId}`, commentData);
      
      // Create a reference to the comments subcollection using the correct nested path
      const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
      
      // Parse mentions from the comment text
      const mentionedUserIds = await parseMentions(commentData.text);
      
      // Prepare the comment data for Firestore
      const commentToSave = {
        ...commentData,
        createdAt: serverTimestamp(), // Use server timestamp for Firestore
        depth: commentData.parentId ? 1 : 0, // Set depth based on whether it's a reply
        mentions: mentionedUserIds // Add the parsed mentions
      };
      
      // If this is a reply to another comment, update the depth
      if (commentData.parentId) {
        // Get the parent comment to determine the correct depth
        const parentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentData.parentId);
        const parentDoc = await getDoc(parentRef);
        
        if (parentDoc.exists()) {
          const parentData = parentDoc.data();
          commentToSave.depth = (parentData.depth || 0) + 1;
        }
      }
      
      // Add the comment to Firestore
      const docRef = await addDoc(commentsRef, commentToSave);
      
      console.log('Comment added to Firestore with ID:', docRef.id);
      
      // Update the local state with the new comment
      setState(prev => {
        const newComment = {
          ...commentData,
          id: docRef.id, // Use the Firestore-generated ID
          createdAt: Timestamp.now(), // Use client-side timestamp for immediate display
          depth: commentToSave.depth,
          mentions: mentionedUserIds,
          replies: []
        };
        
        console.log('Updating state with new comment. Current comments count:', prev.comments.length);
        
        // If this is a reply, add it to the parent's replies
        if (commentData.parentId) {
          // Create a deep copy of the comments array
          const updatedComments = JSON.parse(JSON.stringify(prev.comments));
          
          // Helper function to find and update the parent comment
          const addReplyToParent = (comments: Comment[], parentId: string): boolean => {
            for (let i = 0; i < comments.length; i++) {
              if (comments[i].id === parentId) {
                if (!comments[i].replies) comments[i].replies = [];
                comments[i].replies.push(newComment);
                return true;
              }
              
              // Recursively check replies
              if (comments[i].replies && addReplyToParent(comments[i].replies, parentId)) {
                return true;
              }
            }
            return false;
          };
          
          // Add the reply to its parent
          addReplyToParent(updatedComments, commentData.parentId);
          
          return {
            ...prev,
            comments: updatedComments
          };
        }
        
        // If it's a top-level comment, add it to the comments array
        return {
          ...prev,
          comments: [...prev.comments, newComment]
        };
      });
      
      // If there are mentions, trigger notifications (in a real app)
      if (mentionedUserIds.length > 0) {
        console.log(`Notifying mentioned users: ${mentionedUserIds.join(', ')}`);
        // In a real app, you would trigger notifications here
      }
      
      console.log('Comment added successfully with ID:', docRef.id);
      return true; // Return success
    } catch (error) {
      console.error('Error adding comment to Firestore:', error);
      return false; // Return failure
    }
  }, [parseMentions]);

  // Function to resolve/unresolve a comment
  const resolveComment = useCallback(async (commentId: string, isResolved: boolean, projectId?: string, screenplayId?: string) => {
    console.log(`Resolving comment ${commentId} to isResolved=${isResolved}`);
    
    // Update local state immediately for responsive UI
    setState(prev => {
      // Create a deep copy of the comments array
      const updatedComments = JSON.parse(JSON.stringify(prev.comments));
      
      // Helper function to find and update the comment
      const updateCommentResolved = (comments: Comment[], commentId: string): boolean => {
        for (let i = 0; i < comments.length; i++) {
          if (comments[i].id === commentId) {
            comments[i].isResolved = isResolved;
            return true;
          }
          
          // Recursively check replies
          if (comments[i].replies && updateCommentResolved(comments[i].replies, commentId)) {
            return true;
          }
        }
        return false;
      };
      
      // Update the comment in the tree
      updateCommentResolved(updatedComments, commentId);
      
      console.log(`Updated comment in state. Comments count: ${updatedComments.length}`);
      
      return {
        ...prev,
        comments: updatedComments
      };
    });
    
    // If projectId and screenplayId are provided, update the comment in Firestore
    if (projectId && screenplayId) {
      try {
        const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
        await updateDoc(commentRef, { isResolved });
        console.log(`Updated comment ${commentId} in Firestore to isResolved=${isResolved}`);
      } catch (error) {
        console.error('Error updating comment in Firestore:', error);
      }
    }
  }, []);

  // Add reaction to a comment
  const addReaction = useCallback(async (
    commentId: string, 
    emoji: string, 
    userId: string,
    projectId?: string, 
    screenplayId?: string
  ) => {
    console.log(`Adding reaction ${emoji} to comment ${commentId}`);
    
    // Update local state immediately for responsive UI
    setState(prev => {
      // Create a deep copy of the comments array
      const updatedComments = JSON.parse(JSON.stringify(prev.comments));
      
      // Helper function to find and update the comment
      const updateCommentReactions = (comments: Comment[], commentId: string): boolean => {
        for (let i = 0; i < comments.length; i++) {
          if (comments[i].id === commentId) {
            // Initialize reactions array if it doesn't exist
            if (!comments[i].reactions) comments[i].reactions = [];
            
            // Add the reaction
            comments[i].reactions.push({
              emoji,
              userId,
              timestamp: Timestamp.now()
            });
            return true;
          }
          
          // Recursively check replies
          if (comments[i].replies && updateCommentReactions(comments[i].replies, commentId)) {
            return true;
          }
        }
        return false;
      };
      
      // Update the comment in the tree
      updateCommentReactions(updatedComments, commentId);
      
      return {
        ...prev,
        comments: updatedComments
      };
    });
    
    // If projectId and screenplayId are provided, update the comment in Firestore
    if (projectId && screenplayId) {
      try {
        // Get the reactions subcollection reference
        const reactionsRef = collection(
          db, 
          `projects/${projectId}/screenplays/${screenplayId}/comments/${commentId}/reactions`
        );
        
        // Add the reaction
        await addDoc(reactionsRef, {
          emoji,
          userId,
          timestamp: serverTimestamp()
        });
        
        console.log(`Added reaction ${emoji} to comment ${commentId} in Firestore`);
        return true;
      } catch (error) {
        console.error('Error adding reaction in Firestore:', error);
        return false;
      }
    }
    
    return true; // Return success for local-only updates
  }, []);

  // Fetch user mentions data
  const fetchMentionedUsers = useCallback(async (userIds: string[]): Promise<UserMention[]> => {
    if (!userIds.length) return [];
    
    try {
      const usersRef = collection(db, 'users');
      const userPromises = userIds.map(userId => getDoc(doc(usersRef, userId)));
      const userDocs = await Promise.all(userPromises);
      
      return userDocs
        .filter(doc => doc.exists())
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            displayName: data.firstName && data.lastName 
              ? `${data.firstName} ${data.lastName}` 
              : data.nickname || data.email,
            email: data.email,
            profileImage: data.profileImage
          };
        });
    } catch (error) {
      console.error('Error fetching mentioned users:', error);
      return [];
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
    addReaction,
    parseMentions,
    fetchMentionedUsers
  };
};