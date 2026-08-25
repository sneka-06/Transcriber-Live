import React from 'react';
import type { Message } from '../types';
import { Mic, Volume2, FileAudio } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isNew?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isNew }) => {
  const isYou = message.speaker === 'You';
  const isUpload = message.speaker === 'Upload';

  const avatarClass = isUpload
    ? 'bubble-avatar-upload'
    : isYou
    ? 'bubble-avatar-you'
    : 'bubble-avatar-others';

  const speakerClass = isUpload
    ? 'bubble-speaker-upload'
    : isYou
    ? 'bubble-speaker-you'
    : 'bubble-speaker-others';

  const textClass = isUpload
    ? 'bubble-text-upload'
    : isYou
    ? 'bubble-text-you'
    : 'bubble-text-others';

  const icon = isUpload
    ? <FileAudio size={15} />
    : isYou
    ? <Mic size={15} />
    : <Volume2 size={15} />;

  const label = isUpload ? 'Upload' : isYou ? 'You' : 'Others';

  return (
    <div className={`message-bubble${isNew ? ' message-enter' : ''}`}>
      <div className={`bubble-avatar ${avatarClass}`}>
        {icon}
      </div>
      <div className="bubble-content">
        <div className="bubble-header">
          <span className={`bubble-speaker ${speakerClass}`}>
            {label}
          </span>
          <span className="bubble-time">{message.createdAt}</span>
        </div>
        <div className={`bubble-text ${textClass}`}>
          {message.text}
        </div>
      </div>
    </div>
  );
};
