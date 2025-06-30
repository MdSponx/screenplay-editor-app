import React, { useState } from 'react';
import { Layers, Users, Type } from 'lucide-react';
import SceneNavigator from './SceneNavigator/SceneNavigator';
import CharacterManager from './CharacterManager/CharacterManager';

interface ScreenplayManagePanelProps {
  projectId: string;
  screenplayId: string;
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

type TabType = 'scenes' | 'characters' | 'headings';

const ScreenplayManagePanel: React.FC<ScreenplayManagePanelProps> = ({
  projectId,
  screenplayId,
  activeSceneId,
  onSelectScene,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('scenes');

  return (
    <div className="fixed left-0 top-28 bottom-0 z-10 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-80 flex flex-col shadow-lg">
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'scenes' && (
          <SceneNavigator
            projectId={projectId}
            screenplayId={screenplayId}
            activeSceneId={activeSceneId}
            onSelectScene={onSelectScene}
          />
        )}
        {activeTab === 'characters' && (
          <CharacterManager
            projectId={projectId}
            screenplayId={screenplayId}
          />
        )}
        {activeTab === 'headings' && (
          <div className="p-4 h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>Scene Heading Management (Coming Soon)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenplayManagePanel;