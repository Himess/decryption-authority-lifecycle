# Parked: P3 connector throughput (100 and 1,000 concurrent requests)

**Status:** parked on 2026-10-22, not started. It is an optional P3 prototype.

**What the brief asks.** The connector with Core plus Profile H, under 100 and 1,000 concurrent requests, recording
the RPCs per request and the p50 and p95 latency, "only if the VPS cap allows".

**Why it is parked.**
- **The live service.** The VPS is shared with a live service. Phase 4 runs its heavy steps there under
  `MemoryMax=2560M`, `CPUQuota=200%`, `nice 19` and `ionice -c3`. A thousand concurrent requests means a thousand
  worker tasks, each making several `eth_call`s and database writes, against a local anvil and Postgres inside the
  same cap.
  - The cap bounds CPU and memory, not the load on the shared disk, the network stack or the live service's own
    database connections.
  - The brief stops for "anything that puts its live service at risk". A load test at that scale is the kind of
    step that might, so it is not run without Semih's approval.
- **The harness.** The existing connector harness drives one request at a time through on-chain gateway events: the
  TC13–TC15 matrices and the P1.1 latency bench. A concurrency test needs a new load generator and a per-request
  completion probe at the mock key-management service. That is a separate piece of work, larger than the time box.
- **What is already measured.**
  - P1.1 measured each route's latency in isolation: ML-DSA-44 about 245 µs per check at the median (340 µs with two
    libraries), ECDSA under Profile H 470 µs, ERC-1271 at `B_exec` 2,000,000 about 2.7 ms.
  - P0.2 measured the RPCs per request of each request path. Profile H adds one `eth_getCode` per signer.

**What a run needs.**
1. Semih's approval for the load on the shared VPS. Alternatively, a dedicated host.
2. A load generator emitting N `UserDecryptionRequest` events in one block or a few, and a probe at the mock
   key-management service recording when each request arrives.
3. The JSON-RPC recorder already used in P0.2, to count RPCs per request.
4. Runs at N = 100 and N = 1,000, three each, with the live service checked before and after.
