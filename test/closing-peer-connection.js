'use strict';

const { test } = require('tap');

const { createPeerConnections, delay, negotiate, onOpen } = require('./helpers');

test('make sure channel is available after after connection is closed on the other side', async t => {
  const [pc1, pc2] = createPeerConnections();

  const dc1 = pc1.createDataChannel('data', { negotiated: true, id: 0 });
  const dc2 = pc2.createDataChannel('data2', { negotiated: true, id: 0 });

  await negotiate(pc1, pc2);

  await Promise.all([
    onOpen(dc1),
    onOpen(dc2)
  ]);

  dc2.close();
  t.equal(dc2.readyState, 'closed', 'can still check ready state after closing');

  pc2.close();
  await delay(100);
  dc1.send('Hello');
  dc1.close();
  pc1.close();
  t.equal(dc1.readyState, 'closed', 'channel on the other side is also closed, but we did not crash');
});
