# Source me. Isolated toolchain for the lifecycle connector proof. Nothing here touches system config.
export L=/srv/lifecycle
export HOME=$L/home
export RUSTUP_HOME=$L/.rustup
export CARGO_HOME=$L/.cargo
export PATH=$L/bin:$L/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Build-profile deviation (coordinator decision, run 2): no code change, lighter build.
export CARGO_BUILD_JOBS=1
export CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_PROFILE_TEST_DEBUG=0
export CARGO_TERM_COLOR=never
export PROTOC=$L/bin/protoc
export TMPDIR=$L/tmp
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1
export DO_NOT_TRACK=1
