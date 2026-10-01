#!/bin/bash
set -euo pipefail
NATIVE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../native" && pwd)"
PLOG_DEV="${PLOG_NATIVE_DEVELOPER_DIR:-/Library/Developer/CommandLineTools}"
BIN="$NATIVE_DIR/.build/live-grade"
mkdir -p "$NATIVE_DIR/.build/module-cache"
if [[ ! -x "$BIN" || "$NATIVE_DIR/LiveGrade.swift" -nt "$BIN" ]]; then
 PLOG_BUILD="$(mktemp -d "$NATIVE_DIR/.build/compile.XXXXXX")"
 trap 'rm -rf -- "$PLOG_BUILD"' EXIT
 cp "$NATIVE_DIR/LiveGrade.swift" "$PLOG_BUILD/LiveGrade.swift"
 DEVELOPER_DIR="$PLOG_DEV" xcrun swiftc -parse-as-library -swift-version 5 -O -module-cache-path "$NATIVE_DIR/.build/module-cache" "$PLOG_BUILD/LiveGrade.swift" -o "$PLOG_BUILD/program"
 mv -f "$PLOG_BUILD/program" "$BIN"
 rm -rf -- "$PLOG_BUILD"
 trap - EXIT
fi
exec "$BIN" "$@"
