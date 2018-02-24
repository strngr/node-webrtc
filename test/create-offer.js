'use strict';

const { test } = require('tap');

const { RTCPeerConnection } = require('..');

let peer;
let localDesc;

test('create a peer connection', t => {
  peer = new RTCPeerConnection({ iceServers: [] });
  t.ok(peer instanceof RTCPeerConnection, 'created');
  t.end();
});

test('createOffer function implemented', t => {
  t.equal(typeof peer.createOffer, 'function', 'implemented');
  t.end();
});

test('can call createOffer', async t => {
  const offer = await peer.createOffer();

  // save the local description
  localDesc = offer;

  // run the checks
  t.ok(offer, 'createOffer succeeded');
  t.equal(offer.type, 'offer', 'type === offer');
  t.ok(offer.sdp, 'got sdp');
});

test('setLocalDescription function implemented', t => {
  t.equal(typeof peer.setLocalDescription, 'function', 'implemented');
  t.end();
});

test('can call setLocalDescription', async t => {
  await peer.setLocalDescription(localDesc);
  t.ok(peer.localDescription, 'local description set');
  t.ok(peer.localDescription.sdp, 'we have local sdp');
});

test('TODO: cleanup connection', t => {
  peer.close();
  t.pass('connection closed');
  t.end();
});
