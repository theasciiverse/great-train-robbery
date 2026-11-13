#!/bin/sh
# Records the catalog preview, asciiverse/great-train-robbery.cast, at
# 100x30 with hub's castrec.py: the boss's speech, the town of --seed
# 1a2b3c, hiring two men in the saloon, a rifle and a revolver in the
# store, their plans in the hotel, and the heist itself.
# Run from the repo root after building.
set -eu
CASTREC=${CASTREC:-../hub/tools/castrec.py}
state=$(mktemp -d)
trap 'rm -rf "$state"' EXIT
KEYS="Enter Enter o 1 h Enter 5 h Enter g 1 p 4 Enter b 2 p 3 Enter t 1 a 2 a 4 a 5 l 5 b 2 a 1 a 4 l 6 k Enter Enter"
S="w3.5"
for k in $KEYS; do
  case "$k" in Enter) S="$S;kenter;w1.2" ;; *) S="$S;k$k;w0.7" ;; esac
done
S="$S;w20"
XDG_STATE_HOME="$state" python3 "$CASTREC" "${1:-asciiverse/great-train-robbery.cast}" . "$S" -- ./out/great-train-robbery --seed 1a2b3c
