/* eslint no-console:0 */
'use strict';

const { test } = require('tap');

const { RTCPeerConnection } = require('..');

const captureCandidates = require('./helpers/capture-candidates');

let pc;

test('assign ICE server and get reflective candidates', async t => {
  pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });

  const candidatesPromise = captureCandidates(pc);

  pc.createDataChannel('test');

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const candidates = await candidatesPromise;
  t.assert(candidates.some(candidate => candidate.candidate.match('typ srflx')), 'gotReflective === true');

  pc.close();
});

test('dont assign ICE server and get no reflective candidates', async t => {
  pc = new RTCPeerConnection();

  const candidatesPromise = captureCandidates(pc);

  pc.createDataChannel('test');

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const candidates = await candidatesPromise;
  t.assert(!candidates.some(candidate => candidate.candidate.match('typ srflx')), 'gotReflective === false');

  pc.close();
});
