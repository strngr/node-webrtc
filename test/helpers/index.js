'use strict';

const { RTCPeerConnection } = require('../..');

/**
 * Create two RTCPeerConnections, and set them up to exchange ICE candidates.
 * @returns {Array<RTCPeerConnection>}
 */
function createPeerConnections() {
  const pc1 = new RTCPeerConnection();
  const pc2 = new RTCPeerConnection();
  [[pc1, pc2], [pc2, pc1]].forEach(([pc1, pc2]) =>
    pc1.addEventListener('icecandidate', async ({ candidate }) => {
      if (candidate) {
        await pc2.addIceCandidate(candidate);
      }
    }));
  return [pc1, pc2];
}

/**
 * Wait some number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Negotiate two RTCPeerConnections.
 * @param {RTCPeerConnection} offerer
 * @param {RTCPeerConnection} answerer
 * @returns {Promise<void>}
 */
async function negotiate(offerer, answerer) {
  const offer = await offerer.createOffer();
  await Promise.all([
    offerer.setLocalDescription(offer),
    answerer.setRemoteDescription(offer)
  ]);
  const answer = await answerer.createAnswer();
  await Promise.all([
    offerer.setRemoteDescription(answer),
    answerer.setLocalDescription(answer)
  ]);
}

/**
 * Wait until an RTCDataChannel is received.
 * @param {RTCPeerConnection} pc
 * @returns {Promise<RTCDataChannel>}
 */
function onDataChannel(pc) {
  return new Promise(resolve => {
    pc.addEventListener('datachannel', function onDataChannel({ channel }) {
      pc.removeEventListener('datachannel', onDataChannel);
      resolve(channel);
    });
  });
}

/**
 * Wait until the RTCPeerConnection's `iceConnectionState` is "connected" or
 * "completed".
 * @param {RTCPeerConnection} pc
 * @returns {Promise<void>}
 */
async function onIceConnectedOrCompleted(pc) {
  // TODO(mroberts): Reject if `iceConnectionState` goes to "disconnected" or
  // "failed".
  if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
    await new Promise(resolve =>
      pc.addEventListener('iceconnectionstatechange', function onIceConnectionStateChange() {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange);
          resolve();
        }
      }));
  }
}

/**
 * Wait until an RTCDataChannel is open.
 * @param {RTCDataChannel} dc
 * @returns {Promise<void>}
 */
async function onOpen(dc) {
  if (dc.readyState !== 'open') {
    // TODO(mroberts): Reject if the RTCDataChannel closes.
    await new Promise(resolve =>
      dc.addEventListener('open', function onOpen() {
        if (dc.readyState === 'open') {
          dc.removeEventListener('open', onOpen);
          resolve();
        }
      }));
  }
}

/**
 * Wait for a message.
 * @param {RTCDataChannel} dc
 * @returns {Promise<string|ArrayBuffer>}
 */
function onMessage(dc) {
  return new Promise(resolve =>
    dc.addEventListener('message', function onMessage({ data }) {
      dc.removeEventListener('message', onMessage);
      resolve(data);
    }));
}

/**
 * Test sending a message over one RTCDataChannel and receiving it over another.
 * @param {Test} t
 * @param {RTCDataChannel} sender
 * @param {RTCDataChannel} receiver
 * @param {string|Uint8Array} message
 * @returns {Promise<void>}
 */
async function testSendingAMessage(t, sender, receiver, message) {
  const dataPromise = onMessage(receiver);

  sender.send(message);
  t.pass('successfully sent message');

  const data = await dataPromise;
  t.ok(data, 'got valid data');

  if (typeof message === 'string') {
    t.equal(data.length, message.length);
    t.equal(data, message);
    return;
  }

  const arrayBuffer = new Uint8Array(data);
  t.equal(arrayBuffer.length, message.length);
  t.deepEqual([].slice.call(arrayBuffer), [].slice.call(message));
}

/**
 * Test sending a message over one RTCDataChannel and receiving it over another
 * multiple times.
 * @param {Test} t
 * @param {RTCDataChannel} sender
 * @param {RTCDataChannel} receiver
 * @param {string|Uint8Array} message
 * @param {number} n
 * @returns {Promise<void>}
 */
async function testSendingAMessageNTimes(t, sender, receiver, message, n) {
  for (let i = 0; i < n; i++) {
    await testSendingAMessage(t, sender, receiver, message);
  }
}

/**
 * Test sending a message over one RTCDataChannel and receiving it over another.
 * This function accepts options for specifying the number of times to transmit
 * as well as the message type ("string", "arraybuffer", etc.).
 * @param {Test} t
 * @param {RTCDataChannel} sender
 * @param {RTCDataChannel} receiver
 * @param {string} message
 * @param {object} [options]
 * @param {number} [options.times=1]
 * @param {boolean} [options.type='string'] - one of "string", "arraybuffer", or
 *   "buffer"
 * @returns {Promise<void>}
 */
function testSendingAMessageWithOptions(t, sender, receiver, message, options) {
  options = Object.assign({
    times: 1,
    type: 'string'
  }, options);

  switch (options.type) {
    case 'arraybuffer':
      message = new Uint8Array(message.split('').map(char => {
        return char.charCodeAt(0);
      }));
      break;
    case 'buffer':
      message = new Buffer(message);
      break;
    default:
      break;
  }

  return testSendingAMessageNTimes(t, sender, receiver, message, options.times);
}

exports.createPeerConnections = createPeerConnections;
exports.delay = delay;
exports.negotiate = negotiate;
exports.onDataChannel = onDataChannel;
exports.onIceConnectedOrCompleted = onIceConnectedOrCompleted;
exports.onOpen = onOpen;
exports.testSendingAMessage = testSendingAMessageWithOptions;
