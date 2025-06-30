import React, { useState } from 'react';
import CommentCard from './ScreenplayEditor/CommentCard';
import { Comment, CommentReaction } from '../types';
import { Timestamp } from 'firebase/firestore';

const CommentCardDemo: React.FC = () => {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 'comment-1',
      blockId: 'block-1',
      authorId: 'user-1',
      authorName: 'John Smith',
      text: 'This dialogue feels a bit rushed. Maybe we could add a pause or some action to give it more weight?',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 30)), // 30 minutes ago
      isResolved: false,
      startOffset: 0,
      endOffset: 50,
      highlightedText: 'This is dialogue for scene 1. The character is saying something important to the story.',
      replies: [
        {
          id: 'reply-1',
          blockId: 'block-1',
          authorId: 'user-2',
          authorName: 'Sarah Johnson',
          text: 'I agree! Maybe we could add a beat where the character takes a sip of coffee before responding?',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 20)),
          isResolved: false,
          startOffset: 0,
          endOffset: 50,
          parentId: 'comment-1',
          replies: [],
          reactions: []
        }
      ],
      reactions: [
        {
          id: 'reaction-1',
          emoji: '👍',
          userId: 'user-2',
          userName: 'Sarah Johnson',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 25))
        },
        {
          id: 'reaction-2',
          emoji: '👍',
          userId: 'user-3',
          userName: 'Mike Chen',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 20))
        },
        {
          id: 'reaction-3',
          emoji: '💡',
          userId: 'user-4',
          userName: 'Emma Wilson',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 15))
        }
      ]
    },
    {
      id: 'comment-2',
      blockId: 'block-2',
      authorId: 'user-2',
      authorName: 'Sarah Johnson',
      text: 'Great scene heading! Very clear and sets the mood perfectly.',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 2)), // 2 hours ago
      isResolved: true,
      startOffset: 0,
      endOffset: 25,
      highlightedText: 'INT. COFFEE SHOP - DAY',
      replies: [],
      reactions: [
        {
          id: 'reaction-4',
          emoji: '🎉',
          userId: 'user-1',
          userName: 'John Smith',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60))
        }
      ]
    },
    {
      id: 'comment-3',
      blockId: 'block-3',
      authorId: 'user-3',
      authorName: 'Mike Chen',
      text: 'I love this action sequence! The pacing is perfect and really builds tension. Maybe we could add a bit more detail about the character\'s emotional state here?',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 24)), // 1 day ago
      isResolved: false,
      startOffset: 10,
      endOffset: 85,
      highlightedText: 'The character runs through the crowded street, dodging cars and pedestrians as the sound of sirens grows louder behind them.',
      replies: [
        {
          id: 'reply-2',
          blockId: 'block-3',
          authorId: 'user-1',
          authorName: 'John Smith',
          text: 'Good point! What if we add something like "heart pounding" or "sweat dripping"?',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 12)),
          isResolved: false,
          startOffset: 10,
          endOffset: 85,
          parentId: 'comment-3',
          replies: [],
          reactions: []
        },
        {
          id: 'reply-3',
          blockId: 'block-3',
          authorId: 'user-4',
          authorName: 'Emma Wilson',
          text: 'Or maybe show their desperation through their actions - stumbling, looking back frantically?',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 8)),
          isResolved: false,
          startOffset: 10,
          endOffset: 85,
          parentId: 'comment-3',
          replies: [],
          reactions: []
        }
      ],
      reactions: [
        {
          id: 'reaction-5',
          emoji: '❤️',
          userId: 'user-2',
          userName: 'Sarah Johnson',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 20))
        },
        {
          id: 'reaction-6',
          emoji: '🚀',
          userId: 'user-4',
          userName: 'Emma Wilson',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 18))
        }
      ]
    },
    {
      id: 'comment-4',
      blockId: 'block-4',
      authorId: 'user-4',
      authorName: 'Emma Wilson',
      text: 'Simple but effective. This works well.',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 15)), // 15 minutes ago
      isResolved: false,
      startOffset: 0,
      endOffset: 30,
      replies: [],
      reactions: []
    },
    {
      id: 'comment-5',
      blockId: 'block-5',
      authorId: 'user-5',
      authorName: 'David Rodriguez',
      text: 'This character introduction is brilliant! Really establishes their personality right away. The dialogue feels natural and authentic.',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 6)), // 6 hours ago
      isResolved: true,
      startOffset: 0,
      endOffset: 120,
      highlightedText: 'ALEX enters the room with confidence, adjusting their tie and scanning the crowd with sharp, calculating eyes.',
      replies: [],
      reactions: [
        {
          id: 'reaction-7',
          emoji: '👍',
          userId: 'user-1',
          userName: 'John Smith',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 5))
        },
        {
          id: 'reaction-8',
          emoji: '👍',
          userId: 'user-2',
          userName: 'Sarah Johnson',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 4))
        },
        {
          id: 'reaction-9',
          emoji: '😂',
          userId: 'user-3',
          userName: 'Mike Chen',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 3))
        }
      ]
    }
  ]);

  const handleResolveComment = (commentId: string, isResolved: boolean) => {
    setComments(prev => prev.map(comment => 
      comment.id === commentId 
        ? { ...comment, isResolved } 
        : comment
    ));
    console.log(`Comment ${commentId} ${isResolved ? 'resolved' : 'unresolved'}`);
  };

  const handleCommentSelect = (comment: Comment) => {
    setActiveCommentId(comment.id);
    console.log('Selected comment:', comment.id);
  };

  const handleReply = async (parentId: string, replyText: string): Promise<void> => {
    const newReply: Comment = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      blockId: 'demo-block',
      authorId: 'current-user',
      authorName: 'Demo User',
      text: replyText,
      createdAt: Timestamp.now(),
      isResolved: false,
      startOffset: 0,
      endOffset: 0,
      parentId: parentId,
      replies: [],
      reactions: []
    };

    setComments(prev => prev.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        };
      }
      return comment;
    }));

    console.log(`Added reply to comment ${parentId}: ${replyText}`);
  };

  const handleReaction = async (commentId: string, emoji: string): Promise<void> => {
    const currentUserId = 'current-user';
    const currentUserName = 'Demo User';

    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        const reactions = comment.reactions || [];
        
        // Check if user already reacted with this emoji
        const existingReactionIndex = reactions.findIndex(
          reaction => reaction.userId === currentUserId && reaction.emoji === emoji
        );
        
        let newReactions;
        if (existingReactionIndex >= 0) {
          // Remove existing reaction (toggle off)
          newReactions = reactions.filter((_, index) => index !== existingReactionIndex);
        } else {
          // Add new reaction
          const newReaction: CommentReaction = {
            id: `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emoji,
            userId: currentUserId,
            userName: currentUserName,
            createdAt: Timestamp.now()
          };
          newReactions = [...reactions, newReaction];
        }
        
        return {
          ...comment,
          reactions: newReactions
        };
      }
      return comment;
    }));

    console.log(`Toggled reaction ${emoji} on comment ${commentId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Enhanced Comment Card Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Showcasing replies, emoji reactions, and improved resolve functionality
          </p>
        </div>

        {/* Features List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            New Features
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Threaded reply system with collapsible threads</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Emoji reactions with user tracking</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Enhanced resolved status with visual badge</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Real-time interaction updates</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Smooth animations and transitions</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Slack/GitHub-style reaction system</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Try the new interactions:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Click the 😊 button to add emoji reactions</li>
            <li>• Click "Reply" to add threaded responses</li>
            <li>• Click existing emoji reactions to toggle them on/off</li>
            <li>• Use the ✓ button to mark comments as resolved (notice the green badge)</li>
            <li>• Expand/collapse reply threads with the arrow buttons</li>
            <li>• Hover over reaction counts to see who reacted</li>
          </ul>
        </div>

        {/* Comment Cards Demo */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Interactive Comment Cards
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} onClick={() => handleCommentSelect(comment)}>
                  <CommentCard
                    comment={comment}
                    onResolve={handleResolveComment}
                    onReply={handleReply}
                    onReaction={handleReaction}
                    isActive={comment.id === activeCommentId}
                    currentUserId="current-user"
                    currentUserName="Demo User"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400 text-sm">
          <p>This demo showcases the enhanced comment system with replies, reactions, and improved resolve functionality.</p>
        </div>
      </div>
    </div>
  );
};

export default CommentCardDemo;
