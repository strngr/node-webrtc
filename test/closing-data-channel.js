'use strict';

const { test } = require('tap');

const { RTCPeerConnection } = require('..');

/**
 * Create an RTCDataChannel by first constructing an RTCPeerConnection and then
 * calling `createDataChannel` on it. Finally, `close` the RTCPeerConnection and
 * return the RTCDataChannel. This is intended to force a garbage collection of
 * the RTCPeerConnection.
 */
function createDataChannel() {
  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel();
  pc.close();
  return dc;
}

test('make sure closing an RTCDataChannel after an RTCPeerConnection has been garbage collected doesn\'t segfault', t => {
  const dc = createDataChannel();
  dc.close();
  t.end();
});
