# D1: the ERC's constants recomputed with `cast`

`cast Version: 1.8.5`; ERC file checked: `erc/ERC-XXXX-decryption-authority-lifecycle.md`.

| Constant | Stated | Recomputed | Result |
|---|---|---|---|
| selector retireAccount() | `0xe7142996` | `0xe7142996` | ok |
| selector isAccountRetired(address) | `0xb279091e` | `0xb279091e` | ok |
| selector retirementStorageLocation() | `0xc89c7ccd` | `0xc89c7ccd` | ok |
| selector supportsInterface(bytes4) | `0x01ffc9a7` | `0x01ffc9a7` | ok |
| topic AccountRetired(address,address) | `0xb78e4ea3a4535888e05cd4dd5c1b469a528e4f3e743356314e71ca2b340fa0eb` | `0xb78e4ea3a4535888e05cd4dd5c1b469a528e4f3e743356314e71ca2b340fa0eb` | ok |
| selector AccountAlreadyRetired(address) | `0x9c0fa00d` | `0x9c0fa00d` | ok |
| selector SenderRetired(address) | `0xb9e76275` | `0xb9e76275` | ok |
| selector UpgradeDropsRetirement(address) | `0x61b57965` | `0x61b57965` | ok |
| topic SuccessorDesignated(address,address,uint64) | `0x52c3e9f82052eb6b4fbe29b0b48bf718c35b2558f0c45c667b14287a3e51f807` | `0x52c3e9f82052eb6b4fbe29b0b48bf718c35b2558f0c45c667b14287a3e51f807` | ok |
| topic SuccessionAccepted(address,address) | `0x038d2b057a5c8f360473e6c2a5c1b001dd0367ecbeeb660fb7fde23df6252afb` | `0x038d2b057a5c8f360473e6c2a5c1b001dd0367ecbeeb660fb7fde23df6252afb` | ok |
| topic SuccessorDesignationCancelled(address,address) | `0xb83db6f1374970f6129184222c9120a283b1b920e4307ce2dd2db53f1b0c79be` | `0xb83db6f1374970f6129184222c9120a283b1b920e4307ce2dd2db53f1b0c79be` | ok |
| topic SuccessorConfirmed(address,address) | `0x0bbdbb8ccff8e10c1bcb0e3746b6cdd863fbe0295656b864bb983783818e167f` | `0x0bbdbb8ccff8e10c1bcb0e3746b6cdd863fbe0295656b864bb983783818e167f` | ok |
| topic SuccessionResigned(address,address) | `0xec5735ad8a8bc1941be7a96a8fb2cf4dc0812a609c3975be6436a90018683273` | `0xec5735ad8a8bc1941be7a96a8fb2cf4dc0812a609c3975be6436a90018683273` | ok |
| topic SuccessorDelayRaised(address,uint64) | `0x49529b4ae3a76543375e1fa78debf59fd8bd835f6acf21ad1a23f69a9b811a39` | `0x49529b4ae3a76543375e1fa78debf59fd8bd835f6acf21ad1a23f69a9b811a39` | ok |
| selector SuccessorInvalid(address) | `0xc6b4b14a` | `0xc6b4b14a` | ok |
| selector SuccessorAlreadyConfirmed(address) | `0xb09b5136` | `0xb09b5136` | ok |
| selector NoPendingSuccessor(address) | `0xfca6ea78` | `0xfca6ea78` | ok |
| selector NotPendingSuccessor(address) | `0x7051e7e2` | `0x7051e7e2` | ok |
| selector SuccessionNotAccepted(address) | `0x9eb4e345` | `0x9eb4e345` | ok |
| selector SuccessorNotYetConfirmable(address,uint64) | `0xbfde6be2` | `0xbfde6be2` | ok |
| selector NotSuccessor(address) | `0xa10eaf88` | `0xa10eaf88` | ok |
| selector SuccessorDelayInvalid(uint64) | `0x0304d853` | `0x0304d853` | ok |
| selector CertificateWrongChain(uint256) | `0x904dd953` | `0x904dd953` | ok |
| selector CertificateSuccessorMismatch(address,address) | `0x99155e67` | `0x99155e67` | ok |
| selector InvalidRetirementCertificate(address) | `0xce6e5c6a` | `0xce6e5c6a` | ok |
| selector designateSuccessor(address) | `0x3f44910b` | `0x3f44910b` | ok |
| selector acceptSuccession(address) | `0x155bd17f` | `0x155bd17f` | ok |
| selector cancelSuccessorDesignation() | `0x72536881` | `0x72536881` | ok |
| selector confirmSuccessor() | `0x50028ed1` | `0x50028ed1` | ok |
| selector resignSuccession(address) | `0x3767579e` | `0x3767579e` | ok |
| selector successorDelay() | `0x36979a21` | `0x36979a21` | ok |
| selector successorOf(address) | `0x5adbc9c7` | `0x5adbc9c7` | ok |
| selector pendingSuccessorOf(address) | `0x2ea04055` | `0x2ea04055` | ok |
| selector raiseSuccessorDelay(uint64) | `0x0e92c10c` | `0x0e92c10c` | ok |
| selector successorDelayOf(address) | `0xc88e629a` | `0xc88e629a` | ok |
| selector retireAccountWithSig(address,address,uint256[],bytes) | `0x4b9ec076` | `0x4b9ec076` | ok |
| ERC-1271 magic value: selector isValidSignature(bytes32,bytes) | `0x1626ba7e` | `0x1626ba7e` | ok |
| ERC-165's invalid interface id (fixed by ERC-165, not computed) | `0xffffffff` | `0xffffffff` | ok |
| interface id Core (XOR of 2 selectors) | `0x556d2088` | `0x556d2088` | ok |
| interface id E1 (XOR of 8 selectors) | `0x7dc5e209` | `0x7dc5e209` | ok |
| interface id E1 delay (XOR of 2 selectors) | `0xc61ca396` | `0xc61ca396` | ok |
| interface id E2 (XOR of 1 selectors) | `0x4b9ec076` | `0x4b9ec076` | ok |
| DOMAIN_TYPEHASH | `0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3` | `0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3` | ok |
| RETIRE_TYPEHASH | `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b` | `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b` | ok |
| DOMAIN_SEPARATOR | `0xe16ad8114bca96b9be6acfdb949a5dad1eb876411203b58a5898f27f3cc4d10b` | `0xe16ad8114bca96b9be6acfdb949a5dad1eb876411203b58a5898f27f3cc4d10b` | ok |
| vector account = test mnemonic index 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | ok |
| vector successor = test mnemonic index 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | ok |
| keccak256(abi.encodePacked(chainIds)) | `0x540231bc41c99331df1a62dea2893a5c70bdddd52347550f17df570e8b719eab` | `0x540231bc41c99331df1a62dea2893a5c70bdddd52347550f17df570e8b719eab` | ok |
| structHash | `0x1f81322eb97a9a429855c11d0e6138b920dfdd04f5d30da9f1a831b2234cec55` | `0x1f81322eb97a9a429855c11d0e6138b920dfdd04f5d30da9f1a831b2234cec55` | ok |
| digest | `0xca933c116695438e119a68f3f457dac8b4b9050e77210d19cdaa2be05106e98a` | `0xca933c116695438e119a68f3f457dac8b4b9050e77210d19cdaa2be05106e98a` | ok |
| signature (cast wallet sign --no-hash, index 0) | `0x2f2daa5d31e68624bed89cefce723bc9f21b880ea92b4f49f50d80ca00af115253f9db3981e50d97405d417aaf1992826d1e4d65cfe26881c2550ca600a55c371c` | `0x2f2daa5d31e68624bed89cefce723bc9f21b880ea92b4f49f50d80ca00af115253f9db3981e50d97405d417aaf1992826d1e4d65cfe26881c2550ca600a55c371c` | ok |
| ERC-7201 location of fhevm.storage.ACLRetirement | `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200` | `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200` | ok |

52 of 52 match.
