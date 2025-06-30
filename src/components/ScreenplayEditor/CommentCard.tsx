// src/components/ScreenplayEditor/CommentCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentReaction, UserMention } from '../../types';
import { MessageSquare, Check, X, MoreVertical, Smile, Send, Reply, ChevronDown, ChevronUp, AtSign } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommentCardProps {
  comment: Comment;
  onResolve: (commentId: string, isResolved: boolean) => void;
  isActive: boolean;
  onReply?: (commentId: string, replyText: string) => Promise<boolean>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<boolean>;
  depth?: number;
  mentionedUsers?: UserMention[];
  onMentionUser?: (searchTerm: string) => Promise<UserMention[]>;
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
  depth = 0,
  mentionedUsers = [],
  onMentionUser
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [reactions, setReactions] = useState<{emoji: string, count: number}[]>([]);
  const [showReplies, setShowReplies] = useState(true);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsersData, setMentionedUsersData] = useState<UserMention[]>([]);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

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
    
    // Fetch reactions for this comment
    const fetchReactions = async () => {
      try {
        // This would be implemented with actual Firestore queries in production
        // For now, we'll just simulate some reactions
        const simulatedReactions = [
          { emoji: '👍', count: 2 },
          { emoji: '❤️', count: 1 }
        ];
        setReactions(simulatedReactions);
      } catch (error) {
        console.error('Error fetching reactions:', error);
      }
    };
    
    fetchReactions();
    
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

  // Focus the reply input when it becomes visible
  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  // Format the timestamp for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      // Handle Firebase Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
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

  const handleAddReaction = async (emoji: string) => {
    if (!onAddReaction) return;
    
    try {
      const success = await onAddReaction(comment.id, emoji);
      
      if (success) {
        // Optimistically update UI
        const existingReaction = reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          setReactions(reactions.map(r => 
            r.emoji === emoji ? {...r, count: r.count + 1} : r
          ));
        } else {
          setReactions([...reactions, {emoji, count: 1}]);
        }
      }
      
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
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
    return {
      marginLeft: `${depth * 16}px`
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
                className="font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1 rounded"
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

  return (
    <div 
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
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-start space-x-2">
            <div className="w-1 h-4 bg-[#E86F2C] rounded-full flex-shrink-0 mt-0.5"></div>
            <blockquote className="text-sm italic text-gray-500 dark:text-gray-400 font-normal">
              "{comment.highlightedText}"
            </blockquote>
          </div>
        </div>
      )}
      
      {/* Main Comment Content */}
      <div className="p-4">
        {/* Header with user info and action buttons */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            {/* User Profile Image */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
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
            
            {/* User name and timestamp */}
            <div className="ml-3">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {comment.authorName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(comment.createdAt)}
              </div>
            </div>
          </div>
          
          {/* Action buttons - Top right */}
          <div className="flex items-center space-x-1">
            {/* Emoji reaction button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Add reaction"
            >
              <Smile size={16} />
            </button>
            
            {/* Resolve/Unresolve button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id, !comment.isResolved);
              }}
              className={`p-1.5 rounded-md transition-colors ${
                comment.isResolved
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={comment.isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
            >
              {comment.isResolved ? (
                <X size={16} />
              ) : (
                <Check size={16} />
              )}
            </button>
            
            {/* More options button */}
            <button
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="More options"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
        
        {/* Comment text - Main body with formatted mentions */}
        <div className={`${showReplyInput ? 'mb-2' : 'mb-3'}`}>
          <p className={`text-sm leading-relaxed ${
            comment.isResolved 
              ? 'text-gray-500 dark:text-gray-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {formatCommentText(comment.text)}
          </p>
        </div>

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {reactions.map((reaction, index) => (
              <button 
                key={`${reaction.emoji}-${index}`}
                className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={() => handleAddReaction(reaction.emoji)}
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span className="text-gray-600 dark:text-gray-300">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="flex flex-wrap gap-1">
              {commonEmojis.map(emoji => (
                <button 
                  key={emoji}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors text-lg"
                  onClick={() => handleAddReaction(emoji)}
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
              onClick={() => setShowReplyInput(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-[#E86F2C] dark:hover:text-[#E86F2C] transition-colors flex items-center"
            >
              <Reply size={12} className="mr-1" />
              Reply
            </button>
          )}
          
          {/* Replies count and toggle */}
          {comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
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
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 transition-all duration-200">
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={replyInputRef}
                value={replyText}
                onChange={handleReplyInputChange}
                placeholder="Write a reply... Use @username to mention someone"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#E86F2C]/30 focus:border-[#E86F2C] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                rows={2}
              />
              
              {/* Mention dropdown */}
              {showMentionDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                  {mentionResults.length > 0 ? (
                    mentionResults.map(user => (
                      <button
                        key={user.id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                        onClick={() => insertMention(user)}
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mr-2 overflow-hidden">
                          {user.profileImage ? (
                            <img 
                              src={user.profileImage} 
                              alt={user.displayName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
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
                className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Mention someone"
              >
                <AtSign size={16} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReplySubmit}
                disabled={!replyText.trim() || isSubmittingReply}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#E86F2C] text-white text-xs rounded-md hover:bg-[#E86F2C]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingReply ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                  <Send size={12} className="mr-1" />
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
          <div className="pt-2 px-2">
            {comment.replies.map(reply => (
              <CommentCard
                key={reply.id}
                comment={reply}
                onResolve={onResolve}
                isActive={isActive}
                onReply={onReply}
                onAddReaction={onAddReaction}
                depth={depth + 1}
                onMentionUser={onMentionUser}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentCard;