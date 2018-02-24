'use strict';

function captureCandidates(pc) {
  return new Promise(resolve => {
    const candidates = [];
    if (pc.iceGatheringState === 'complete') {
      resolve(candidates);
      return;
    }
    pc.addEventListener('icecandidate', function onIceCandidate({ candidate }) {
      if (candidate) {
        candidates.push(candidate);
        return;
      }
      pc.removeEventListener('icecandidate', onIceCandidate);
      resolve(candidates);
    });
  });
}

module.exports = captureCandidates;
