"""Writes the verifier conformance fixtures (TC13, TC14, TC15) as language-neutral JSON.

Usage: python -I conformance/verifier/make_fixtures.py <out dir>

Each fixture row states a request, the chain state it meets, and the outcome the ERC's verifier rule requires:
  TC13 (V1)  a view call fails while the worker decides; a retired subject must never be forwarded.
  TC14 (V5, freshness)  retirement at a block before, after or racing a request; a reorganisation; a restart.
  TC15 (V6, V7)  a stored result after retirement; a retirement denial is final at the first attempt, typed
                 `account_retired` where the path reports codes; a governance lapse after the denial revives nothing.
`expect` names what conformance requires. A cell the rule leaves open (an allowed subject under a fault: V1 permits
refusing) is `any`. The rows reproduce the matrices of the Zama worker harness used in Phase 4 (P0.1, P0.2, P0.3,
Level 1), so the harness can run them; `check_zama_worker.py` judges a run against them.
"""
import json
import os
import sys

TC13_FAULTS = ["control", "jsonrpc-error", "http-503", "drop", "delay", "malformed-json", "empty-0x", "short",
               "revert-data", "revert-nodata", "intermittent"]
TC13_CASES = {
    "main": [("legacy-direct", "isAllowed"), ("legacy-direct", "decryptionSignatureInvalidatedBefore"),
             ("legacy-delegated", "isHandleDelegatedForUserDecryption"),
             ("legacy-delegated", "decryptionSignatureInvalidatedBefore"), ("v2-direct", "isAllowed"),
             ("v2-direct", "decryptionSignatureInvalidatedBefore"),
             ("v2-delegated", "isHandleDelegatedForUserDecryption"),
             ("v2-delegated", "decryptionSignatureInvalidatedBefore"), ("v2-http-direct", "isAllowed")],
    "v0.13.8": [("legacy-direct", "isAllowed"), ("legacy-delegated", "isHandleDelegatedForUserDecryption")],
}
PATHS = {
    "legacy-direct": "gateway (legacy) user decryption; the subject is the user",
    "legacy-delegated": "gateway (legacy) delegated user decryption; the subject is the delegator",
    "v2-direct": "RFC-016 user decryption; the subject is the signer",
    "v2-delegated": "RFC-016 delegated user decryption; the subject is the owner",
    "v2-http-direct": "RFC-016 user decryption over the connector's HTTP endpoint; the subject is the signer",
}
FAULTS = {
    "control": "no fault", "jsonrpc-error": "a JSON-RPC error object", "http-503": "HTTP 503",
    "drop": "the connection is closed without an answer", "delay": "the answer arrives after the call's timeout",
    "malformed-json": "a body that is not JSON", "empty-0x": "result 0x", "short": "a result shorter than one word",
    "revert-data": "a revert with data", "revert-nodata": "a revert without data",
    "intermittent": "every other call fails",
}


def tc13():
    rows = []
    for line, cases in TC13_CASES.items():
        for path, view in cases:
            for subject in ("allowed", "retired"):
                for fault in TC13_FAULTS:
                    if subject == "retired":
                        expect = "not-forwarded"
                    else:
                        expect = "forwarded" if fault == "control" else "any"
                    rows.append({
                        "id": f"tc13.{line}.{path}.{subject}.{view}.{fault}", "line": line,
                        "request": {"path": path, "describes": PATHS[path]},
                        "chain_state": {"subject": "granted and delegating" + (", then retired" if subject == "retired" else ""),
                                        "fault": {"view": view, "kind": fault, "describes": FAULTS[fault]}},
                        "rule": "V1", "expect": expect,
                        "harness": {"result_line": "TC13-RESULT", "path": path, "subject": subject, "view": view,
                                    "fault": fault}})
    return rows


TC14 = [
    ("after", "the subject retired at block N; the request arrives after N", "not-forwarded"),
    ("race", "the views are evaluated at N-1 and the subject retires at N while the answers are held", "forwarded"),
    ("reorg-before", "the subject retired at block N; the request is decided before any reorganisation", "not-forwarded"),
    ("reorg-after", "the retirement block is rolled back (anvil_rollback(1)) before the request is decided", "forwarded"),
    ("restart-mid-check", "the worker stops during the check of a retired subject; another worker picks the row up", "not-forwarded"),
    ("already-sent-live", "a request already sent to the KMS is retried while the subject is active", "forwarded"),
    ("already-sent-retired", "a request already sent to the KMS is retried after the subject retired", "not-forwarded"),
]


def tc14():
    return [{"id": f"tc14.{line}.{case}", "line": line, "request": {"path": "legacy-direct", "view": "isAllowed"},
             "chain_state": {"describes": what}, "rule": "V5 and freshness (L = 0)", "expect": expect,
             "harness": {"result_line": "P02-RESULT", "case": case}}
            for line in ("main", "v0.13.8") for case, what, expect in TC14]


V7 = [
    ("legacy-direct.u-retired", "legacy direct; the user is retired", "final-denial", None),
    ("legacy-delegated.delegator-u-retired", "legacy delegated; the delegator is retired", "final-denial", None),
    ("v2-direct.uk-retired", "RFC-016 direct; the signer is retired", "final-denial", None),
    ("v2-http-direct.uk-retired", "RFC-016 over HTTP; the signer is retired", "typed-denial", "account_retired"),
    ("legacy-direct.v-no-allowance", "legacy direct; the user holds nothing (an ordinary denial)", "not-forwarded", None),
    ("legacy-delegated.v-no-allowance-to-d", "legacy delegated; nothing was delegated (an ordinary denial)", "not-forwarded", None),
    ("v2-http-direct.vk-no-allowance", "RFC-016 over HTTP; the signer holds nothing (an ordinary denial)", "not-forwarded", None),
]
V6 = [
    ("first-request", "the subject is active; a first request", "served"),
    ("same-request-live", "the same request again while the subject is active", "served"),
    ("same-request-after-retirement", "the same request again after the subject retired", "not-served"),
    ("equivalent-request-after-retirement", "an equivalent request (another signature or window) after retirement", "not-served"),
    ("same-request-again", "the same request a third time, after retirement", "not-served"),
]


def tc15():
    rows = []
    for mode in ("off", "on"):
        for case, what, expect, code in V7:
            rows.append({"id": f"tc15.v7.main.{mode}.{case}", "line": "main",
                         "request": {"describes": what}, "chain_state": {"profile_h": mode},
                         "rule": "V7" if expect != "not-forwarded" else "V1 (an ordinary denial may be retried)",
                         "expect": expect, "expect_code": code,
                         "harness": {"result_line": "L0-RESULT", "label": f"l1.h5.{mode}.{case}"}})
        rows.append({"id": f"tc15.v7.main.{mode}.lapse", "line": "main",
                     "request": {"describes": "legacy direct; the user is retired, and retirement is cleared right "
                                              "after the first denial (a simulated governance lapse)"},
                     "chain_state": {"profile_h": mode}, "rule": "V7", "expect": "final-denial", "expect_code": None,
                     "harness": {"result_line": "L0-RESULT", "label": f"l1.lapse.{mode}.legacy-direct.u-retired"}})
    for tree in ("unmodified", "level1"):
        for step, what, expect in V6:
            if tree == "unmodified" and step == "same-request-again":
                continue  # that harness step exists only for the Level 1 tree
            rows.append({"id": f"tc15.v6.main.{tree}.{step}", "line": "main", "request": {"describes": what},
                         "chain_state": {"tree": tree}, "rule": "V6", "expect": expect,
                         "harness": {"result_line": "P03-RESULT", "tree": tree, "step": step}})
    return rows


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, rows in (("tc13.json", tc13()), ("tc14.json", tc14()), ("tc15.json", tc15())):
        with open(os.path.join(out, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump({"fixture": name[:-5].upper(), "rows": rows}, f, indent=1)
        print(f"{name}: {len(rows)} rows")


if __name__ == "__main__":
    main()
