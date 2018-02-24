/* eslint no-console:0 */
'use strict';

const express = require('express');
const expressBrowserify = require('express-browserify');
const http = require('http');
const args = require('minimist')(process.argv.slice(2));
const { join } = require('path');
const ws = require('ws');

const { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } = require('..');

const dataChannels = {};
const pendingCandidates = [];
const pendingDataChannels = {};
const port = args.p || 8080;

const dataChannelSettings = {
  reliable: {
    ordered: false,
    maxRetransmits: 0
  }
};

const app = express();
const server = http.createServer(app);

app.get('/peer.js', expressBrowserify(join(__dirname, 'peer.js')));

app.use(express.static(__dirname));

server.listen(port, () => {
  const address = server.address();
  console.log('Server running at ' + address.port);
});

const wss = new ws.Server({ server: server });

wss.on('connection', ws => {
  let pc = null;
  let offer = null;
  let answer = null;
  let remoteReceived = false;

  console.info('ws connected');

  function doComplete() {
    console.info('complete');
  }

  function doHandleError(error) {
    throw error;
  }

  function doCreateAnswer() {
    remoteReceived = true;

    pendingCandidates.forEach(candidate => {
      if (candidate.sdp) {
        pc.addIceCandidate(new RTCIceCandidate(candidate.sdp));
      }
    });

    pc.createAnswer(
      doSetLocalDesc,
      doHandleError
    );
  }

  function doSetLocalDesc(desc) {
    answer = desc;

    console.info(desc);

    pc.setLocalDescription(
      desc,
      doSendAnswer,
      doHandleError
    );
  }

  function doSendAnswer() {
    ws.send(JSON.stringify(answer));
    console.log('awaiting data channels');
  }

  function doHandleDataChannels() {
    const labels = Object.keys(dataChannelSettings);

    pc.ondatachannel = function(evt) {
      const channel = evt.channel;

      console.log('ondatachannel', channel.label, channel.readyState);

      const label = channel.label;

      pendingDataChannels[label] = channel;
      channel.binaryType = 'arraybuffer';

      channel.onopen = () => {
        console.info('onopen');
        dataChannels[label] = channel;
        delete pendingDataChannels[label];
        if (Object.keys(dataChannels).length === labels.length) {
          doComplete();
        }
      };

      channel.onmessage = ({ data }) => {
        if (typeof data === 'string') {
          console.log('onmessage:', evt.data);
        } else {
          console.log('onmessage:', new Uint8Array(evt.data));
        }

        if (typeof data === 'string') {
          channel.send('Hello peer!');
        } else {
          const response = new Uint8Array([107, 99, 97, 0]);
          channel.send(response.buffer);
        }
      };

      channel.onclose = () => {
        console.info('onclose');
      };

      channel.onerror = doHandleError;
    };

    doSetRemoteDesc();
  }

  function doSetRemoteDesc() {
    console.info(offer);
    pc.setRemoteDescription(
      offer,
      doCreateAnswer,
      doHandleError
    );
  }

  ws.on('message', data => {
    data = JSON.parse(data);

    if ('offer' === data.type) {
      offer = new RTCSessionDescription(data);

      answer = null;

      remoteReceived = false;

      pc = new RTCPeerConnection({
        iceServers: [{ url: 'stun:stun.l.google.com:19302' }]
      });

      pc.onsignalingstatechange = () => {
        console.info('signaling state change:', pc.signalingState);
      };

      pc.oniceconnectionstatechange = () => {
        console.info('ice connection state change:', pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.info('ice gathering state change:', pc.iceGatheringState);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          ws.send(JSON.stringify({
            type: 'ice',
            sdp: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            }
          }));
        }
      };

      doHandleDataChannels();
    } else if ('ice' === data.type) {
      if (remoteReceived) {
        if (data.sdp.candidate) {
          pc.addIceCandidate(new RTCIceCandidate(data.sdp));
        }
      } else {
        pendingCandidates.push(data);
      }
    }
  });
});
