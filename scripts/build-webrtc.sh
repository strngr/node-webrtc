#!/bin/bash

set -e

set -v

if [ -z "$PARALLELISM" ]; then
  ninja
else
  ninja -j $PARALLELISM
fi
