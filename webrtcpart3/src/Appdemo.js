import React, { Component } from 'react';
import './App.css';
import Video from './components/video';
import Videos from './components/videos';
import Chat from './components/chat';
import Draggable from './components/draggable';
import WebRTCManager from './providers/WebRTCManager';
import SocketManager from './providers/SocketManager';

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null,
      remoteStream: null,
      remoteStreams: [],
      peerConnections: {},
      selectedVideo: null,
      status: 'Please wait...',
      pc_config: null,
      sdpConstraints: {
        'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true
        }
      },
      messages: [],
      sendChannels: [],
      disconnected: false,
    };

    this.serviceIP = 'http://localhost:8080/webrtcPeer';
    this.socket = null;
  }

  getLocalStream = () => {
    const success = (stream) => {
      window.localStream = stream;
      this.setState({
        localStream: stream
      });
      this.whoisOnline();
    };

    const failure = (e) => {
      console.log('getUserMedia Error: ', e);
    };

    const constraints = {
      audio: true,
      video: true,
      options: {
        mirror: true,
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure);
  }

  whoisOnline = () => {
    this.sendToPeer('onlinePeers', null, {local: this.socket.id});
  }

  sendToPeer = (messageType, payload, socketID) => {
    this.socketManager.sendToPeer(messageType, payload, socketID);
  }

  componentDidMount = () => {
    this.getLocalStream();
  }

  disconnectSocket = (socketToDisconnect) => {
    this.sendToPeer('socket-to-disconnect', null, {
      local: this.socket.id,
      remote: socketToDisconnect
    });
  }

  switchVideo = (_video) => {
    this.setState({
      selectedVideo: _video
    });
  }

  stopTracks = (stream) => {
    stream.getTracks().forEach(track => track.stop());
  }

  onConnectionSuccess = (data) => {
    const status = data.peerCount > 1 ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}` : 'Waiting for other peers to connect';
    this.setState({
      status: status,
      messages: data.messages
    });
  }

  onJoinedPeers = (data) => {
    const status = data.peerCount > 1 ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}` : 'Waiting for other peers to connect';
    this.setState({
      status: status
    });
  }

  onPeerDisconnected = (data) => {
    // Existing peer disconnection logic
  }

  onOnlinePeer = (socketID) => {
    this.webRTCManager.createPeerConnection(socketID, pc => {
      if (pc) {
        pc.createOffer(this.state.sdpConstraints)
          .then(sdp => {
            pc.setLocalDescription(sdp);
            this.sendToPeer('offer', sdp, {
              local: this.socket.id,
              remote: socketID
            });
          });
      }
    });
  }

  onOffer = (data) => {
    this.webRTCManager.createPeerConnection(data.socketID, pc => {
      pc.addStream(this.state.localStream);
      this.webRTCManager.setRemoteDescription(pc, data.sdp)
        .then(() => {
          pc.createAnswer(this.state.sdpConstraints)
            .then(sdp => {
              pc.setLocalDescription(sdp);
              this.sendToPeer('answer', sdp, {
                local: this.socket.id,
                remote: data.socketID
              });
            });
        });
    });
  }

  onAnswer = (data) => {
    const pc = this.state.peerConnections[data.socketID];
    this.webRTCManager.setRemoteDescription(pc, data.sdp);
  }

  onCandidate = (data) => {
    const pc = this.state.peerConnections[data.socketID];
    this.webRTCManager.addIceCandidate(pc, data.candidate);
  }

  render() {
    const {
      status,
      messages,
      disconnected,
      localStream,
      peerConnections,
      remoteStreams,
    } = this.state;

    if (disconnected) {
      this.socketManager.close();
      this.stopTracks(localStream);
      remoteStreams.forEach(rVideo => this.stopTracks(rVideo.stream));
      peerConnections && Object.values(peerConnections).forEach(pc => pc.close());
      return (<div>You have successfully Disconnected</div>);
    }

    const statusText = <div style={{ color: 'yellow', padding: 5 }}>{status}</div>;

    return (
      <div>
        <Draggable style={{
          zIndex: 101,
          position: 'absolute',
          right: 0,
          cursor: 'move'
        }}>
          <Video
            videoType='localVideo'
            videoStyles={{
              width: 200,
            }}
            frameStyle={{
              width: 200,
              margin: 5,
              borderRadius: 5,
              backgroundColor: 'black',
            }}
            showMuteControls={true}
            videoStream={localStream}
            autoPlay muted>
          </Video>
        </Draggable>
        <br />
        <div style={{
          zIndex: 3,
          position: 'absolute',
        }}>
          <i onClick={(e) => {this.setState({disconnected: true})}} style={{ cursor: 'pointer', paddingLeft: 15, color: 'red' }} className='material-icons'>Exit</i>
          <div style={{
            margin: 10,
            backgroundColor: '#cdc4ff4f',
            padding: 10,
            borderRadius: 5,
          }}>{ statusText }</div>
        </div>
        <div>
          <Videos
            switchVideo={this.switchVideo}
            remoteStreams={remoteStreams}
          ></Videos>
        </div>
        <br />
        <Chat
          user={{
            uid: this.socket && this.socket.id || ''
          }}
          messages={messages}
          sendMessage={(message) => {
            this.setState(prevState => {
              return {messages: [...prevState.messages, message]};
            });
            this.state.sendChannels.map(sendChannel => {
              sendChannel.readyState === 'open' && sendChannel.send(JSON.stringify(message));
            });
            this.sendToPeer('new-message', JSON.stringify(message), {local: this.socket.id});
          }}
        />
        <WebRTCManager
          ref={(ref) => { this.webRTCManager = ref; }}
          pcConfig={this.state.pc_config}
          socketId={this.socket ? this.socket.id : null}
          localStream={this.state.localStream}
          sendToPeer={this.sendToPeer}
          handleTrack={this.handleTrack}
          handleReceiveMessage={this.handleReceiveMessage}
        />
        <SocketManager
          ref={(ref) => { this.socketManager = ref; }}
          onConnectionSuccess={this.onConnectionSuccess}
          onJoinedPeers={this.onJoinedPeers}
          onPeerDisconnected={this.onPeerDisconnected}
          onOnlinePeer={this.onOnlinePeer}
          onOffer={this.onOffer}
          onAnswer={this.onAnswer}
          onCandidate={this.onCandidate}
        />
      </div>
    );
  }
}

export default App;