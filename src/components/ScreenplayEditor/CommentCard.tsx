// src/components/ScreenplayEditor/CommentCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentReaction } from '../../types';
import { MessageSquare, Check, X, MoreVertical, Smile, Send, Reply, ChevronDown, ChevronRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommentCardProps {
  comment: Comment;
  onResolve: (commentId: string, isResolved: boolean) => void;
  onReply?: (parentId: string, replyText: string) => Promise<void>;
  onReaction?: (commentId: string, emoji: string) => Promise<void>;
  isActive: boolean;
  currentUserId?: string;
  currentUserName?: string;
}

interface UserProfile {
  profileImage?: string;
  firstName?: string;
  lastName?: string;
}

// Common emoji reactions
const EMOJI_OPTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🚀'];

const CommentCard: React.FC<CommentCardProps> = ({ 
  comment, 
  onResolve, 
  onReply, 
  onReaction, 
  isActive, 
  currentUserId = 'user1', // Default for demo
  currentUserName = 'Current User' // Default for demo
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Expand the card when it becomes active (clicked from editor)
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

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
  }, [comment.authorId]);

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

  const handleReplySubmit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (replyText.trim() && onReply) {
      try {
        console.log('Submitting reply:', replyText, 'to comment:', comment.id);
        await onReply(comment.id, replyText);
        setReplyText('');
        setShowReplyInput(false);
        console.log('Reply submitted successfully');
      } catch (error) {
        console.error('Error submitting reply:', error);
        // Show user-friendly error message
        alert('Failed to submit reply. Please try again.');
      }
    } else {
      console.log('Reply submission failed: empty text or no onReply handler');
    }
  };

  const handleEmojiReaction = async (emoji: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (onReaction) {
      try {
        console.log('Adding reaction:', emoji, 'to comment:', comment.id);
        await onReaction(comment.id, emoji);
        setShowEmojiPicker(false);
        console.log('Reaction added successfully');
      } catch (error) {
        console.error('Error adding reaction:', error);
        // Show user-friendly error message
        alert('Failed to add reaction. Please try again.');
      }
    } else {
      console.log('Reaction failed: no onReaction handler');
    }
  };

  const getProfileImage = () => {
    if (userProfile?.profileImage) {
      return userProfile.profileImage;
    }
    // Fallback to a default avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=E86F2C&color=fff&size=32`;
  };

  // Group reactions by emoji
  const groupedReactions = (comment.reactions || []).reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, CommentReaction[]>);

  // Check if current user has reacted with a specific emoji
  const hasUserReacted = (emoji: string) => {
    return groupedReactions[emoji]?.some(reaction => reaction.userId === currentUserId) || false;
  };

  return (
    <div 
      className={`mb-6 rounded-lg border transition-all duration-300 overflow-hidden cursor-pointer ${
        isActive 
          ? 'border-[#E86F2C] ring-1 ring-[#E86F2C]/30 shadow-md'
          : comment.isResolved 
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75' 
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Resolved Badge */}
      {comment.isResolved && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800">
          <div className="flex items-center space-x-2">
            <Check size={14} className="text-green-600" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Resolved</span>
          </div>
        </div>
      )}

      {/* Highlighted Text Quote - Top of card */}
      {comment.highlightedText && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-start space-x-2">
            <div className="w-1 h-4 bg-gray-400 dark:bg-gray-500 rounded-full flex-shrink-0 mt-0.5"></div>
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
            <div className="relative" ref={emojiPickerRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Add reaction"
              >
                <Smile size={16} />
              </button>
              
              {/* Emoji Picker Dropdown */}
              {showEmojiPicker && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
                  <div className="grid grid-cols-4 gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmojiReaction(emoji, e);
                        }}
                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-lg min-w-[40px] min-h-[40px] flex items-center justify-center"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
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
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="More options"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
        
        {/* Comment text - Main body */}
        <div className="mb-3">
          <p className={`text-sm leading-relaxed ${
            comment.isResolved 
              ? 'text-gray-500 dark:text-gray-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {comment.text}
          </p>
        </div>

        {/* Emoji Reactions Display */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmojiReaction(emoji, e);
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  hasUserReacted(emoji)
                    ? 'bg-[#E86F2C]/10 text-[#E86F2C] border border-[#E86F2C]/20'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={`${reactions.map((r: CommentReaction) => r.userName).join(', ')} reacted with ${emoji}`}
              >
                <span>{emoji}</span>
                <span>{reactions.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action buttons - Reply */}
        {isExpanded && !showReplyInput && !comment.isResolved && (
          <div className="flex items-center space-x-4 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyInput(true);
              }}
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-[#E86F2C] dark:hover:text-[#E86F2C] transition-colors"
            >
              <Reply size={12} />
              <span>Reply</span>
            </button>
          </div>
        )}

        {/* Replies Section */}
        {isExpanded && comment.replies && comment.replies.length > 0 && (
          <div className="mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplies(!showReplies);
              }}
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-3"
            >
              {showReplies ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
            </button>

            {showReplies && (
              <div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-start space-x-2 mb-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(reply.authorName)}&background=E86F2C&color=fff&size=24`}
                          alt={reply.authorName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                            {reply.authorName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          {reply.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Reply Input - Bottom section (only when actively replying and expanded) */}
      {isExpanded && showReplyInput && !comment.isResolved && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 transition-all duration-200">
          <div className="space-y-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReplySubmit();
                }
              }}
              placeholder="Write a reply..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#E86F2C]/30 focus:border-[#E86F2C] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={2}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReplySubmit(e);
                }}
                disabled={!replyText.trim()}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#E86F2C] text-white text-xs rounded-md hover:bg-[#E86F2C]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={12} />
                <span>Reply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentCard;
