#!/bin/bash
# Installs the isolated toolchain under /srv/lifecycle. Run via heavy.sh. Nothing outside /srv/lifecycle is written.
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
DL=$L/dl
mkdir -p "$DL" "$L/bin"
cd "$DL"

echo "== rustup-init"
curl -fsSL --proto '=https' --tlsv1.2 -o rustup-init https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init
curl -fsSL --proto '=https' --tlsv1.2 -o rustup-init.sha256 https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init.sha256
echo "$(awk '{print $1}' rustup-init.sha256)  rustup-init" | sha256sum --check --strict
chmod +x rustup-init
./rustup-init -y --no-modify-path --default-toolchain none --profile minimal
rustup --version
rustup toolchain install 1.92.0 --profile minimal
rustup toolchain install 1.99.1 --profile minimal -c rustfmt -c clippy
rustup toolchain list

echo "== protoc 26.1 (v0.13.8 CI: arduino/setup-protoc version 26.x)"
curl -fsSL -o protoc-26.1-linux-x86_64.zip https://github.com/protocolbuffers/protobuf/releases/download/v26.1/protoc-26.1-linux-x86_64.zip
sha256sum protoc-26.1-linux-x86_64.zip
rm -rf "$L/bin/protoc-26.1" && mkdir -p "$L/bin/protoc-26.1"
python3 -I -m zipfile -e protoc-26.1-linux-x86_64.zip "$L/bin/protoc-26.1"
chmod +x "$L/bin/protoc-26.1/bin/protoc"
"$L/bin/protoc-26.1/bin/protoc" --version

echo "== protoc 34.1 (main: .github/actions/setup-rust-and-protoc pins 34.1 + sha256)"
curl -fsSL -o protoc-34.1-linux-x86_64.zip https://github.com/protocolbuffers/protobuf/releases/download/v34.1/protoc-34.1-linux-x86_64.zip
echo "af27ea66cd26938fe48587804ca7d4817457a08350021a1c6e23a27ccc8c6904  protoc-34.1-linux-x86_64.zip" | sha256sum --check --strict
rm -rf "$L/bin/protoc-34.1" && mkdir -p "$L/bin/protoc-34.1"
python3 -I -m zipfile -e protoc-34.1-linux-x86_64.zip "$L/bin/protoc-34.1"
chmod +x "$L/bin/protoc-34.1/bin/protoc"
"$L/bin/protoc-34.1/bin/protoc" --version

echo "== foundry v1.3.5 (v0.13.8 harness pins ghcr.io/foundry-rs/foundry:v1.3.5)"
curl -fsSL -o foundry_v1.3.5_linux_amd64.tar.gz https://github.com/foundry-rs/foundry/releases/download/v1.3.5/foundry_v1.3.5_linux_amd64.tar.gz
sha256sum foundry_v1.3.5_linux_amd64.tar.gz
rm -rf "$L/bin/foundry-1.3.5" && mkdir -p "$L/bin/foundry-1.3.5"
tar -xzf foundry_v1.3.5_linux_amd64.tar.gz -C "$L/bin/foundry-1.3.5"
ls -la "$L/bin/foundry-1.3.5"
for b in anvil forge cast; do ln -sfn "$L/bin/foundry-1.3.5/$b" "$L/bin/$b"; done
anvil --version; forge --version; cast --version
echo "== done"
