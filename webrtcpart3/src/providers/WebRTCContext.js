import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [peerConnections, setPeerConnections] = useState({});
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io.connect('http://localhost:8080/webrtcPeer', {
      path: '/io/webrtc',
      query: {
        room: window.location.pathname.split('/')[2],
        username: new URLSearchParams(window.location.search).get('username'),
      },
    });
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // WebRTC logic functions
  const getLocalStream = () => {
    const constraints = { audio: true, video: true, options: { mirror: true } };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        setLocalStream(stream);
        whoisOnline();
      })
      .catch(e => console.log('getUserMedia Error: ', e));
  };

  const createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(null);

      // Set up event handlers for the RTCPeerConnection
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendToPeer('candidate', e.candidate, {
            local: socket.id,
            remote: socketID,
          });
        }
      };

      pc.ontrack = (e) => {
        // Handle incoming tracks
        setRemoteStreams(prev => {
          const existingStream = prev.find(stream => stream.id === socketID);
          if (existingStream) {
            existingStream.stream.addTrack(e.track);
            return [...prev];
          } else {
            const newStream = new MediaStream();
            newStream.addTrack(e.track);
            return [...prev, { id: socketID, stream: newStream }];
          }
        });
      };

      // Add local stream to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      setPeerConnections(prev => ({ ...prev, [socketID]: pc }));
      callback(pc);
    } catch (e) {
      console.log('Error creating PeerConnection:', e);
      callback(null);
    }
  };

  const sendToPeer = (messageType, payload, socketID) => {
    socket.emit(messageType, {
      socketID,
      payload,
    });
  };

  const whoisOnline = () => {
    sendToPeer('onlinePeers', null, { local: socket.id });
  };

  // Expose the WebRTC methods and state
  const webRTCMethods = {
    getLocalStream,
    createPeerConnection,
    sendToPeer,
    whoisOnline,
  };

  return (
    <WebRTCContext.Provider value={{ 
      localStream, 
      remoteStreams, 
      peerConnections,
      socket,
      ...webRTCMethods 
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => useContext(WebRTCContext);