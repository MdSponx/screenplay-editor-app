import React from 'react';
import ScrollableScreenplayContainer from './ScrollableScreenplayContainer';

const ScrollableScreenplayExample: React.FC = () => {
  // Sample screenplay content with scene headings and blocks
  const generateSampleContent = () => {
    const scenes = [];
    
    for (let i = 1; i <= 10; i++) {
      scenes.push(
        <div key={`scene-${i}`} className="mb-8">
          <div 
            className="font-bold uppercase mb-4" 
            data-block-type="scene-heading"
            data-scene-number={i}
          >
            {i % 2 === 0 ? 'EXT.' : 'INT.'} LOCATION {i} - {i % 3 === 0 ? 'NIGHT' : 'DAY'}
          </div>
          
          <div className="mb-4">
            {`This is the action description for scene ${i}. It describes what's happening in the scene.`}
          </div>
          
          <div className="text-center uppercase font-semibold mb-2">
            CHARACTER NAME
          </div>
          
          <div className="w-4/5 mx-auto mb-4">
            {`This is dialogue for scene ${i}. The character is saying something important to the story.`}
          </div>
          
          <div className="mb-4">
            {`More action description follows. This helps to build out the scene and make it feel more complete.`}
          </div>
          
          {i % 2 === 0 && (
            <>
              <div className="text-center uppercase font-semibold mb-2">
                ANOTHER CHARACTER
              </div>
              
              <div className="w-4/5 mx-auto mb-4">
                {`This is a response from another character in scene ${i}. They're having a conversation.`}
              </div>
            </>
          )}
        </div>
      );
    }
    
    return scenes;
  };

  return (
    <ScrollableScreenplayContainer 
      title="My Screenplay"
      isDarkMode={false}
    >
      <div className="max-w-4xl mx-auto p-8">
        {generateSampleContent()}
      </div>
    </ScrollableScreenplayContainer>
  );
};

export default ScrollableScreenplayExample;