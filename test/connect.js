'use strict';

const { test } = require('tap');

const { RTCIceCandidate, RTCPeerConnection } = require('..');

const { onDataChannel, onIceConnectedOrCompleted, testSendingAMessage } = require('./helpers');
const captureCandidates = require('./helpers/capture-candidates');

let candidatesPromises;

let peers = [];
const candidates = [];
const dcs = [];
let localDesc;
let dcPromise;

test('create the peer connections', t => {
  peers[0] = new RTCPeerConnection();
  peers[1] = new RTCPeerConnection();

  dcPromise = onDataChannel(peers[1]);

  candidatesPromises = peers.map(async (pc, i) => {
    candidates[i] = await captureCandidates(pc);
    return candidates[i];
  });

  t.ok(peers[0] instanceof RTCPeerConnection, 'peer:0 created ok');
  t.ok(peers[1] instanceof RTCPeerConnection, 'peer:1 created ok');

  t.end();
});

test('peers are created and in the expected connection state', t => {
  t.equal(peers[0].iceConnectionState, 'new');
  t.equal(peers[1].iceConnectionState, 'new');
  t.end();
});

test('create a datachannel on peer:0', t => {
  t.ok(dcs[0] = peers[0].createDataChannel('test'));
  t.equal(dcs[0].label, 'test', 'created with correct label');
  t.end();
});

test('createOffer for peer:0', async t => {
  const offer = await peers[0].createOffer();

  // save the local description
  localDesc = offer;

  // run the checks
  t.ok(offer, 'createOffer succeeded');
  t.equal(offer.type, 'offer', 'type === offer');
  t.ok(offer.sdp, 'got sdp');
});

test('setLocalDescription for peer:0', async () => {
  await peers[0].setLocalDescription(localDesc);
});

test('capture ice candidates for peer:0', async t => {
  await candidatesPromises[0];
  t.equal(peers[0].iceGatheringState, 'complete', 'have candidates for peer:0');
});

test('setRemoteDescription for peer:1', async () => {
  await peers[1].setRemoteDescription(peers[0].localDescription);
});

test('provide peer:1 with the peer:0 gathered ice candidates', async () => {
  await Promise.all(candidates[0].map(candidate =>
    peers[1].addIceCandidate(new RTCIceCandidate(candidate))));
});

test('createAnswer for peer:1', async t => {
  const answer = await peers[1].createAnswer();

  // save the local description
  localDesc = answer;

  // run the checks
  t.ok(answer, 'createOffer succeeded');
  t.equal(answer.type, 'answer', 'type === answer');
  t.ok(answer.sdp, 'got sdp');
});

test('setLocalDescription for peer:1', async () => {
  await peers[1].setLocalDescription(localDesc);
});

test('capture ice candidates for peer:1', async t => {
  await candidatesPromises[1];
  t.equal(peers[1].iceGatheringState, 'complete', 'have candidates for peer:1');
});

test('setRemoteDescription for peer:0', async () => {
  await peers[0].setRemoteDescription(peers[1].localDescription);
});

test('provide peer:0 with the peer:1 gathered ice candidates', async () => {
  await Promise.all(candidates[1].map(candidate =>
    peers[0].addIceCandidate(new RTCIceCandidate(candidate))));
});

test('peer:1 triggers data channel event', async t => {
  const dc = await dcPromise;
  t.ok(dc, 'got data channel');
  t.equal(dc.label, 'test', 'data channel has correct label');
});

test('monitor the ice connection state of peer:0', async t => {
  await onIceConnectedOrCompleted(peers[0]);
  t.pass('peer:0 in connected state');
});

test('monitor the ice connection state of peer:1', async t => {
  await onIceConnectedOrCompleted(peers[1]);
  t.pass('peer:1 in connected state');
});

test('data channel connectivity', async t => {
  const sender = dcs[0];
  const receiver = await dcPromise;
  const message1 = 'hello world';

  // First, test sending strings.
  await testSendingAMessage(t, sender, receiver, message1, { times: 3 });

  // Then, test sending ArrayBuffers.
  await testSendingAMessage(t, sender, receiver, message1, {
    times: 3,
    type: 'arraybuffer'
  });

  // Finally, test sending Buffers.
  await testSendingAMessage(t, sender, receiver, message1, {
    times: 3,
    type: 'buffer'
  });
});

test('getStats', async () => {
  await Promise.all(peers.map(peer => peer.getStats()));
});

test('close the connections', t => {
  peers.forEach(peer => peer.close());

  // make sure nothing crashes after connection is closed and _jinglePeerConnection is null
  peers.forEach(peer => {
    peer.createOffer();
    peer.createAnswer();
    peer.setLocalDescription({}, () => {}, () => {});
    peer.setRemoteDescription({}, () => {}, () => {});
    peer.addIceCandidate({}, () => {}, () => {});
    peer.createDataChannel('test');
    peer.getStats().catch(() => {});
    peer.close();
  });

  t.pass('closed connections');

  peers.splice(0);

  t.end();
});
