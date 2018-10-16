#!/bin/bash

set -e

set -v

gclient config --unmanaged --spec 'solutions=[{"name":"src","url":"https://webrtc.googlesource.com/src.git"}]'

gclient sync --shallow --no-history -r ${WEBRTC_REVISION} -R
