"""P2.1: copy the Fhenix Foundry plugin's own tests for the run on the port (TC3 on the vendor's suite).

Usage: python -I make_p21_vendor_tests.py <cofhesdk checkout at 04a69f8> <impl/fhenix-port>
(SimpleTest.sol in the plugin's test setup needs solc ^0.8.28, so both sets compile with 0.8.28; see foundry.toml.)

From packages/foundry-plugin/test/*.t.sol it writes two sets, with LF line endings:
  e2e/vendor-baseline/  the tests as published, only the relative import '../contracts/' rewritten to the
                        '@cofhe/foundry-plugin/contracts/' remapping (they then run on the unmodified mock stack);
  e2e/vendor-port/      the same, and in addition CofheTest is taken from e2e/src/CofheTestPort.sol and every
                        `deployMocks();` becomes `deployMocksWithPortACL();` (the port's ACL and share registry).
Nothing else in the tests changes. Each copy starts with a header naming its source.
"""
import glob
import os
import re
import sys

IMPORT_REL = re.compile(r"'\.\./contracts/")
COFHETEST_IMPORT = re.compile(r"import \{ CofheTest \} from '@cofhe/foundry-plugin/contracts/CofheTest\.sol';")


def main():
    checkout, port = sys.argv[1], sys.argv[2]
    src = os.path.join(checkout, "packages", "foundry-plugin", "test")
    base_dir = os.path.join(port, "e2e", "vendor-baseline")
    port_dir = os.path.join(port, "e2e", "vendor-port")
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(port_dir, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(src, "*.t.sol"))):
        name = os.path.basename(path)
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read().replace("\r\n", "\n")
        header = (f"// [lifecycle P2.1] Copied from FhenixProtocol/cofhesdk 04a69f8 packages/foundry-plugin/test/{name}.\n")
        base = IMPORT_REL.sub("'@cofhe/foundry-plugin/contracts/", text)
        n_import = len(COFHETEST_IMPORT.findall(base))
        ported = COFHETEST_IMPORT.sub(
            "import { CofheTestPort as CofheTest } from '../src/CofheTestPort.sol';", base)
        n_deploy = ported.count("deployMocks();")
        ported = ported.replace("deployMocks();", "deployMocksWithPortACL();")
        with open(os.path.join(base_dir, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(header + "// Change: the relative import of the plugin's contracts uses the remapping.\n" + base)
        with open(os.path.join(port_dir, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(header + "// Changes: the remapped import; CofheTest from e2e/src/CofheTestPort.sol (CofheTest plus the\n"
                    f"// port's ACL); deployMocks() -> deployMocksWithPortACL() ({n_deploy} call(s)).\n" + ported)
        print(f"{name}: CofheTest imports {n_import}, deployMocks calls {n_deploy}")


if __name__ == "__main__":
    main()
