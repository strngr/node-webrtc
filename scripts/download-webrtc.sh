#!/bin/bash

set -e

set -v

gclient config --unmanaged --spec 'solutions=[{"name":"src","url":"https://webrtc.googlesource.com/src.git"}]'

if [ "$nohooks" = true ]; then
  gclient sync --shallow --no-history --nohooks -r ${WEBRTC_REVISION} -R
else
  gclient sync --shallow --no-history -r ${WEBRTC_REVISION} -R
fi

ln -s src webrtc
