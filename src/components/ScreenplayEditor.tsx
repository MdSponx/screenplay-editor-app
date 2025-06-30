import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEditorState } from '../hooks/useEditorState';
import { useBlockHandlersImproved } from '../hooks/useBlockHandlersImproved';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useScreenplaySave } from '../hooks/useScreenplaySave';
import { useCharacterTracking } from '../hooks/useCharacterTracking';
import { useSceneHeadings } from '../hooks/useSceneHeadings';
import { organizeBlocksIntoPages } from '../utils/blockUtils';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, where, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import BlockComponentImproved from './BlockComponentImproved';
import FormatButtons from './ScreenplayEditor/FormatButtons';
import Page from './ScreenplayEditor/Page';
import { useHotkeys } from '../hooks/useHotkeys';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import ScreenplayNavigator from './ScreenplayNavigator';
import SceneNavigator from './SceneNavigator/SceneNavigator';
import CharacterManager from './CharacterManager/CharacterManager';
import CommentsPanel from './ScreenplayEditor/CommentsPanel'; // Import the new CommentsPanel
import type { Block, PersistedEditorState, CharacterDocument, SceneDocument, UniqueSceneHeadingDocument, Comment } from '../types';
import type { Scene } from '../hooks/useScenes';
import { Layers, Users, Type, MessageSquare } from 'lucide-react';

const ScreenplayEditor: React.FC = () => {
  const { projectId, screenplayId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user } = useAuth();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [documentTitle, setDocumentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterDocument[]>([]);
  const [isProcessingSuggestion, setIsProcessingSuggestion] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenes' | 'characters' | 'headings'>('scenes');
  const [showPanel, setShowPanel] = useState(true);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [isSceneSelectionActive, setIsSceneSelectionActive] = useState(false);
  const [isSceneReordering, setIsSceneReordering] = useState(false);
  const [scrollToSceneId, setScrollToSceneId] = useState<string | null>(null); // New state for auto-scrolling
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null); // New state for active comment
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commentCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);
  const [blockPositions, setBlockPositions] = useState<Record<string, number>>({});
  const [editorScrollHeight, setEditorScrollHeight] = useState(0);

  const screenplayData = location.state?.screenplayData;
  const initialBlocks = location.state?.blocks || [];

  const {
    state,
    setState,
    addToHistory,
    handleUndo,
    handleRedo,
    updateBlocks,
    selectAllBlocks,
    addComment,
    resolveComment,
  } = useEditorState(projectId, screenplayId);

  console.log('[DEBUG] ScreenplayEditor state.comments:', state.comments);

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    isSaving,
    hasChanges,
    error: saveError,
    handleSave,
    setHasChanges,
    setPendingSceneOrderChanges
  } = useScreenplaySave(projectId || '', screenplayId || '', user?.id || '', state.blocks, state.activeBlock);

  // Initialize character tracking
  const {
    characters: trackedCharacters,
    loading: charactersLoading,
    error: charactersError,
    addCharacter,
    syncCharactersFromBlocks
  } = useCharacterTracking({
    projectId: projectId,
    screenplayId: screenplayId || null,
    blocks: state.blocks,
    userId: user?.id || ''
  });

  // Initialize centralized scene headings management
  const {
    sceneHeadings: uniqueSceneHeadings,
    loading: sceneHeadingsLoading,
    error: sceneHeadingsError,
    refreshCache: refreshSceneHeadings
  } = useSceneHeadings({
    projectId,
    screenplayId,
    enabled: !!projectId && !!screenplayId
  });

  // Update characters state when trackedCharacters changes
  useEffect(() => {
    if (trackedCharacters.length > 0) {
      setCharacters(trackedCharacters);
    }
  }, [trackedCharacters]);

  // Measure block positions for spatially aware comments
  const measureBlockPositions = useCallback(() => {
    if (!editorScrollRef.current || !blockRefs.current) return;
    
    const editorContainer = editorScrollRef.current;
    const containerRect = editorContainer.getBoundingClientRect();
    const newPositions: Record<string, number> = {};
    
    // Get the editor's scrollable height
    setEditorScrollHeight(editorContainer.scrollHeight);
    
    // Calculate position for each block
    Object.entries(blockRefs.current).forEach(([blockId, blockElement]) => {
      if (blockElement) {
        const blockRect = blockElement.getBoundingClientRect();
        // Calculate position relative to the editor container
        const relativeTop = blockRect.top - containerRect.top + editorContainer.scrollTop;
        newPositions[blockId] = relativeTop;
      }
    });
    
    setBlockPositions(newPositions);
  }, [blockRefs]);

  // Set up scroll synchronization
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    // Prevent infinite scroll loop
    if (isScrollingProgrammatically.current) return;
    
    const sourceElement = event.currentTarget;
    const targetElement = sourceElement === editorScrollRef.current 
      ? commentsScrollRef.current 
      : editorScrollRef.current;
    
    if (sourceElement && targetElement) {
      isScrollingProgrammatically.current = true;
      targetElement.scrollTop = sourceElement.scrollTop;
      
      // Update block positions during scroll
      measureBlockPositions();
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 50);
    }
  }, [measureBlockPositions]);

  // Initialize block positions and set up resize listener
  useEffect(() => {
    measureBlockPositions();
    
    const handleResize = () => {
      measureBlockPositions();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [measureBlockPositions, state.blocks]);

  // NEW: Effect to sync editor scrolling to comments panel
  useEffect(() => {
    if (state.activeBlock && showCommentsPanel) {
      // Find comments associated with the active block
      const activeBlockComments = state.comments.filter(comment => 
        comment.blockId === state.activeBlock
      );
      
      if (activeBlockComments.length > 0) {
        // Set the first comment as active
        setActiveCommentId(activeBlockComments[0].id);
        
        // Scroll to the comment card if the ref exists
        const commentCardElement = commentCardRefs.current[activeBlockComments[0].id];
        if (commentCardElement) {
          commentCardElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    }
  }, [state.activeBlock, state.comments, showCommentsPanel]);

  // Smart Autosave implementation with scene reordering awareness
  useEffect(() => {
    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Only set up autosave if there are changes to save and not reordering scenes
    if (state.blocks.length > 0 && hasChanges && !isSceneReordering) {
      // Set a new timer for autosave (3 seconds of inactivity)
      autosaveTimerRef.current = setTimeout(async () => {
        console.log('Autosave triggered after inactivity');
        try {
          await handleSaveWithEditorState();
          console.log('Autosave completed successfully');
        } catch (err) {
          console.error('Autosave failed:', err);
        }
      }, 3000);
    }

    // Cleanup function
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state.blocks, hasChanges, isSceneReordering]); // Added isSceneReordering to dependencies

  const updateEditorState = useCallback(async () => {
    if (!projectId || !screenplayId || !user?.id) {
      console.warn('Cannot update editor state: Missing project ID, screenplay ID, or user ID.');
      return;
    }

    try {
      const editorStateRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/editor/state`);

      const persistedEditorState: PersistedEditorState = {
        activeBlock: state.activeBlock,
        selectedBlocks: Array.from(state.selectedBlocks),
        editingHeader: state.editingHeader,
        header: typeof state.header === 'object'
          ? state.header
          : {
              title: typeof state.header === 'string' ? state.header : documentTitle,
              author: screenplayData?.metadata?.author || user.email,
              contact: ''
            },
        lastModified: new Date()
      };

      await setDoc(editorStateRef, persistedEditorState, { merge: true });
      console.log(`Updated editor state for screenplay ${screenplayId}`);
    } catch (err) {
      console.error('Error updating editor state:', err);
    }
  }, [projectId, screenplayId, user?.id, user?.email, state.activeBlock, state.selectedBlocks, state.header, state.editingHeader, documentTitle, screenplayData]);

  const handleSaveWithEditorState = useCallback(async () => {
    try {
      await updateEditorState();
      return await handleSave();
    } catch (err) {
      console.error('Error saving screenplay:', err);
      return { success: false, error: 'Failed to save screenplay' };
    }
  }, [handleSave, updateEditorState]);

  // Create a wrapper function for setSelectedBlocks that handles both direct values and functions
  const setSelectedBlocks = useCallback((blocksOrFunction: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof blocksOrFunction === 'function') {
      setState(prev => ({ ...prev, selectedBlocks: blocksOrFunction(prev.selectedBlocks) }));
    } else {
      setState(prev => ({ ...prev, selectedBlocks: blocksOrFunction }));
    }
  }, [setState]);

  // Create a wrapper function that matches the expected signature
  const onSceneHeadingUpdate = useCallback(async () => {
    await refreshSceneHeadings();
  }, [refreshSceneHeadings]);

  // Create action block after scene heading completion
  const createActionBlockAfterSceneHeading = useCallback(() => {
    if (!state.activeBlock) return;
    
    const currentIndex = state.blocks.findIndex(b => b.id === state.activeBlock);
    if (currentIndex === -1) return;

    const actionBlockId = `action-${uuidv4()}`;
    const actionBlock = {
      id: actionBlockId,
      type: 'action',
      content: '',
    };

    const updatedBlocks = [...state.blocks];
    updatedBlocks.splice(currentIndex + 1, 0, actionBlock);
    
    updateBlocks(updatedBlocks);
    setHasChanges(true);

    // Set the active block state immediately
    setState(prev => ({ ...prev, activeBlock: actionBlockId }));
    
    console.log(`Action block created and set as active: ${actionBlockId}`);
  }, [state.activeBlock, state.blocks, updateBlocks, setHasChanges, setState]);

  // NEW: Handle comment selection and scroll to the commented block
  const handleCommentSelect = useCallback((comment: Comment) => {
    // Set the active comment ID
    setActiveCommentId(comment.id);
    
    // Set the active block to the block containing the comment
    setState(prev => ({ ...prev, activeBlock: comment.blockId }));
    
    // Find the block element and scroll to it
    const blockElement = blockRefs.current[comment.blockId];
    if (blockElement) {
      // Scroll the block into view with smooth behavior
      blockElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight the block temporarily
      blockElement.classList.add('ring-2', 'ring-[#E86F2C]', 'ring-opacity-50');
      setTimeout(() => {
        blockElement.classList.remove('ring-2', 'ring-[#E86F2C]', 'ring-opacity-50');
      }, 2000);
    }

    // NEW: Scroll to the comment card in the comments panel
    setTimeout(() => {
      const commentCardElement = commentCardRefs.current[comment.id];
      if (commentCardElement) {
        commentCardElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 150); // Small delay to ensure comment card is rendered
  }, [setState]);

  // NEW: Handle scene reordering from SceneNavigator
  const handleScenesReordered = useCallback((reorderedScenes: Scene[]) => {
    console.log("ScreenplayEditor: Handling reordered scenes", reorderedScenes.map(s => s.id));
    
    // Create a map of scene IDs to their blocks for quick lookup
    const sceneBlocksMap = new Map<string, Block[]>();
    
    // First, identify all scene heading blocks and their associated content blocks
    let currentSceneId: string | null = null;
    let currentSceneBlocks: Block[] = [];
    
    state.blocks.forEach(block => {
      if (block.type === 'scene-heading') {
        // If we were tracking a previous scene, add it to the map
        if (currentSceneId) {
          sceneBlocksMap.set(currentSceneId, currentSceneBlocks);
        }
        
        // Start tracking a new scene
        currentSceneId = block.id;
        currentSceneBlocks = [block];
      } else if (currentSceneId) {
        // Add this block to the current scene's blocks
        currentSceneBlocks.push(block);
      }
    });
    
    // Add the last scene if there is one
    if (currentSceneId) {
      sceneBlocksMap.set(currentSceneId, currentSceneBlocks);
    }
    
    // Now create a new blocks array based on the reordered scenes
    const newBlocks: Block[] = [];
    
    reorderedScenes.forEach(scene => {
      const sceneBlocks = sceneBlocksMap.get(scene.id);
      if (sceneBlocks) {
        newBlocks.push(...sceneBlocks);
      }
    });
    
    // Update the blocks state with the reordered blocks
    updateBlocks(newBlocks);
    
    // Mark as having changes that need to be saved
    setHasChanges(true);
    
    // Set the pending scene order for the next save operation
    setPendingSceneOrderChanges(reorderedScenes);
    
    console.log("ScreenplayEditor: Blocks reordered based on scene order");
  }, [state.blocks, updateBlocks, setHasChanges, setPendingSceneOrderChanges]);

  // Handle scene selection - MODIFIED to not change active block
  const handleSelectScene = useCallback((sceneId: string) => {
    // Set scene selection active to prevent suggestions
    setIsSceneSelectionActive(true);
    
    setActiveSceneId(sceneId);
    
    // Find the scene heading block in the blocks array
    const sceneHeadingIndex = state.blocks.findIndex(block => block.id === sceneId);
    
    if (sceneHeadingIndex !== -1) {
      // Only scroll to the scene heading, don't change activeBlock
      const sceneHeadingElement = blockRefs.current[sceneId];
      if (sceneHeadingElement) {
        sceneHeadingElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    }
    
    // Reset scene selection active after a delay
    setTimeout(() => {
      setIsSceneSelectionActive(false);
    }, 300);
  }, [state.blocks]);

  // NEW: Effect for auto-scrolling to moved scene
  useEffect(() => {
    if (scrollToSceneId) {
      const sceneElement = blockRefs.current[scrollToSceneId];
      if (sceneElement) {
        // Scroll the scene into view with smooth behavior and center alignment
        sceneElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        console.log(`Auto-scrolling to moved scene: ${scrollToSceneId}`);
      } else {
        console.log(`Scene element not found for ID: ${scrollToSceneId}`);
      }
      
      // Reset the scroll target after scrolling
      setTimeout(() => {
        setScrollToSceneId(null);
      }, 100);
    }
  }, [scrollToSceneId]);

  const {
    handleContentChange,
    handleEnterKey,
    handleKeyDown,
    handleBlockClick,
    handleBlockDoubleClick,
    handleFormatChange,
    handleMouseDown,
    clearSelection,
    isCharacterBlockAfterDialogue,
  } = useBlockHandlersImproved({
    blocks: state.blocks,
    activeBlock: state.activeBlock,
    textContent: state.textContent,
    selectedBlocks: state.selectedBlocks,
    blockRefs,
    addToHistory,
    updateBlocks,
    setSelectedBlocks,
    setHasChanges,
    projectId,
    screenplayId,
    onSceneHeadingUpdate
  });

  // Deselection callback for double-click empty space
  const handleDeselectAll = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  useAutoScroll(state.activeBlock, state.blocks, blockRefs);

  useHotkeys({
    handleUndo,
    handleRedo,
    selectAllBlocks,
    blocks: state.blocks,
    activeBlock: state.activeBlock,
    handleFormatChange,
  });

  // Mark changes when blocks are updated
  useEffect(() => {
    setHasChanges(true);
  }, [state.blocks, setHasChanges]);

  // Enhanced focus management for active block changes (with suggestion awareness)
  useEffect(() => {
    if (state.activeBlock && blockRefs.current[state.activeBlock] && !isProcessingSuggestion && !isSceneSelectionActive && !isSceneReordering) {
      // Use a longer delay to ensure DOM is fully updated after state changes
      const timeoutId = setTimeout(() => {
        if (!state.activeBlock || isProcessingSuggestion || isSceneSelectionActive || isSceneReordering) return; // Additional checks
        
        const activeElement = blockRefs.current[state.activeBlock];
        if (activeElement) {
          // Check if this is a newly created action block (empty content)
          const activeBlockData = state.blocks.find(b => b.id === state.activeBlock);
          if (activeBlockData && activeBlockData.type === 'action' && activeBlockData.content === '') {
            console.log(`Focusing newly created action block: ${state.activeBlock}`);
            
            // Enhanced focus with cursor positioning
            activeElement.focus();
            
            // Ensure cursor is positioned at the start
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && activeElement) {
                const range = document.createRange();
                
                // Ensure there's a text node to work with
                if (!activeElement.firstChild) {
                  const textNode = document.createTextNode('');
                  activeElement.appendChild(textNode);
                }
                
                let textNode = activeElement.firstChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                  range.setStart(textNode, 0);
                  range.setEnd(textNode, 0);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  console.log(`Cursor positioned at start of action block: ${state.activeBlock}`);
                }
              }
            }, 50);
          }
        }
      }, 150); // Longer delay to ensure React has finished rendering

      return () => clearTimeout(timeoutId);
    }
  }, [state.activeBlock, state.blocks, isProcessingSuggestion, isSceneSelectionActive, isSceneReordering]);

  useEffect(() => {
    const fetchScreenplayContent = async () => {
      if (!projectId || !screenplayId || !user?.id) {
        setError('Missing required parameters: project ID, screenplay ID, or user ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch screenplay metadata first
        const screenplayRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}`);
        const screenplaySnap = await getDoc(screenplayRef);
        
        if (!screenplaySnap.exists()) {
          setError('Screenplay not found');
          setLoading(false);
          return;
        }
        const currentScreenplayData = screenplaySnap.data();
        setDocumentTitle(currentScreenplayData?.title || 'Untitled Screenplay');

        // Fetch scenes collection to get blocks
        const scenesRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`);
        const scenesQuerySnap = await getDocs(query(scenesRef, orderBy('order')));

        let blocks: Block[] = [];

        if (!scenesQuerySnap.empty) {
          const loadedSceneDocuments = scenesQuerySnap.docs.map(doc => doc.data() as SceneDocument);
          
          // Set the first scene as active
          if (loadedSceneDocuments.length > 0) {
            setActiveSceneId(loadedSceneDocuments[0].id);
          }
          
          // Assemble the full blocks array from scene documents
          loadedSceneDocuments.forEach(sceneDoc => {
            // Add the scene heading block itself
            blocks.push({
              id: sceneDoc.id,
              type: 'scene-heading',
              content: sceneDoc.scene_heading,
              number: sceneDoc.order + 1 // Scene numbers typically start from 1
            });
            
            // Add the rest of the blocks in the scene
            blocks = blocks.concat(sceneDoc.blocks);
          });
          
          console.log(`Loaded ${loadedSceneDocuments.length} scenes with total ${blocks.length} blocks.`);
        } else {
          console.log(`No scenes found for screenplay ${screenplayId}, using default blocks.`);
          
          // Generate a unique scene ID for the initial scene heading
          const sceneId = `scene-${uuidv4()}`;
          
          // Generate a unique block ID for the initial action block
          const actionBlockId = `block-${uuidv4()}`;
          
          // Create initial blocks with proper IDs
          blocks = [
            {
              id: sceneId,
              type: 'scene-heading',
              content: '', // Changed from 'INT. LOCATION - DAY' to empty string
              number: 1
            },
            {
              id: actionBlockId,
              type: 'action',
              content: 'Write your scene description here.'
            }
          ];
          
          // Set the initial scene as active
          setActiveSceneId(sceneId);
          
          // Create the scene document in Firestore
          const sceneDocRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`, sceneId);
          
          const newSceneDoc: SceneDocument = {
            id: sceneId,
            scene_heading: '', // Changed from 'INT. LOCATION - DAY' to empty string
            blocks: [
              {
                id: actionBlockId,
                type: 'action',
                content: 'Write your scene description here.'
              }
            ],
            order: 0,
            screenplayId: screenplayId,
            projectId: projectId,
            characters_in_this_scene: [],
            elements_in_this_scene: [],
            lastModified: Timestamp.now()
          };
          
          await setDoc(sceneDocRef, newSceneDoc);
        }

        // Fetch characters and elements for suggestions
        console.log(`Fetching characters for project ${projectId}`);
        const charactersRef = collection(db, `projects/${projectId}/characters`);
        const charactersSnap = await getDocs(charactersRef);
        const loadedCharacters = charactersSnap.docs.map(doc => doc.data() as CharacterDocument);
        console.log(`Loaded ${loadedCharacters.length} unique characters:`, loadedCharacters);
        setCharacters(loadedCharacters);

        // Scene headings are now managed by the useSceneHeadings hook
        console.log(`Scene headings will be loaded by useSceneHeadings hook`);

        // Fetch comments for the screenplay
        const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        const commentsSnap = await getDocs(commentsRef);
        const loadedComments = commentsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Comment[];
        console.log(`Loaded ${loadedComments.length} comments`);

        // Then try to load editor state (for UI state, not for blocks)
        const editorStateRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/editor/state`);
        const editorStateSnap = await getDoc(editorStateRef);
        
        // Get header content from screenplay data or create default
        let header_content = currentScreenplayData?.header_content || {
          title: currentScreenplayData?.title || '',
          author: currentScreenplayData?.metadata?.author || user.email,
          contact: ''
        };

        if (editorStateSnap.exists()) {
          const editorState = editorStateSnap.data() as PersistedEditorState;
          console.log(`Found editor state for screenplay ${screenplayId}`);

          setState(prev => ({
            ...prev,
            blocks: blocks,
            activeBlock: editorState.activeBlock || (blocks.length > 0 ? blocks[0].id : null),
            selectedBlocks: new Set(editorState.selectedBlocks || []),
            header: editorState.header || header_content,
            editingHeader: editorState.editingHeader || false,
            comments: loadedComments // Add loaded comments to state
          }));
        } else {
          console.log(`No editor state found for screenplay ${screenplayId}, creating default state`);

          setState(prev => ({
            ...prev,
            blocks: blocks,
            activeBlock: blocks.length > 0 ? blocks[0].id : null,
            header: header_content,
            comments: loadedComments // Add loaded comments to state
          }));

          // Create default editor state
          const newEditorState: PersistedEditorState = {
            activeBlock: blocks.length > 0 ? blocks[0].id : null,
            selectedBlocks: [],
            editingHeader: false,
            header: header_content,
            lastModified: new Date()
          };

          await setDoc(editorStateRef, newEditorState);
        }
      } catch (err) {
        console.error('Error fetching screenplay data:', err);
        setError('Failed to load screenplay data');
      } finally {
        setLoading(false);
      }
    };

    // Prioritize initialBlocks from location state if available, otherwise fetch from DB
    if (initialBlocks && initialBlocks.length > 0) {
      console.log("Initializing editor with blocks from location state.");
      setState(prev => ({
        ...prev,
        blocks: initialBlocks,
        header: screenplayData?.header_content || { 
          title: screenplayData?.title || 'Untitled Screenplay', 
          author: screenplayData?.metadata?.author || user?.email, 
          contact: '' 
        }
      }));
      
      // Also set characters if available in location state
      if (location.state?.characters) {
        setCharacters(location.state.characters);
      }
      
      // Scene headings are now managed by the centralized hook
      
      setDocumentTitle(screenplayData?.title || 'Untitled Screenplay');
      setLoading(false);
    } else {
      fetchScreenplayContent();
    }
  }, [projectId, screenplayId, setState, initialBlocks, screenplayData, user?.id, user?.email, location.state]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#577B92] dark:text-gray-400">Loading screenplay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="text-[#577B92] dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const pages = organizeBlocksIntoPages(state.blocks);

  return (
    <div className="flex flex-col min-h-screen">
      <ScreenplayNavigator
        projectId={projectId}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        documentTitle={documentTitle}
        setDocumentTitle={setDocumentTitle}
        onSave={handleSaveWithEditorState}
        isSaving={isSaving}
        hasChanges={hasChanges}
      />

      {/* Second row with tab navigation */}
      <div className={`fixed top-16 left-0 right-0 z-50 ${
        isDarkMode ? 'bg-[#1E4D3A]' : 'bg-[#F5F5F2]'
      } h-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex h-full items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (activeTab === 'scenes') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('scenes');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'scenes' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Layers size={16} className="mr-2" />
                Scenes
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'characters') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('characters');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'characters' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Users size={16} className="mr-2" />
                Characters
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'headings') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('headings');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'headings' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Type size={16} className="mr-2" />
                Headings
              </button>
              <div className="ml-auto">
                <button
                  onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                  className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                    showCommentsPanel
                      ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                      : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                  }`}
                >
                  <MessageSquare size={16} className="mr-2" />
                  Comments
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mt-28">
        {/* Scene Navigator & Character Manager Sidebar - Now fixed position */}
        {showPanel && (
          <div className="fixed-sidebar">
            <div className="fixed-sidebar-content">
              {activeTab === 'scenes' && (
                <SceneNavigator
                  projectId={projectId || ''}
                  screenplayId={screenplayId || ''}
                  activeSceneId={activeSceneId}
                  onSelectScene={handleSelectScene}
                  onReorderStatusChange={setIsSceneReordering}
                  onScenesReordered={handleScenesReordered}
                  onSceneMoved={setScrollToSceneId} // New prop for auto-scrolling
                />
              )}
              
              {activeTab === 'characters' && (
                <CharacterManager
                  projectId={projectId || ''}
                  screenplayId={screenplayId || ''}
                />
              )}
              
              {activeTab === 'headings' && (
                <div className="p-4 h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <p>Scene Heading Management (Coming Soon)</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content area with screenplay and comments panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Screenplay content area */}
          <div 
            ref={editorScrollRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-auto screenplay-content relative user-select-text ${showPanel ? 'ml-80' : ''} ${showCommentsPanel ? 'mr-80' : ''}`} 
            data-screenplay-editor="true"
          >
            <div 
              className="max-w-[210mm] mx-auto my-8 screenplay-pages pb-24"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center'
              }}
              data-screenplay-pages="true"
            >
              <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                  <div className="relative user-select-text">
                    {pages.map((pageBlocks, pageIndex) => (
                      <Page
                        key={pageIndex}
                        pageIndex={pageIndex}
                        blocks={pageBlocks}
                        isDarkMode={isDarkMode}
                        header={state.header as any}
                        editingHeader={state.editingHeader}
                        onHeaderChange={(newHeader) => setState(prev => ({ 
                          ...prev, 
                          header: { 
                            title: newHeader, 
                            author: (prev.header as any)?.author || user?.email || '', 
                            contact: (prev.header as any)?.contact || '' 
                          } 
                        }))}
                        onEditingHeaderChange={(editingHeader) => setState(prev => ({ ...prev, editingHeader }))}
                        onContentChange={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onBlockFocus={(id) => setState(prev => ({ ...prev, activeBlock: id }))}
                        onBlockClick={handleBlockClick}
                        onBlockDoubleClick={handleBlockDoubleClick}
                        onBlockMouseDown={handleMouseDown}
                        selectedBlocks={state.selectedBlocks}
                        activeBlock={state.activeBlock}
                        blockRefs={blockRefs}
                        projectCharacters={characters}
                        projectElements={[]}
                        projectId={projectId}
                        screenplayId={screenplayId}
                        projectUniqueSceneHeadings={uniqueSceneHeadings}
                        onEnterAction={createActionBlockAfterSceneHeading}
                        isProcessingSuggestion={isProcessingSuggestion}
                        setIsProcessingSuggestion={setIsProcessingSuggestion}
                        onDeselectAll={handleDeselectAll}
                        isCharacterBlockAfterDialogue={isCharacterBlockAfterDialogue}
                        isSceneSelectionActive={isSceneSelectionActive}
                        addComment={(comment) => {
                          if (projectId && screenplayId) {
                            return addComment(projectId, screenplayId, comment);
                          }
                          return Promise.resolve(false);
                        }}
                        activeCommentId={activeCommentId}
                        onCommentSelect={(comment) => {
                          // Open comments panel if not already open
                          if (!showCommentsPanel) {
                            setShowCommentsPanel(true);
                          }
                          // Call the existing comment select handler
                          handleCommentSelect(comment);
                        }}
                        comments={state.comments}
                        showCommentsPanel={showCommentsPanel}
                        setShowCommentsPanel={setShowCommentsPanel}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <FormatButtons
              isDarkMode={isDarkMode}
              activeBlock={state.activeBlock}
              onFormatChange={handleFormatChange}
              blocks={state.blocks}
              className="format-buttons"
            />
          </div>

        </div>

        {/* Fixed Comments Panel - Now positioned like the scene navigator */}
        {showCommentsPanel && (
          <div className="fixed-comments-panel">
            <div className="fixed-comments-panel-content">
              <CommentsPanel
                comments={state.comments}
                activeBlock={state.activeBlock}
                activeCommentId={activeCommentId}
                onResolveComment={(commentId, isResolved) => {
                  if (projectId && screenplayId) {
                    resolveComment(commentId, isResolved, projectId, screenplayId);
                  } else {
                    resolveComment(commentId, isResolved);
                  }
                }}
                onCommentSelect={handleCommentSelect}
                commentCardRefs={commentCardRefs}
                blockPositions={blockPositions}
                editorScrollHeight={editorScrollHeight}
                ref={commentsScrollRef}
                onScroll={handleScroll}
              />
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {saveError}
        </div>
      )}
    </div>
  );
};

export default ScreenplayEditor;
