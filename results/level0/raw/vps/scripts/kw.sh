#!/bin/bash
# usage: [KW_TREE=pristine|harness] [KW_DB=1] kw.sh <v0.13.8|main> <fetch|build|test> [extra cargo args...]
# Builds/tests the kms-worker crate of the given checkout with the isolated toolchain.
#   KW_TREE=pristine (default): untouched clone  /srv/lifecycle/src/fhevm-<ver>
#   KW_TREE=harness           : test-harness clone /srv/lifecycle/src/fhevm-<ver>-harness
#   KW_DB=1                   : point the tests at the lifecycle-pg container (127.0.0.1:55432)
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
ver="$1"; step="$2"; shift 2
tree="${KW_TREE:-pristine}"
case "$ver" in
  v0.13.8) export PROTOC=$L/bin/protoc-26.1/bin/protoc ;;
  main)    export PROTOC=$L/bin/protoc-34.1/bin/protoc ;;
  *) echo "unknown version $ver"; exit 2 ;;
esac
case "$tree" in
  pristine) SRC=$L/src/fhevm-$ver ;;
  harness)  SRC=$L/src/fhevm-$ver-harness ;;
  *) echo "unknown tree $tree"; exit 2 ;;
esac
export CARGO_TARGET_DIR=$L/target/$ver
export SQLX_OFFLINE=true
export RUST_BACKTRACE=1
if [ "${KW_DB:-0}" = 1 ]; then
  export PGPASSFILE=$L/secrets/pgpass
  export LIFECYCLE_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:55432/postgres   # v0.13.8 harness deviation
  export DATABASE_URL=postgresql://postgres@127.0.0.1:55432/postgres            # main: DbInstance::setup_external
fi
cd "$SRC/kms-connector"
echo "KW ver=$ver tree=$tree step=$step commit=$(git -C "$SRC" rev-parse HEAD) date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc)"
echo "KW dirty-files: $(git -C "$SRC" status --porcelain | tr '\n' ' ')"
echo "KW toolchain=$(rustup show active-toolchain) | $(rustc --version) | $(cargo --version) | $($PROTOC --version) | jobs=$CARGO_BUILD_JOBS"
case "$step" in
  fetch) cargo fetch --locked --target x86_64-unknown-linux-gnu ;;
  build) cargo test -p kms-worker --locked --no-run --timings "$@" ;;
  test)  cargo test -p kms-worker --locked "$@" ;;
  *) echo "unknown step $step"; exit 2 ;;
esac
