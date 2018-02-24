'use strict';

const SimplePeer = require('simple-peer');
const { test } = require('tap');

const wrtc = require('..');

test('connect once', async () => {
  await connect();
});

test('connect loop', async () => {
  await connectLoop(10);
});

test('connect concurrent', async () => {
  const n = 10;
  const connectPromises = [];
  for (let i = 0; i < n; i++) {
    connectPromises.push(connect());
  }
  await Promise.all(connectPromises);
});

test('connect loop concurrent', async () => {
  const n = 10;
  const connectPromises = [];
  for (let i = 0; i < n; i++) {
    connectPromises.push(connectLoop(10));
  }
  await Promise.all(connectPromises);
});

async function connect() {
  // setup two peers with simple-peer
  const peer1 = new SimplePeer({ wrtc });
  const peer2 = new SimplePeer({ wrtc, initiator: true });

  // when peer1 has signaling data, give it to peer2, and vice versa
  const peer1Promise = new Promise((resolve, reject) => {
    peer1.on('signal', data => {
      peer2.signal(data);
    });

    peer1.on('error', reject);

    peer1.on('connect', () => {
      peer1.send('peers are for kids');
      resolve();
    });
  });

  const peer2Promise = new Promise((resolve, reject) => {
    peer2.on('signal', data => {
      peer1.signal(data);
    });

    peer2.on('error', reject);

    peer2.on('data', () => resolve());
  });

  await Promise.all([
    peer1Promise,
    peer2Promise
  ]);

  peer1.destroy();
  peer2.destroy();
}

async function connectLoop(count) {
  for (let i = 0; i < count; i++) {
    await connect();
  }
}
