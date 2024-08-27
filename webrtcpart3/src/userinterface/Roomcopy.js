import React, { Component } from "react";
import io from "socket.io-client";
import Video from "../components/video";
import Videos from "../components/videos";
import './Room.css'

import Chat from "../components/chat";

import Draggable from "../components/draggable";

class Room extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null, // used to hold local stream object to avoid recreating the stream everytime a new offer comes
      remoteStream: null, // used to hold remote stream object that is displayed in the main screen

      remoteStreams: [], // holds all Video Streams (all remote streams)
      peerConnections: {}, // holds all Peer Connections
      selectedVideo: null,

      status: "Please wait...",
      isChatVisible: window.innerWidth > 768,
      windowWidth: window.innerWidth,

      // pc_config: {
      //   "iceServers": [
      //     {
      //       urls : 'stun:stun.l.google.com:19302'
      //     }
      //   ]
      // },

      pc_config: null,

      sdpConstraints: {
        mandatory: {
          OfferToReceiveAudio: false,
          OfferToReceiveVideo: true,
        },
      },

      messages: [],
      sendChannels: [],
      disconnected: false,
      username: "", // Added to store username
    };

    // DONT FORGET TO CHANGE TO YOUR URL
    // this.serviceIP = 'https://26a3-223-236-7-210.ngrok-free.app/webrtcPeer'
    this.serviceIP = "http://localhost:8080/webrtcPeer";

    this.socket = null;
    // this.candidates = []
  }

  getLocalStream = () => {
    const success = (stream) => {
      window.localStream = stream;
      // this.localVideoref.current.srcObject = stream
      // this.pc.addStream(stream);
      this.setState({
        localStream: stream,
      });

      this.whoisOnline();
    };

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log("getUserMedia Error: ", e);
    };

    const constraints = {
      audio: false,
      video: true,

      options: {
        mirror: true,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  whoisOnline = () => {
    // let all peers know I am joining
    this.sendToPeer("onlinePeers", null, { local: this.socket.id });
  };

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload,
    });
  };

  createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config);

      // add pc to peerConnections object
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc };
      this.setState({
        peerConnections,
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id,
            remote: socketID,
          });
        }
      };

      pc.oniceconnectionstatechange = (e) => {
        // if (pc.iceConnectionState === 'disconnected') {
        //   const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== socketID)
        //   this.setState({
        //     remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
        //   })
        // }
      };

      pc.ontrack = (e) => {
        let _remoteStream = null;
        let remoteStreams = this.state.remoteStreams;
        let remoteVideo = {};

        // 1. check if stream already exists in remoteStreams
        const rVideos = this.state.remoteStreams.filter(
          (stream) => stream.id === socketID
        );

        // 2. if it does exist then add track
        if (rVideos.length) {
          _remoteStream = rVideos[0].stream;
          _remoteStream.addTrack(e.track, _remoteStream);

          remoteVideo = {
            ...rVideos[0],
            stream: _remoteStream,
          };
          remoteStreams = this.state.remoteStreams.map((_remoteVideo) => {
            return (
              (_remoteVideo.id === remoteVideo.id && remoteVideo) ||
              _remoteVideo
            );
          });
        } else {
          // 3. if not, then create new stream and add track
          _remoteStream = new MediaStream();
          _remoteStream.addTrack(e.track, _remoteStream);

          remoteVideo = {
            id: socketID,
            name: socketID,
            stream: _remoteStream,
          };
          remoteStreams = [...this.state.remoteStreams, remoteVideo];
        }

        // const remoteVideo = {
        //   id: socketID,
        //   name: socketID,
        //   stream: e.streams[0]
        // }

        this.setState((prevState) => {
          // If we already have a stream in display let it stay the same, otherwise use the latest stream
          // const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] }
          const remoteStream =
            prevState.remoteStreams.length > 0
              ? {}
              : { remoteStream: _remoteStream };

          // get currently selected video
          let selectedVideo = prevState.remoteStreams.filter(
            (stream) => stream.id === prevState.selectedVideo.id
          );
          // if the video is still in the list, then do nothing, otherwise set to new video stream
          selectedVideo = selectedVideo.length
            ? {}
            : { selectedVideo: remoteVideo };

          return {
            // selectedVideo: remoteVideo,
            ...selectedVideo,
            // remoteStream: e.streams[0],
            ...remoteStream,
            remoteStreams, //: [...prevState.remoteStreams, remoteVideo]
          };
        });
      };

      pc.close = () => {
        // alert('GONE')
        console.log("pc closed");
      };

      if (this.state.localStream)
        // pc.addStream(this.state.localStream)

        this.state.localStream.getTracks().forEach((track) => {
          console.log(this.state.localStream);
          
          pc.addTrack(track, this.state.localStream);
        });

      // return pc
      callback(pc);
    } catch (e) {
      console.log("Something went wrong! pc not created!!", e);
      // return;
      callback(null);
    }
  };

  componentDidMount = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const username = queryParams.get("username");

    this.setState({ username }); // Set username from query params

    console.log(username);
    // console.log("user :", name);

    this.socket = io.connect(this.serviceIP, {
      path: "/io/webrtc",
      query: {
        room: window.location.pathname.split("/")[2],
        username: username,
      },
    });

    this.socket.on("connection-success", (data) => {
      this.getLocalStream();

      // console.log(data.success)
      const status =
        data.peerCount > 1
          ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
          : "Waiting for other peers to connect";

      this.setState({
        status: status,
        messages: data.messages,
      });
    });

    this.socket.on("joined-peers", (data) => {
      this.setState({
        status:
          data.peerCount > 1
            ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
            : "Waiting for other peers to connect",
      });
    });

    this.socket.on("peer-disconnected", (data) => {
      // close peer-connection with this peer
      this.state.peerConnections[data.socketID].close();

      // get and stop remote audio and video tracks of the disconnected peer
      const rVideo = this.state.remoteStreams.filter(
        (stream) => stream.id === data.socketID
      );
      rVideo && this.stopTracks(rVideo[0].stream);

      // filter out the disconnected peer stream
      const remoteStreams = this.state.remoteStreams.filter(
        (stream) => stream.id !== data.socketID
      );

      this.setState((prevState) => {
        // check if disconnected peer is the selected video and if there still connected peers, then select the first
        const selectedVideo =
          prevState.selectedVideo.id === data.socketID && remoteStreams.length
            ? { selectedVideo: remoteStreams[0] }
            : null;

        return {
          // remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
          remoteStreams,
          ...selectedVideo,
          status:
            data.peerCount > 1
              ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
              : "Waiting for other peers to connect",
        };
      });
    });

    // this.socket.on('offerOrAnswer', (sdp) => {

    //   this.textref.value = JSON.stringify(sdp)

    //   // set sdp as remote description
    //   this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    // })

    this.socket.on("online-peer", (socketID) => {
      // console.log('connected peers ...', socketID)

      // create and send offer to the peer (data.socketID)
      // 1. Create new pc
      this.createPeerConnection(socketID, (pc) => {
        // 2. Create Offer
        if (pc) {
          // Send Channel
          const handleSendChannelStatusChange = (event) => {
            console.log(
              "send channel status: " + this.state.sendChannels[0].readyState
            );
          };

          const sendChannel = pc.createDataChannel("sendChannel");
          sendChannel.onopen = handleSendChannelStatusChange;
          sendChannel.onclose = handleSendChannelStatusChange;

          this.setState((prevState) => {
            return {
              sendChannels: [...prevState.sendChannels, sendChannel],
            };
          });

          // Receive Channels
          const handleReceiveMessage = (event) => {
            const message = JSON.parse(event.data);
            // console.log(message)
            this.setState((prevState) => {
              return {
                messages: [...prevState.messages, message],
              };
            });
          };

          const handleReceiveChannelStatusChange = (event) => {
            if (this.receiveChannel) {
              console.log(
                "receive channel's status has changed to " +
                  this.receiveChannel.readyState
              );
            }
          };

          const receiveChannelCallback = (event) => {
            const receiveChannel = event.channel;
            receiveChannel.onmessage = handleReceiveMessage;
            receiveChannel.onopen = handleReceiveChannelStatusChange;
            receiveChannel.onclose = handleReceiveChannelStatusChange;
          };

          pc.ondatachannel = receiveChannelCallback;

          pc.createOffer(this.state.sdpConstraints).then((sdp) => {
            pc.setLocalDescription(sdp);

            this.sendToPeer("offer", sdp, {
              local: this.socket.id,
              remote: socketID,
            });
          });
        }
      });
    });

    this.socket.on("offer", (data) => {
      this.createPeerConnection(data.socketID, (pc) => {
        pc.addStream(this.state.localStream);

        // Send Channel
        const handleSendChannelStatusChange = (event) => {
          console.log(
            "send channel status: " + this.state.sendChannels[0].readyState
          );
        };

        const sendChannel = pc.createDataChannel("sendChannel");
        sendChannel.onopen = handleSendChannelStatusChange;
        sendChannel.onclose = handleSendChannelStatusChange;

        this.setState((prevState) => {
          return {
            sendChannels: [...prevState.sendChannels, sendChannel],
          };
        });

        // Receive Channels
        const handleReceiveMessage = (event) => {
          const message = JSON.parse(event.data);
          // console.log(message)
          this.setState((prevState) => {
            return {
              messages: [...prevState.messages, message],
            };
          });
        };

        const handleReceiveChannelStatusChange = (event) => {
          if (this.receiveChannel) {
            console.log(
              "receive channel's status has changed to " +
                this.receiveChannel.readyState
            );
          }
        };

        const receiveChannelCallback = (event) => {
          const receiveChannel = event.channel;
          receiveChannel.onmessage = handleReceiveMessage;
          receiveChannel.onopen = handleReceiveChannelStatusChange;
          receiveChannel.onclose = handleReceiveChannelStatusChange;
        };

        pc.ondatachannel = receiveChannelCallback;

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
          () => {
            // 2. Create Answer
            pc.createAnswer(this.state.sdpConstraints).then((sdp) => {
              pc.setLocalDescription(sdp);

              this.sendToPeer("answer", sdp, {
                local: this.socket.id,
                remote: data.socketID,
              });
            });
          }
        );
      });
    });

    this.socket.on("answer", (data) => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID];
      // console.log(data.sdp)
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
        () => {}
      );
    });

    this.socket.on("candidate", (data) => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID];

      if (pc) pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });
  };

  // ************************************* //
  disconnectSocket = (socketToDisconnect) => {
    this.sendToPeer("socket-to-disconnect", null, {
      local: this.socket.id,
      remote: socketToDisconnect,
    });
  };

  switchVideo = (_video) => {
    // console.log(_video)
    this.setState({
      selectedVideo: _video,
    });
  };

  stopTracks = (stream) => {
    stream.getTracks().forEach((track) => track.stop());
  };

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  handleResize = () => {
    this.setState({
      windowWidth: window.innerWidth,
      isChatVisible: window.innerWidth > 768
    });
  };

  toggleChat = () => {
    this.setState(prevState => ({
      isChatVisible: !prevState.isChatVisible
    }));
  };
  render() {
    const {
      status,
      messages,
      disconnected,
      localStream,
      peerConnections,
      remoteStreams,
      username, // Access username here
      isChatVisible, windowWidth
    } = this.state;

    if (disconnected) {
      // disconnect socket
      this.socket.close();
      // stop local audio & video tracks
      this.stopTracks(localStream);

      // stop all remote audio & video tracks
      remoteStreams.forEach((rVideo) => this.stopTracks(rVideo.stream));

      // stop all remote peerconnections
      peerConnections &&
        Object.values(peerConnections).forEach((pc) => pc.close());

      return <div>You have successfully Disconnected</div>;
    }

    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{status}</div>
    );

    return (
        <div className={`room-page-container ${isChatVisible ? 'chat-visible' : ''}`}>
        <Draggable
          bounds="parent"
          defaultPosition={{x: windowWidth - 280, y: 20}}
        >
          <div className="local-video-container">
            <Video
              videoType="localVideo"
              videoStream={localStream}
              muted={true}
              autoPlay={true}
            />
          </div>
        </Draggable>

        <div className="videos-container">
          <Videos remoteStreams={remoteStreams} />
        </div>

        <div className={`chat-container ${isChatVisible ? 'visible' : ''}`}>
          <Chat
            user={{ username: username }}
            messages={messages}
            sendMessage={sendMessage}
          />
        </div>

        {windowWidth <= 768 && (
          <button className="chat-toggle-btn" onClick={this.toggleChat}>
            {isChatVisible ? 'Hide Chat' : 'Show Chat'}
          </button>
        )}
      </div>
    );
  }
}

export default Room;
