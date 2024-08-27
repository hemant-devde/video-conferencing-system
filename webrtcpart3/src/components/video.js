import React, { useState, useEffect, useRef } from 'react';

const Video = (props) => {
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [videoVisible, setVideoVisible] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (props.videoStream) {
      videoRef.current.srcObject = props.videoStream;
    }
  }, [props.videoStream]);

  useEffect(() => {
    if (props.videoType === 'remoteVideo' && props.videoStream) {
      const videoTrack = props.videoStream.getVideoTracks();
      if (videoTrack && videoTrack.length) {
        videoTrack[0].onmute = () => {
          setVideoVisible(false);
          props.videoMuted(props.videoStream);
        };

        videoTrack[0].onunmute = () => {
          setVideoVisible(true);
          props.videoMuted(props.videoStream);
        };
      }

      const audioTrack = props.videoStream.getAudioTracks();
      if (audioTrack && audioTrack.length) {
        audioTrack[0].onmute = () => {
          alert('muted');
          setMic(false);
          props.videoMuted(props.videoStream);
        };

        audioTrack[0].onunmute = () => {
          setMic(true);
          props.videoMuted(props.videoStream);
        };
      }
    }
  }, [props.videoType, props.videoStream, props.videoMuted]);

  useEffect(() => {
    if (props.videoStream) {
      videoRef.current.srcObject = props.videoStream;
      
      // Check if audio is playing
      const audioTrack = props.videoStream.getAudioTracks()[0];
      if (audioTrack) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(props.videoStream);
        const analyser = audioContextRef.current.createAnalyser();
        source.connect(analyser);

        const checkAudio = () => {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const sum = data.reduce((a, b) => a + b, 0);
          
          if (sum === 0) {
            setAudioPlaying(false);
            console.log("Audio not playing");
            // You can add additional logic here, like notifying the user
          } else {
            setAudioPlaying(true);
          }
        };

        const intervalId = setInterval(checkAudio, 1000); // Check every second

        return () => {
          clearInterval(intervalId);
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
        };
      }
    }
  }, [props.videoStream]);
  const muteMic = () => {
    const stream = videoRef.current.srcObject.getTracks().filter(track => track.kind === 'audio');
    setMic(prevMic => {
      if (stream && stream.length > 0) stream[0].enabled = !prevMic;
      return !prevMic;
    });
  };

  const muteCamera = () => {
    const stream = videoRef.current.srcObject.getTracks().filter(track => track.kind === 'video');
    setCamera(prevCamera => {
      if (stream && stream.length > 0) stream[0].enabled = !prevCamera;
      return !prevCamera;
    });
  };

  const muteControls = props.showMuteControls && (
    <div>
      <i onClick={muteMic} style={{ cursor: 'pointer', padding: 5, fontSize: 20, color: mic ? 'white' : 'red' }} className='material-icons'>
        {mic ? 'mic' : 'mic_off'}
      </i>
      <i onClick={muteCamera} style={{ cursor: 'pointer', padding: 5, fontSize: 20, color: camera ? 'white' : 'red' }} className='material-icons'>
        {camera ? 'videocam' : 'videocam_off'}
      </i>
    </div>
  );

  return (
    <div
      style={{
        ...props.frameStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // width: '100%',
        // maxWidth: '70%',
        margin: '0 auto',
        padding: '10px',
        boxSizing: 'border-box',

      }}
    >
      <video
        id={props.id}
        muted={props.muted}
        autoPlay
        style={{
          visibility: videoVisible ? 'visible' : 'hidden',
          width: '100%',
          height: 'auto',
          borderRadius: '10px',
          ...props.videoStyles,
        }}
        ref={videoRef}
      ></video>
      {muteControls}
      {!audioPlaying && <div style={{color: 'red'}}>Audio not playing</div>}
    </div>
  );
};

export default Video;