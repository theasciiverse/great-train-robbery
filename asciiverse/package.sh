#!/bin/sh
# Packs dist/great-train-robbery-<target>.tar.gz (.zip for Windows) for av: the
# program at the top, the author's permission, PATCHES.md and the licences
# of rotty, QuickJS-ng and rot.js.
#
#   asciiverse/package.sh x86_64-unknown-linux-musl
set -eu
cd "$(dirname "$0")/.."
target="$1"
case "$target" in *windows*) exe=.exe ;; *) exe= ;; esac
stage=stage/great-train-robbery
rm -rf "$stage" && mkdir -p "$stage" dist
cp "out/great-train-robbery$exe" PERMISSION.md PATCHES.md "$stage/"
cp asciiverse/LICENSE-rotty "$stage/LICENSE-rotty"
cp asciiverse/quickjs/LICENSE "$stage/QUICKJS-LICENSE"
cp LICENSE.md CREDITS.md "$stage/"
if [ -n "$exe" ]; then
  (cd "$stage" && zip -qr "../../dist/great-train-robbery-$target.zip" .)
else
  tar -czf "dist/great-train-robbery-$target.tar.gz" -C "$stage" .
fi
ls -l dist
