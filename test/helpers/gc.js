/* globals gc */
'use strict';

/**
 * Call `gc` if `gc` is enabled.
 * @returns {void}
 */
function maybeGc() {
  if (typeof gc === 'function') {
    gc();
  }
}

module.exports = maybeGc;
