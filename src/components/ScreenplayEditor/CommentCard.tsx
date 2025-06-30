// src/components/ScreenplayEditor/CommentCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentReaction } from '../../types';
import { MessageSquare, Check, X, MoreVertical, Smile, Send, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommentCardProps {
  comment: Comment;
  onResolve: (commentId: string, isResolved: boolean) => void;
  isActive: boolean;
  onReply?: (commentId: string, replyText: string) => Promise<boolean>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<boolean>;
  depth?: number;
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
  depth = 0
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [reactions, setReactions] = useState<{emoji: string, count: number}[]>([]);
  const [showReplies, setShowReplies] = useState(true);
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
  }, [comment.authorId]);

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
        
        {/* Comment text - Main body */}
        <div className={`${showReplyInput ? 'mb-2' : 'mb-3'}`}>
          <p className={`text-sm leading-relaxed ${
            comment.isResolved 
              ? 'text-gray-500 dark:text-gray-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {comment.text}
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
            <textarea
              ref={replyInputRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#E86F2C]/30 focus:border-[#E86F2C] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={2}
            />
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentCard;