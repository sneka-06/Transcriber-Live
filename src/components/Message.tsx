type MessageProps = {
  speaker?: string;
  text?: string;
  createdAt?: string;
};

function Message({
  speaker = "Unknown",
  text = "",
  createdAt = "",
}: MessageProps) {
  return (
    <div className="message">
      <div className="message-header">
        <h3>{speaker}</h3>

        <span>{createdAt}</span>
      </div>

      <p>{text}</p>
    </div>
  );
}

export default Message;