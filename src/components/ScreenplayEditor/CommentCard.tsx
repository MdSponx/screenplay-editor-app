// src/components/ScreenplayEditor/CommentCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentReaction, UserMention, EmojiReaction } from '../../types';
import { MessageSquare, Check, X, MoreVertical, Smile, Send, Reply, ChevronDown, ChevronUp, AtSign, Users } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommentCardProps {
  comment: Comment;
  onResolve: (commentId: string, isResolved: boolean) => void;
  isActive: boolean;
  onReply?: (commentId: string, replyText: string) => Promise<boolean>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<boolean>;
  onToggleEmojiReaction?: (commentId: string, emoji: string, userName: string) => Promise<boolean>;
  depth?: number;
  mentionedUsers?: UserMention[];
  onMentionUser?: (searchTerm: string) => Promise<UserMention[]>;
  currentUserId?: string;
  currentUserName?: string;
  compactMode?: boolean;
  onExpansionChange?: (commentId: string, isExpanding: boolean) => void;
  isExpanded?: boolean;
}

interface UserProfile {
  profileImage?: string;
  firstName?: string;
  lastName?: string;
}

const CommentCard: React.FC<CommentCardProps> = ({ 
  comment, 
  onResolve, 
  isActive,
  onReply,
  onAddReaction,
  onToggleEmojiReaction,
  depth = 0,
  mentionedUsers = [],
  onMentionUser,
  currentUserId = 'current-user', // Default value for demo
  currentUserName = 'Current User', // Default value for demo
  compactMode = false,
  onExpansionChange,
  isExpanded = false
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsersData, setMentionedUsersData] = useState<UserMention[]>([]);
  const [showReactionsTooltip, setShowReactionsTooltip] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Common emojis for quick selection
  const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '🎉', '👏', '🤔'];

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', comment.authorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile({
            profileImage: userData.profileImage,
            firstName: userData.firstName,
            lastName: userData.lastName
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
    
    // Fetch mentioned users data if the comment has mentions
    const fetchMentionedUsers = async () => {
      if (!comment.mentions || comment.mentions.length === 0) return;
      
      try {
        const usersRef = collection(db, 'users');
        const userPromises = comment.mentions.map(userId => 
          getDoc(doc(usersRef, userId))
        );
        
        const userDocs = await Promise.all(userPromises);
        const users: UserMention[] = userDocs
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
        
        setMentionedUsersData(users);
      } catch (error) {
        console.error('Error fetching mentioned users:', error);
      }
    };
    
    fetchMentionedUsers();
  }, [comment.authorId, comment.mentions]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus the reply input when it becomes visible
  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  // Notify parent component when reply input is shown/hidden
  useEffect(() => {
    if (onExpansionChange) {
      onExpansionChange(comment.id, showReplyInput);
    }
  }, [showReplyInput, comment.id, onExpansionChange]);

  // Format the timestamp for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      // Handle Firebase Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format as relative time if recent, otherwise as date
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  // Handle input change with mention detection
  const handleReplyInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setReplyText(newText);
    
    // Get cursor position
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    // Check if we're in the middle of typing a mention
    const textBeforeCursor = newText.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const searchTerm = mentionMatch[1];
      setMentionSearch(searchTerm);
      
      if (searchTerm.length > 0 && onMentionUser) {
        // Search for users matching the term
        try {
          const results = await searchUsers(searchTerm);
          setMentionResults(results);
          setShowMentionDropdown(results.length > 0);
        } catch (error) {
          console.error('Error searching for users:', error);
          setShowMentionDropdown(false);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Search for users by name or email
  const searchUsers = async (searchTerm: string): Promise<UserMention[]> => {
    try {
      // In a real app, this would query Firestore
      // For now, we'll simulate with some mock data
      const mockUsers: UserMention[] = [
        { id: 'user1', displayName: 'John Smith', email: 'john@example.com' },
        { id: 'user2', displayName: 'Sarah Johnson', email: 'sarah@example.com' },
        { id: 'user3', displayName: 'Mike Chen', email: 'mike@example.com' },
        { id: 'user4', displayName: 'Emma Wilson', email: 'emma@example.com' }
      ];
      
      // Filter users based on search term
      return mockUsers.filter(user => 
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  // Insert a mention at the current cursor position
  const insertMention = (user: UserMention) => {
    if (!replyInputRef.current) return;
    
    const cursorPos = cursorPosition;
    const textBeforeCursor = replyText.substring(0, cursorPos);
    const textAfterCursor = replyText.substring(cursorPos);
    
    // Find the start of the @mention
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    if (mentionStart === -1) return;
    
    // Replace the partial @mention with the full @username
    const newText = 
      textBeforeCursor.substring(0, mentionStart) + 
      `@${user.displayName} ` + 
      textAfterCursor;
    
    setReplyText(newText);
    setShowMentionDropdown(false);
    
    // Focus the input and set cursor position after the inserted mention
    setTimeout(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
        const newCursorPos = mentionStart + user.displayName.length + 2; // +2 for @ and space
        replyInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    }, 0);
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !onReply) return;
    
    try {
      setIsSubmittingReply(true);
      const success = await onReply(comment.id, replyText);
      
      if (success) {
        setReplyText('');
        setShowReplyInput(false);
        setShowReplies(true); // Expand replies after submitting
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Handle toggling emoji reaction
  const handleToggleEmojiReaction = async (emoji: string) => {
    if (!onToggleEmojiReaction) return;
    
    try {
      await onToggleEmojiReaction(comment.id, emoji, currentUserName);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  // Check if current user has reacted with a specific emoji
  const hasUserReacted = (emojiType: string): boolean => {
    if (!comment.emoji) return false;
    
    const reaction = comment.emoji.find(r => r.type === emojiType);
    return reaction ? reaction.users.includes(currentUserId) : false;
  };

  const getProfileImage = () => {
    if (userProfile?.profileImage) {
      return userProfile.profileImage;
    }
    // Fallback to a default avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=E86F2C&color=fff&size=32`;
  };

  // Calculate left margin based on depth for nested replies
  const getMarginStyle = () => {
    // Reduce indentation in compact mode
    const indentSize = compactMode ? 12 : 16;
    return {
      marginLeft: `${depth * indentSize}px`
    };
  };

  // Format comment text with highlighted mentions
  const formatCommentText = (text: string) => {
    if (!comment.mentions || comment.mentions.length === 0) {
      return <span>{text}</span>;
    }
    
    // Replace @mentions with highlighted spans
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    
    if (parts.length <= 1) {
      return <span>{text}</span>;
    }
    
    return (
      <>
        {parts.map((part, index) => {
          // Even indices are regular text, odd indices are usernames
          if (index % 2 === 0) {
            return <span key={index}>{part}</span>;
          } else {
            // Find the user data for this mention
            const mentionedUser = mentionedUsersData.find(user => 
              user.displayName.toLowerCase() === part.toLowerCase() ||
              user.email.toLowerCase().startsWith(part.toLowerCase())
            );
            
            return (
              <span 
                key={index}
                className="mention"
                title={mentionedUser?.email || `@${part}`}
              >
                @{part}
              </span>
            );
          }
        })}
      </>
    );
  };

  // Truncate text with expand option
  const truncateText = (text: string, maxLength: number = compactMode ? 80 : 150) => {
    if (text.length <= maxLength || isTextExpanded) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  // Render emoji reactions
  const renderEmojiReactions = () => {
    if (!comment.emoji || comment.emoji.length === 0) return null;
    
    // Limit the number of reactions shown based on compact mode
    const displayLimit = compactMode ? 3 : 6;
    const visibleReactions = comment.emoji.slice(0, displayLimit);
    const hiddenCount = comment.emoji.length - displayLimit;
    
    return (
      <div className="flex flex-wrap gap-1 mb-3">
        {visibleReactions.map((reaction, index) => (
          <button 
            key={`${reaction.type}-${index}`}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs transition-colors ${
              hasUserReacted(reaction.type)
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/30'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleToggleEmojiReaction(reaction.type)}
            onMouseEnter={() => setShowReactionsTooltip(reaction.type)}
            onMouseLeave={() => setShowReactionsTooltip(null)}
          >
            <span className="mr-1">{reaction.type}</span>
            <span>{reaction.users.length}</span>
            
            {/* Tooltip showing who reacted */}
            {showReactionsTooltip === reaction.type && reaction.displayNames && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs z-10 min-w-[120px]">
                <div className="flex items-center mb-1 text-gray-500 dark:text-gray-400">
                  <Users size={12} className="mr-1" />
                  <span>Reactions</span>
                </div>
                <ul className="space-y-1">
                  {reaction.displayNames.map((name, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">
                      {name}
                    </li>
                  ))}
                </ul>
                <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700"></div>
              </div>
            )}
          </button>
        ))}
        
        {/* Show count of hidden reactions */}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            +{hiddenCount} more
          </span>
        )}
      </div>
    );
  };

  // Determine avatar size based on compact mode
  const avatarSize = compactMode ? 'w-6 h-6' : 'w-8 h-8';
  const textSize = compactMode ? 'text-xs' : 'text-sm';
  const paddingClass = compactMode ? 'p-3' : 'p-4';
  const replyPaddingClass = compactMode ? 'p-2' : 'p-3';

  return (
    <div 
      ref={cardRef}
      className={`mb-4 rounded-lg border transition-all duration-300 overflow-hidden ${
        isActive 
          ? 'border-[#E86F2C] ring-1 ring-[#E86F2C]/30 shadow-md'
          : comment.isResolved 
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75' 
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
      } ${showReplyInput ? 'transform scale-[1.02]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={getMarginStyle()}
    >
      {/* Highlighted Text Quote - Top of card */}
      {comment.highlightedText && depth === 0 && (
        <div className={`px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 ${compactMode ? 'text-xs' : 'text-sm'}`}>
          <div className="flex items-start space-x-2">
            <div className="w-1 h-4 bg-[#E86F2C] rounded-full flex-shrink-0 mt-0.5"></div>
            <blockquote className="italic text-gray-500 dark:text-gray-400 font-normal">
              "{truncateText(comment.highlightedText, compactMode ? 60 : 100)}"
            </blockquote>
          </div>
        </div>
      )}
      
      {/* Main Comment Content */}
      <div className={paddingClass}>
        {/* Header with user info and action buttons */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center min-w-0 flex-1">
            {/* User Profile Image */}
            <div className={`${avatarSize} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0`}>
              <img
                src={getProfileImage()}
                alt={comment.authorName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=E86F2C&color=fff&size=32`;
                }}
              />
            </div>
            
            {/* User name and timestamp on same line */}
            <div className="ml-2 flex items-center space-x-1.5 min-w-0 flex-1">
              <span className={`font-medium truncate ${textSize} text-gray-900 dark:text-white`}>
                {comment.authorName}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {formatDate(comment.createdAt)}
              </span>
            </div>
          </div>
          
          {/* Action buttons - Top right */}
          <div className="flex items-center space-x-1 ml-2">
            {/* Emoji reaction button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Add reaction"
            >
              <Smile size={compactMode ? 14 : 16} />
            </button>
            
            {/* Resolve/Unresolve button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id, !comment.isResolved);
              }}
              className={`p-1 rounded-md transition-colors ${
                comment.isResolved
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={comment.isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
            >
              {comment.isResolved ? (
                <X size={compactMode ? 14 : 16} />
              ) : (
                <Check size={compactMode ? 14 : 16} />
              )}
            </button>
            
            {/* More options button */}
            <button
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="More options"
            >
              <MoreVertical size={compactMode ? 14 : 16} />
            </button>
          </div>
        </div>
        
        {/* Comment text - Main body with formatted mentions */}
        <div className={`${showReplyInput ? 'mb-2' : 'mb-2'}`}>
          <p className={`${textSize} leading-relaxed ${
            comment.isResolved 
              ? 'text-gray-500 dark:text-gray-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {formatCommentText(truncateText(comment.text))}
            
            {/* Show "more" button if text is truncated */}
            {!isTextExpanded && comment.text.length > (compactMode ? 80 : 150) && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTextExpanded(true);
                }}
                className="ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                more
              </button>
            )}
          </p>
        </div>

        {/* Emoji Reactions */}
        {renderEmojiReactions()}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div 
            ref={emojiPickerRef}
            className="mb-2 p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex flex-wrap gap-1">
              {commonEmojis.map(emoji => (
                <button 
                  key={emoji}
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors text-lg ${
                    hasUserReacted(emoji)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => handleToggleEmojiReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reply button and replies count */}
        <div className="flex items-center justify-between">
          {/* Reply button - appears on hover */}
          {isHovered && !showReplyInput && !comment.isResolved && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyInput(true);
              }}
              className={`text-xs text-gray-500 dark:text-gray-400 hover:text-[#E86F2C] dark:hover:text-[#E86F2C] transition-colors flex items-center`}
            >
              <Reply size={12} className="mr-1" />
              Reply
            </button>
          )}
          
          {/* Replies count and toggle */}
          {comment.replies && comment.replies.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplies(!showReplies);
              }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-[#E86F2C] dark:hover:text-[#E86F2C] transition-colors flex items-center ml-auto"
            >
              {showReplies ? (
                <>
                  <ChevronUp size={12} className="mr-1" />
                  Hide {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                </>
              ) : (
                <>
                  <ChevronDown size={12} className="mr-1" />
                  Show {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Reply Input - Bottom section (only when actively replying) */}
      {showReplyInput && !comment.isResolved && (
        <div className={`border-t border-gray-100 dark:border-gray-700 ${replyPaddingClass} bg-gray-50 dark:bg-gray-800/50 transition-all duration-200`}>
          <div className="space-y-2">
            <div className="relative">
              <textarea
                ref={replyInputRef}
                value={replyText}
                onChange={handleReplyInputChange}
                placeholder="Write a reply... Use @username to mention someone"
                className={`w-full px-3 py-1.5 ${compactMode ? 'text-xs' : 'text-sm'} border border-gray-200 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#E86F2C]/30 focus:border-[#E86F2C] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                rows={compactMode ? 1 : 2}
              />
              
              {/* Mention dropdown */}
              {showMentionDropdown && (
                <div className="mention-dropdown">
                  {mentionResults.length > 0 ? (
                    mentionResults.map(user => (
                      <button
                        key={user.id}
                        className="mention-item"
                        onClick={() => insertMention(user)}
                      >
                        <div className="mention-avatar">
                          {user.profileImage ? (
                            <img 
                              src={user.profileImage} 
                              alt={user.displayName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="mention-info">
                          <div className="mention-name">
                            {user.displayName}
                          </div>
                          <div className="mention-email">
                            {user.email}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      No users found
                    </div>
                  )}
                </div>
              )}
              
              {/* Mention button */}
              <button
                onClick={() => {
                  if (replyInputRef.current) {
                    const cursorPos = replyInputRef.current.selectionStart || 0;
                    const textBeforeCursor = replyText.substring(0, cursorPos);
                    const textAfterCursor = replyText.substring(cursorPos);
                    setReplyText(textBeforeCursor + '@' + textAfterCursor);
                    
                    // Focus and set cursor position after the @
                    setTimeout(() => {
                      if (replyInputRef.current) {
                        replyInputRef.current.focus();
                        const newCursorPos = cursorPos + 1;
                        replyInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                        setCursorPosition(newCursorPos);
                      }
                    }, 0);
                  }
                }}
                className="absolute right-2 bottom-1.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Mention someone"
              >
                <AtSign size={compactMode ? 12 : 14} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                className={`text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleReplySubmit}
                disabled={!replyText.trim() || isSubmittingReply}
                className={`flex items-center space-x-1 px-2 py-1 bg-[#E86F2C] text-white text-xs rounded-md hover:bg-[#E86F2C]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                {isSubmittingReply ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                  <Send size={compactMode ? 10 : 12} className="mr-1" />
                )}
                <span>Reply</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && showReplies && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className={`${compactMode ? 'pt-1 px-1' : 'pt-2 px-2'}`}>
            {comment.replies.map(reply => (
              <CommentCard
                key={reply.id}
                comment={reply}
                onResolve={onResolve}
                isActive={isActive}
                onReply={onReply}
                onAddReaction={onAddReaction}
                onToggleEmojiReaction={onToggleEmojiReaction}
                depth={depth + 1}
                onMentionUser={onMentionUser}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                compactMode={compactMode}
                onExpansionChange={onExpansionChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentCard;