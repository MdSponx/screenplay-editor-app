import React, { useState } from 'react';
import CommentCard from './ScreenplayEditor/CommentCard';
import { Comment } from '../types';
import { Timestamp } from 'firebase/firestore';

const CommentCardDemo: React.FC = () => {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Sample comments data to demonstrate the redesigned cards
  const sampleComments: Comment[] = [
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
      highlightedText: 'This is dialogue for scene 1. The character is saying something important to the story.'
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
      highlightedText: 'INT. COFFEE SHOP - DAY'
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
      highlightedText: 'The character runs through the crowded street, dodging cars and pedestrians as the sound of sirens grows louder behind them.'
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
      highlightedText: 'ALEX enters the room with confidence, adjusting their tie and scanning the crowd with sharp, calculating eyes.'
    }
  ];

  const handleResolveComment = (commentId: string, isResolved: boolean) => {
    console.log(`Comment ${commentId} ${isResolved ? 'resolved' : 'unresolved'}`);
    // In a real app, this would update the comment in the database
  };

  const handleCommentSelect = (comment: Comment) => {
    setActiveCommentId(comment.id);
    console.log('Selected comment:', comment.id);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Comment Card Redesign Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Showcasing the new Google Docs-inspired comment card design
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
                <span className="text-gray-700 dark:text-gray-300">Highlighted text with vertical bar prefix</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">User profile images from database</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Emoji reactions, resolve, and more options</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Click-to-expand reply system</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Smooth animations and transitions</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#E86F2C] rounded-full mr-2"></div>
                <span className="text-gray-700 dark:text-gray-300">Clean Google Docs-inspired layout</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Try the interactions:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Hover over cards to see the reply button appear</li>
            <li>• Click "Reply" to expand the reply input</li>
            <li>• Click the resolve button (✓) to mark comments as resolved</li>
            <li>• Try the emoji and more options buttons</li>
            <li>• Notice the smooth scaling when reply input is active</li>
          </ul>
        </div>

        {/* Comment Cards Demo */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sample Comment Cards
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="space-y-4">
              {sampleComments.map((comment) => (
                <div key={comment.id} onClick={() => handleCommentSelect(comment)}>
                  <CommentCard
                    comment={comment}
                    onResolve={handleResolveComment}
                    isActive={comment.id === activeCommentId}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400 text-sm">
          <p>This demo showcases the redesigned comment cards used in the LiQid screenplay editor.</p>
        </div>
      </div>
    </div>
  );
};

export default CommentCardDemo;
