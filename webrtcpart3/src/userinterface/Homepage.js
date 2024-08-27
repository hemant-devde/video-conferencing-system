import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Homepage = () => {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    // Check if room ID and username are provided
    if (roomId.trim() && name.trim()) {
      // Redirect to the meeting room with roomID and username as query params
      navigate(`/room/${roomId}?username=${encodeURIComponent(name)}`);
    } else {
      alert("Please enter both room ID and username.");
    }
  };

  return (
    <div className="homepage-container">
      <div className="input-container">
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={handleJoin}>Join</button>
      </div>
    </div>
  );
};

export default Homepage;
