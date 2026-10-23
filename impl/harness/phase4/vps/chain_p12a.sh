#!/bin/bash
# Phase 4, P1.2, step a: the Level 3 tree with Profile Q compiles; the kms-worker unit tests for profile_q run;
# clippy (warnings as errors) and rustfmt on the kms-worker crate. Every heavy step runs through heavy.sh. Launched
# detached:  nohup setsid /srv/lifecycle/scripts/chain_p12a.sh > /srv/lifecycle/logs/chain_p12a.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p12a.log
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() { local name="$1"; shift; note "START $name"; "$S/heavy.sh" "$name" "$@"; local rc=$?; note "END $name rc=$rc"; return $rc; }
KW_TREE=l3 step p12-unit-l3 "$S/kw.sh" main cargo test -p kms-worker --lib --locked profile_q || note "unit tests failed"
KW_TREE=l3 step p12-clippy-l3 "$S/kw.sh" main cargo clippy -p kms-worker --all-targets --locked -- -D warnings || note "clippy failed"
KW_TREE=l3 step p12-fmt-l3 "$S/kw.sh" main cargo fmt -p kms-worker --check || note "fmt differences"
note "CHAIN DONE"
