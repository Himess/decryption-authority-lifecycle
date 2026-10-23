#!/usr/bin/env bash
# =============================================================================
# lib/env.sh: shared environment for the Level-0 baseline harness.
#
# Source it from the other harness scripts:
#     source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"
#
# What it does (and nothing else):
#   * prepends Foundry, Rust and the locally downloaded jq to PATH (they are not
#     on the default PATH of this machine);
#   * points npm at Git Bash for package.json scripts, so POSIX-style scripts
#     (single quotes, VAR=x prefixes) behave as on Zama's Linux CI;
#   * defines the paths of the two pinned implementation clones.
#
# It never prints secrets. Test mnemonics live in impl/harness/.env, which is
# git-ignored by the project's "**/.env" rule.
# =============================================================================

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMPL_DIR="$(cd "$HARNESS_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$IMPL_DIR/.." && pwd)"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/results/level0/logs}"
mkdir -p "$LOG_DIR"

CLONE_MAIN="$IMPL_DIR/fhevm-main"
CLONE_V0138="$IMPL_DIR/fhevm-v0.13.8"

# Toolchains (Windows user profile layout; harmless on Linux if absent).
_userprofile_posix=""
if [[ -n "${USERPROFILE:-}" ]]; then
    _userprofile_posix="$(cygpath -u "$USERPROFILE" 2>/dev/null || echo "$USERPROFILE")"
fi
for _d in "$IMPL_DIR/.tools/jq" "${_userprofile_posix:+$_userprofile_posix/.cargo/bin}" "${_userprofile_posix:+$_userprofile_posix/.foundry/bin}"; do
    [[ -n "$_d" && -d "$_d" ]] && PATH="$_d:$PATH"
done
export PATH

# On Windows, jq.exe is downloaded as impl/.tools/jq/jq.exe; Git Bash resolves `jq`
# to it. On Linux use the distro jq.

# npm runs package.json scripts with cmd.exe on Windows by default. Zama's
# scripts assume a POSIX shell (e.g. `--contract 'contracts/immutable'`).
if [[ -x "/c/Program Files/Git/bin/bash.exe" ]]; then
    export npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'
fi

# Anvil port for Baseline B. 8545 belongs to someone else on this machine: never use it.
HARNESS_PORT="${HARNESS_PORT:-18557}"
if [[ "$HARNESS_PORT" == "8545" ]]; then
    echo "refusing to use port 8545 (reserved by another process on this machine)" >&2
    exit 1
fi

clone_dir() {
    case "${1:-}" in
        main) echo "$CLONE_MAIN" ;;
        v0.13.8) echo "$CLONE_V0138" ;;
        *) echo "unknown clone '${1:-}' (expected: main | v0.13.8)" >&2; return 1 ;;
    esac
}

now_s() { date +%s; }

# Prints the toolchain versions used, for the record.
print_toolchain() {
    echo "date_utc:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "node:       $(node --version 2>/dev/null)"
    echo "npm:        $(npm --version 2>/dev/null)"
    echo "forge:      $(forge --version 2>/dev/null | head -1)"
    echo "anvil:      $(anvil --version 2>/dev/null | head -1)"
    echo "rustc:      $(rustc --version 2>/dev/null)"
    echo "jq:         $(jq --version 2>/dev/null)"
    echo "git:        $(git --version 2>/dev/null)"
}
