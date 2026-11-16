import React from "react";
import { AiInputsPanel } from "./AiInputsPanel";
import { AiOutputPanel } from "./AiOutputPanel";
import { useAIStudyAssistant, type AIStudyAssistantInitialProps } from "./useAIStudyAssistant";

export const AIStudyAssistantPage: React.FC<AIStudyAssistantInitialProps> = (props) => {
  const assistant = useAIStudyAssistant(props);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AiInputsPanel assistant={assistant} />
        <AiOutputPanel assistant={assistant} />
      </div>
    </div>
  );
};
