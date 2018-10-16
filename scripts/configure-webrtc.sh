#!/bin/bash

set -e

set -v

cd ${SOURCE_DIR}

gn gen ${BINARY_DIR} "--args=${GN_GEN_ARGS}"
