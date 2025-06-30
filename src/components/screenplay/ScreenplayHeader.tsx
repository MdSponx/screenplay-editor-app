import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import SaveButton from './SaveButton';

interface ScreenplayHeaderProps {
  projectId: string | undefined;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  onSave: () => Promise<any>;
  isSaving: boolean;
  hasChanges: boolean;
  isDarkMode: boolean;
}

const ScreenplayHeader: React.FC<ScreenplayHeaderProps> = ({
  projectId,
  documentTitle,
  setDocumentTitle,
  onSave,
  isSaving,
  hasChanges,
  isDarkMode,
}) => {
  const navigate = useNavigate();
  const [projectTitle, setProjectTitle] = useState('');

  // Fetch project title
  useEffect(() => {
    const fetchProjectTitle = async () => {
      if (!projectId) return;

      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          setProjectTitle(projectSnap.data().title);
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      }
    };

    fetchProjectTitle();
  }, [projectId]);

  const handleBack = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/writing`);
    } else {
      navigate('/projects');
    }
  };

  // Mock collaborators data
  const collaborators = [
    { id: 3, name: 'Mike Johnson', isActive: true, color: 'bg-orange-500' },
    { id: 2, name: 'Sarah Chen', isActive: true, color: 'bg-green-500' },
    { id: 1, name: 'You', isActive: true, color: 'bg-blue-500' },
  ];

  return (
    <div className="h-16 flex items-center border-b border-[#577B92]/20">
      {/* Left Section with Back Button, Logo and Title */}
      <div className="flex items-center flex-1 space-x-4">
        <button
          onClick={handleBack}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode
              ? 'text-[#F5F5F2] hover:bg-[#577B92]/20'
              : 'text-[#1E4D3A] hover:bg-[#577B92]/10'
          }`}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => navigate('/')}
          className={`text-2xl font-semibold px-4 py-1 rounded-full font-mukta transition-colors duration-200
            ${
              isDarkMode
                ? 'bg-[#F5F5F2] text-[#1E4D3A] hover:bg-[#E8E8E5]'
                : 'bg-[#1E4D3A] text-[#F5F5F2] hover:bg-[#1A4433]'
            }`}
        >
          LiQid
        </button>
        <div className="h-4 w-px bg-[#577B92]/20" />
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            className={`text-lg font-medium bg-transparent border-b-2 border-transparent hover:border-[#577B92]/30 focus:border-[#E86F2C] focus:outline-none transition-colors duration-200 ${
              isDarkMode ? 'text-[#F5F5F2]' : 'text-[#1E4D3A]'
            } px-2 py-1`}
            placeholder={projectTitle}
          />
        </div>
      </div>

      {/* Right Section with Save Button and Collaborators */}
      <div className="flex items-center space-x-3">
        {/* Save Button */}
        <SaveButton 
          onSave={onSave} 
          isSaving={isSaving} 
          hasChanges={hasChanges} 
          className="px-4 py-1.5 rounded-lg flex items-center"
        />
        
        {/* Collaborators */}
        <div className="flex -space-x-2">
          {collaborators.map((user) => (
            <div key={user.id} className="relative group">
              <button className={`p-2 rounded-full ${user.color} text-white`}>
                <User size={16} />
              </button>
              <span className="absolute top-10 right-0 w-max bg-[#1E4D3A] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {user.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScreenplayHeader;