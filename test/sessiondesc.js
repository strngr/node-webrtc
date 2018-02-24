'use strict';

const { test } = require('tap');

const { RTCPeerConnection, RTCSessionDescription } = require('..');

let peer;
let localDesc;

test('create a peer connection', t => {
  peer = new RTCPeerConnection();
  t.ok(peer instanceof RTCPeerConnection, 'created');
  t.end();
});

test('createOffer', async t => {
  const offer = await peer.createOffer();

  // save the local description
  localDesc = offer;

  // run the checks
  t.ok(offer, 'createOffer succeeded');
  t.equal(offer.type, 'offer', 'type === offer');
  t.ok(offer.sdp, 'got sdp');
});

test('setLocalDescription with a created RTCSessionDescription', async t => {
  await peer.setLocalDescription(new RTCSessionDescription({ sdp: localDesc.sdp, type: 'offer' }));
  t.ok(peer.localDescription, 'local description set');
  t.ok(peer.localDescription.sdp, 'we have local sdp');
});

test('TODO: cleanup connection', t => {
  peer.close();
  t.pass('connection closed');
  t.end();
});
