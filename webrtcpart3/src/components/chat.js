import React, { useState, useEffect } from "react";
import DragDrop from "./dragDrop.js";
import { Resizable } from "react-resizable";
import './chat.css'
import 'react-resizable/css/styles.css';
import { useNavigate } from "react-router-dom";

const Chat = ({ user, messages, sendMessage }) => {
  const [message, setMessage] = useState("");
  const [imageZoom, setImageZoom] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(true);

  const toggleChat = () => {
    // setIsChatVisible(!isChatVisible);
    setIsChatVisible(prevState => !prevState);
  };

  const scrollToBottom = () => {
    const chat = document.getElementById("chatList");
    // chat.scrollTop = chat.scrollHeight;
    if (chat) chat.scrollTop = chat.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle screen resizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsChatVisible(false); // Hide chat box on small screens
      } else {
        setIsChatVisible(true); // Show chat box on larger screens
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSubmit = (event) => {
    if (message === "") return;
    event.preventDefault();

    sendMessage({
      type: "text",
      message: {
        id: user.uid,
        sender: { uid: user.uid, username: user.username },
        data: { text: message },
      },
    });
    setMessage("");
  };

  const handleChange = (event) => {
    
    setMessage(event.target.value);
  };

  const renderMessage = (userType, data) => {
    const {
      sender,
      data: { text, image },
    } = data.message;

    const messageClass = userType === "self" ? "message-self" : "message-other";

    return (
      <li className={messageClass}>
        <p className="sender">{sender.username || sender.uid}</p>
        {data.type === "text" ? (
          <div className="message-bubble">{text}</div>
        ) : (
          <img
            onClick={() => {
              setImageZoom(true);
              setSelectedImage(image);
            }}
            className="message-image"
            src={image}
            alt="Sent image"
          />
        )}
      </li>
    );
  };

  const showEnlargedImage = (data) => (
    <div className="image-zoom-container" onClick={() => setImageZoom(false)}>
      <img className="image-zoom" src={data} alt="Zoomed image" />
    </div>
  );



  return (
    <div>
      {imageZoom && showEnlargedImage(selectedImage)}
      <button 
      className="chat-toggle-btn"
      onClick={toggleChat}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 11,
        display: 'none', // Hide by default, we'll show it on small screens with CSS
      }}
    >
      {isChatVisible ? 'Hide Chat' : 'Show Chat'}
    </button>
   
      <div
         className={`chatWindow ${isChatVisible ? 'visible' : 'hidden'}`}
        style={{
          zIndex: 10,
          position: "fixed",
          right: 5,
          top: 300,
          bottom: 25,
          width: '30%',  minWidth: '300px',
          maxHeight:'450px',
          minHeight:'100px',
          maxWidth: '450px',
          borderRadius: "10px",
          boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
          backgroundColor: "#f9f9f9",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ul className="chat" id="chatList" style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {messages.map((data) => (
            <div key={data.id}>
              {user.uid === data.message.sender.uid
                ? renderMessage("self", data)
                : renderMessage("other", data)}
            </div>
          ))}
        </ul>
        <DragDrop
          className="chatInputWrapper"
          sendFiles={(files) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const maximumMessageSize = 262118;
              if (e.target.result.length <= maximumMessageSize)
                sendMessage({
                  type: "image",
                  message: {
                    id: user.uid,
                    sender: { uid: user.uid },
                    data: e.target.result,
                  },
                });
              else alert("Message exceeds Maximum Message Size!");
            };
            reader.readAsDataURL(files[0]);
          }}
        >
          <div style={{ padding: "10px", borderTop: "1px solid #ddd" }}>
            <form onSubmit={handleSubmit}>
              <input
                className="textarea input"
                type="text"
                placeholder="Enter your message..."
                onChange={handleChange}
                value={message}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                  outline: "none",
                  boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.1)",
                }}
              />
            </form>
          </div>
        </DragDrop>
      </div>
    </div>
  );
};

export default Chat;
