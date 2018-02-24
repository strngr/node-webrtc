/* eslint no-console:0 */
'use strict';

const { test } = require('tape');

test('Bridge Example', t => {
  const host = window.location.host.split(':')[0];
  const bridge = window.location.toString().split('?')[1] || host + ':8080';

  const dataChannelSettings = {
    'reliable': {
      ordered: false,
      maxRetransmits: 10
    },
  };

  const pendingDataChannels = {};
  const dataChannels = {};
  const pendingCandidates = [];

  function doHandleError(error) {
    throw error;
  }

  function doComplete() {
    console.log('complete');
    const data = new Uint8Array([97, 99, 107, 0]);
    dataChannels.reliable.send(data.buffer);
    dataChannels.reliable.send('Hello bridge!');
    t.pass('it worked');
    t.end();
  }

  function doWaitforDataChannels() {
    console.log('awaiting data channels');
  }

  let ws;
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  pc.onsignalingstatechange = () => {
    console.info('signaling state change: ', pc.signalingState);
  };

  pc.oniceconnectionstatechange = () => {
    console.info('ice connection state change: ', pc.iceConnectionState);
  };

  pc.onicegatheringstatechange = () => {
    console.info('ice gathering state change: ', pc.iceGatheringState);
  };

  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    if (WebSocket.OPEN === ws.readyState) {
      ws.send(JSON.stringify({
        type: 'ice',
        sdp: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
      }));
    } else {
      pendingCandidates.push(candidate);
    }
  };

  doCreateDataChannels();

  function doCreateDataChannels() {
    const labels = Object.keys(dataChannelSettings);

    labels.forEach(label => {
      const channelOptions = dataChannelSettings[label];
      const channel = pendingDataChannels[label] = pc.createDataChannel(label, channelOptions);

      channel.binaryType = 'arraybuffer';

      channel.onopen = function() {
        console.info('onopen');
        dataChannels[label] = channel;
        delete pendingDataChannels[label];
        if (Object.keys(dataChannels).length === labels.length) {
          doComplete();
        }
      };

      channel.onmessage = ({ data }) => {
        if (typeof data === 'string') {
          console.log('onmessage:', data);
        } else {
          console.log('onmessage:', new Uint8Array(data));
        }
      };

      channel.onclose = function() {
        console.info('onclose');
      };

      channel.onerror = doHandleError;
    });

    doCreateOffer();
  }

  function doCreateOffer() {
    pc.createOffer(
      doSetLocalDesc,
      doHandleError
    );
  }

  function doSetLocalDesc(desc) {
    pc.setLocalDescription(
      new RTCSessionDescription(desc),
      doSendOffer.bind(null, desc),
      doHandleError
    );
  }

  function doSendOffer(offer) {
    ws = new WebSocket('ws://' + bridge);
    ws.onopen = () => {
      pendingCandidates.forEach(candidate => {
        ws.send(JSON.stringify({
          type: 'ice',
          sdp: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex
          }
        }));
      });

      ws.send(JSON.stringify({
        type: offer.type,
        sdp: offer.sdp
      }));
    };

    ws.onmessage = ({ data }) => {
      data = JSON.parse(data);
      if (data.type === 'answer') {
        doSetRemoteDesc(data);
      } else if (data.type === 'ice') {
        if (data.sdp.candidate) {
          const candidate = new RTCIceCandidate(data.sdp);
          pc.addIceCandidate(candidate, handleAddIceCandidateSuccess, handleAddIceCandidateError);
        }
      }
    };
  }

  function handleAddIceCandidateSuccess() {}

  function handleAddIceCandidateError() {}

  function doSetRemoteDesc(desc) {
    pc.setRemoteDescription(
      new RTCSessionDescription(desc),
      doWaitforDataChannels,
      doHandleError
    );
  }

});
