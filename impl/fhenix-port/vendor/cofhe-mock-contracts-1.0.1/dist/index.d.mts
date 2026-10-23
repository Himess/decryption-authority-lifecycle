import { DeferredTopicFilter, EventFragment, EventLog, TransactionRequest, Typed, ContractTransactionResponse, FunctionFragment, ContractTransaction, LogDescription, AddressLike, BigNumberish, BaseContract, ContractRunner, Interface, BytesLike, Result, Listener, ContractMethod } from 'ethers';

type MockArtifact = {
    contractName: string;
    abi: any;
} & ({
    isFixed: true;
    fixedAddress: string;
} | {
    isFixed: false;
});

declare const MockCoFHEAddressBookArtifact: {
    readonly contractName: "MockCoFHEAddressBook";
    readonly isFixed: true;
    readonly fixedAddress: "0xC0F4e00E531a2B086492Ae3DCC1515038307196b";
    readonly abi: readonly [{
        readonly type: "function";
        readonly name: "exists";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "getTm";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "tm";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "setTm";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "tm";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "unsetTm";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "event";
        readonly name: "TaskManagerSet";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly indexed: true;
            readonly internalType: "uint256";
        }, {
            readonly name: "previous";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "current";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "error";
        readonly name: "InvalidAddress";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "TaskManagerNotSet";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }];
};

declare const MockTaskManagerArtifact: {
    readonly contractName: "MockTaskManager";
    readonly isFixed: true;
    readonly fixedAddress: "0x0000000000000000000000000000000000005000";
    readonly abi: readonly [{
        readonly type: "constructor";
        readonly inputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "MOCK_dispatchOperation";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "funcId";
            readonly type: "uint8";
            readonly internalType: "enum FunctionId";
        }, {
            readonly name: "inputs";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "arity";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "MOCK_logAllow";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "MOCK_setInEuintKey";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "value";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "acl";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "contract MockACL";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "aggregator";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "allow";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowForDecryption";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowGlobal";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowTransient";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "batchVerifyInputs";
        readonly inputs: readonly [{
            readonly name: "inputs";
            readonly type: "tuple[]";
            readonly internalType: "struct UnsignedEncryptedInput[]";
            readonly components: readonly [{
                readonly name: "ctHash";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "securityZone";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "utype";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }];
        }, {
            readonly name: "sender";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "createDecryptTask";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "createRandomTask";
        readonly inputs: readonly [{
            readonly name: "returnType";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "seed";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "securityZone";
            readonly type: "int32";
            readonly internalType: "int32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "createTask";
        readonly inputs: readonly [{
            readonly name: "returnType";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "funcId";
            readonly type: "uint8";
            readonly internalType: "enum FunctionId";
        }, {
            readonly name: "encryptedHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "extraInputs";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "decryptResultSigner";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "exists";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "getDecryptResult";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "getDecryptResultSafe";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "result";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "decrypted";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "handleDecryptResult";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "result";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "";
            readonly type: "address[]";
            readonly internalType: "address[]";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "handleError";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "errorMessage";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "inMockStorage";
        readonly inputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "initialize";
        readonly inputs: readonly [{
            readonly name: "initialOwner";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "isAllowed";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isAllowedWithPermission";
        readonly inputs: readonly [{
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }, {
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isInitialized";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isPubliclyAllowed";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "logOps";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "mockGasExcluded";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "mockStorage";
        readonly inputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "publishDecryptResult";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "result";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "publishDecryptResultBatch";
        readonly inputs: readonly [{
            readonly name: "ctHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "results";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "signatures";
            readonly type: "bytes[]";
            readonly internalType: "bytes[]";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "receiveCtHash";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "expectedSharer";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "removeFirstLetter";
        readonly inputs: readonly [{
            readonly name: "str";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "setACLContract";
        readonly inputs: readonly [{
            readonly name: "_aclAddress";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setAggregator";
        readonly inputs: readonly [{
            readonly name: "_aggregatorAddress";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setDecryptResultSigner";
        readonly inputs: readonly [{
            readonly name: "signer";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setLogOps";
        readonly inputs: readonly [{
            readonly name: "_logOps";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setMockGasExcluded";
        readonly inputs: readonly [{
            readonly name: "_mockGasExcluded";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setSecurityZoneMax";
        readonly inputs: readonly [{
            readonly name: "securityZone";
            readonly type: "int32";
            readonly internalType: "int32";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setSecurityZoneMin";
        readonly inputs: readonly [{
            readonly name: "securityZone";
            readonly type: "int32";
            readonly internalType: "int32";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setSecurityZones";
        readonly inputs: readonly [{
            readonly name: "minSZ";
            readonly type: "int32";
            readonly internalType: "int32";
        }, {
            readonly name: "maxSZ";
            readonly type: "int32";
            readonly internalType: "int32";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setVerifierSigner";
        readonly inputs: readonly [{
            readonly name: "signer";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "shareCtHash";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "receiver";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "sliceString";
        readonly inputs: readonly [{
            readonly name: "str";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "start";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "length";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "verifyDecryptResult";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "result";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "verifyDecryptResultBatch";
        readonly inputs: readonly [{
            readonly name: "ctHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "results";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "signatures";
            readonly type: "bytes[]";
            readonly internalType: "bytes[]";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "verifyDecryptResultBatchSafe";
        readonly inputs: readonly [{
            readonly name: "ctHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "results";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "signatures";
            readonly type: "bytes[]";
            readonly internalType: "bytes[]";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool[]";
            readonly internalType: "bool[]";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "verifyDecryptResultSafe";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "result";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "event";
        readonly name: "DecryptionResult";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "result";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "requestor";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "MockGasConsumed";
        readonly inputs: readonly [{
            readonly name: "gas";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "ProtocolNotification";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "operation";
            readonly type: "string";
            readonly indexed: false;
            readonly internalType: "string";
        }, {
            readonly name: "errorMessage";
            readonly type: "string";
            readonly indexed: false;
            readonly internalType: "string";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "TaskCreated";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "operation";
            readonly type: "string";
            readonly indexed: false;
            readonly internalType: "string";
        }, {
            readonly name: "input1";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "input2";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }, {
            readonly name: "input3";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "error";
        readonly name: "ACLNotAllowed";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "DecryptionResultNotReady";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }, {
        readonly type: "error";
        readonly name: "ECDSAInvalidSignature";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "ECDSAInvalidSignatureLength";
        readonly inputs: readonly [{
            readonly name: "length";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }, {
        readonly type: "error";
        readonly name: "ECDSAInvalidSignatureS";
        readonly inputs: readonly [{
            readonly name: "s";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly type: "error";
        readonly name: "InputNotInMockStorage";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidAddress";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "InvalidInputForFunction";
        readonly inputs: readonly [{
            readonly name: "functionName";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "inputType";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidInputType";
        readonly inputs: readonly [{
            readonly name: "actual";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "expected";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidInputsAmount";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "got";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "expected";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidOperationInputs";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidSecurityZone";
        readonly inputs: readonly [{
            readonly name: "zone";
            readonly type: "int32";
            readonly internalType: "int32";
        }, {
            readonly name: "min";
            readonly type: "int32";
            readonly internalType: "int32";
        }, {
            readonly name: "max";
            readonly type: "int32";
            readonly internalType: "int32";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidSignature";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "InvalidSigner";
        readonly inputs: readonly [{
            readonly name: "signer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "expectedSigner";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidThreeInputOperation";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidTwoInputOperation";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidTypeOrSecurityZone";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidUnaryOperation";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }];
    }, {
        readonly type: "error";
        readonly name: "LengthMismatch";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "OnlyAggregatorAllowed";
        readonly inputs: readonly [{
            readonly name: "caller";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "OnlyOwnerAllowed";
        readonly inputs: readonly [{
            readonly name: "caller";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "OnlySelf";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "RandomFunctionNotSupported";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "StringsInsufficientHexLength";
        readonly inputs: readonly [{
            readonly name: "value";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "length";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }, {
        readonly type: "error";
        readonly name: "TooManyInputs";
        readonly inputs: readonly [{
            readonly name: "operation";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "got";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "maxAllowed";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }];
};

declare const MockACLArtifact: {
    readonly contractName: "MockACL";
    readonly isFixed: false;
    readonly abi: readonly [{
        readonly type: "constructor";
        readonly inputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allow";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "requester";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowForDecryption";
        readonly inputs: readonly [{
            readonly name: "handlesList";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "requester";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowGlobal";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "requester";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowTransient";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "requester";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "allowedOnBehalf";
        readonly inputs: readonly [{
            readonly name: "delegatee";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "contractAddress";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "allowedTransient";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "checkPermissionValidity";
        readonly inputs: readonly [{
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "cleanTransientStorage";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "defaultRevokerContract";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "delegateAccount";
        readonly inputs: readonly [{
            readonly name: "delegatee";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "delegateeContract";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "eip712Domain";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "fields";
            readonly type: "bytes1";
            readonly internalType: "bytes1";
        }, {
            readonly name: "name";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "version";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "chainId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "verifyingContract";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "extensions";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "exists";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "getTaskManagerAddress";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "getVersion";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "globalAllowed";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "hashTypedDataV4";
        readonly inputs: readonly [{
            readonly name: "structHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isAllowed";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isAllowedForDecryption";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "isAllowedWithPermission";
        readonly inputs: readonly [{
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }, {
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "persistAllowed";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "receiveCtHash";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "expectedSharer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "receiver";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setDefaultRevokerContract";
        readonly inputs: readonly [{
            readonly name: "newAddress";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setShareRegistry";
        readonly inputs: readonly [{
            readonly name: "newAddress";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "setTaskManager";
        readonly inputs: readonly [{
            readonly name: "newAddress";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "shareCtHash";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "sharer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "receiver";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "shareRegistry";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "event";
        readonly name: "AllowedForDecryption";
        readonly inputs: readonly [{
            readonly name: "handlesList";
            readonly type: "uint256[]";
            readonly indexed: false;
            readonly internalType: "uint256[]";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "DefaultRevokerContractUpdated";
        readonly inputs: readonly [{
            readonly name: "oldAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }, {
            readonly name: "newAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "EIP712DomainChanged";
        readonly inputs: readonly [];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "Initialized";
        readonly inputs: readonly [{
            readonly name: "version";
            readonly type: "uint64";
            readonly indexed: false;
            readonly internalType: "uint64";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "NewDelegation";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "delegatee";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "contractAddress";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "ShareRegistryUpdated";
        readonly inputs: readonly [{
            readonly name: "oldAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }, {
            readonly name: "newAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "TaskManagerUpdated";
        readonly inputs: readonly [{
            readonly name: "oldAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }, {
            readonly name: "newAddress";
            readonly type: "address";
            readonly indexed: false;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "error";
        readonly name: "AlreadyDelegated";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "DirectAllowForbidden";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "InvalidInitialization";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "InvalidTaskManagerAddress";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "NotInitializing";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "NotShared";
        readonly inputs: readonly [{
            readonly name: "handle";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "receiver";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "PermissionInvalid_Disabled";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "PermissionInvalid_Expired";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "PermissionInvalid_IssuerSignature";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "PermissionInvalid_RecipientSignature";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "SenderCannotBeDelegateeAddress";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "SenderNotAllowed";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "UnexpectedSharer";
        readonly inputs: readonly [{
            readonly name: "expected";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "actual";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }];
};

declare const ACPTimestampRevokerArtifact: {
    readonly contractName: "ACPTimestampRevoker";
    readonly isFixed: false;
    readonly abi: readonly [{
        readonly type: "function";
        readonly name: "disabled";
        readonly inputs: readonly [{
            readonly name: "issuer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "revokeAllAt";
        readonly inputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "revokeAllExisting";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "revokeSingle";
        readonly inputs: readonly [{
            readonly name: "id";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "revokedSingle";
        readonly inputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "event";
        readonly name: "RevokedAll";
        readonly inputs: readonly [{
            readonly name: "issuer";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "at";
            readonly type: "uint256";
            readonly indexed: false;
            readonly internalType: "uint256";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "RevokedSingle";
        readonly inputs: readonly [{
            readonly name: "issuer";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "id";
            readonly type: "uint256";
            readonly indexed: true;
            readonly internalType: "uint256";
        }];
        readonly anonymous: false;
    }];
};

declare const ACPShareRegistryArtifact: {
    readonly contractName: "ACPShareRegistry";
    readonly isFixed: false;
    readonly abi: readonly [{
        readonly type: "constructor";
        readonly inputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "DEFAULT_ADMIN_ROLE";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "UPGRADER_ROLE";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "UPGRADE_INTERFACE_VERSION";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "getRoleAdmin";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "getShare";
        readonly inputs: readonly [{
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "tuple";
            readonly internalType: "struct ACPShareRegistry.ShareHeader";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "blockNumber";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }];
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "grantRole";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "hasRole";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "initialize";
        readonly inputs: readonly [{
            readonly name: "initialAdmin";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "isShareValid";
        readonly inputs: readonly [{
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "proxiableUUID";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "removeShare";
        readonly inputs: readonly [{
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "renounceRole";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "callerConfirmation";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "revokeRole";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "share";
        readonly inputs: readonly [{
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }, {
            readonly name: "metadata";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [{
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "sharesFor";
        readonly inputs: readonly [{
            readonly name: "recipient";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "shareIds";
            readonly type: "bytes32[]";
            readonly internalType: "bytes32[]";
        }, {
            readonly name: "headers";
            readonly type: "tuple[]";
            readonly internalType: "struct ACPShareRegistry.ShareHeader[]";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "blockNumber";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }];
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "supportsInterface";
        readonly inputs: readonly [{
            readonly name: "interfaceId";
            readonly type: "bytes4";
            readonly internalType: "bytes4";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "upgradeToAndCall";
        readonly inputs: readonly [{
            readonly name: "newImplementation";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "data";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
    }, {
        readonly type: "event";
        readonly name: "Initialized";
        readonly inputs: readonly [{
            readonly name: "version";
            readonly type: "uint64";
            readonly indexed: false;
            readonly internalType: "uint64";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "RoleAdminChanged";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }, {
            readonly name: "previousAdminRole";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }, {
            readonly name: "newAdminRole";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "RoleGranted";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "sender";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "RoleRevoked";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }, {
            readonly name: "account";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "sender";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "ShareRemoved";
        readonly inputs: readonly [{
            readonly name: "recipient";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "issuer";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "Shared";
        readonly inputs: readonly [{
            readonly name: "recipient";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "issuer";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }, {
            readonly name: "shareId";
            readonly type: "bytes32";
            readonly indexed: true;
            readonly internalType: "bytes32";
        }, {
            readonly name: "acp";
            readonly type: "tuple";
            readonly indexed: false;
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }, {
            readonly name: "metadata";
            readonly type: "bytes";
            readonly indexed: false;
            readonly internalType: "bytes";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "event";
        readonly name: "Upgraded";
        readonly inputs: readonly [{
            readonly name: "implementation";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "error";
        readonly name: "AccessControlBadConfirmation";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "AccessControlUnauthorizedAccount";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "neededRole";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly type: "error";
        readonly name: "AddressEmptyCode";
        readonly inputs: readonly [{
            readonly name: "target";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "AlreadyShared";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "ERC1967InvalidImplementation";
        readonly inputs: readonly [{
            readonly name: "implementation";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "ERC1967NonPayable";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "FailedCall";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "InvalidInitialization";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "IssuerSignatureMissing";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "NotInitializing";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "NotIssuer";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "NotIssuerOrRecipient";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "RecipientMissing";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "SealingKeyMustBeEmpty";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "ShareExpired";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "UUPSUnauthorizedCallContext";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "UUPSUnsupportedProxiableUUID";
        readonly inputs: readonly [{
            readonly name: "slot";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly type: "error";
        readonly name: "UnknownShare";
        readonly inputs: readonly [];
    }];
};

declare const MockERC1967ProxyArtifact: {
    readonly contractName: "MockERC1967Proxy";
    readonly isFixed: false;
    readonly abi: readonly [{
        readonly type: "constructor";
        readonly inputs: readonly [{
            readonly name: "implementation";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "data";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly stateMutability: "payable";
    }, {
        readonly type: "fallback";
        readonly stateMutability: "payable";
    }, {
        readonly type: "event";
        readonly name: "Upgraded";
        readonly inputs: readonly [{
            readonly name: "implementation";
            readonly type: "address";
            readonly indexed: true;
            readonly internalType: "address";
        }];
        readonly anonymous: false;
    }, {
        readonly type: "error";
        readonly name: "AddressEmptyCode";
        readonly inputs: readonly [{
            readonly name: "target";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "ERC1967InvalidImplementation";
        readonly inputs: readonly [{
            readonly name: "implementation";
            readonly type: "address";
            readonly internalType: "address";
        }];
    }, {
        readonly type: "error";
        readonly name: "ERC1967NonPayable";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "FailedCall";
        readonly inputs: readonly [];
    }];
};

declare const MockZkVerifierArtifact: {
    readonly contractName: "MockZkVerifier";
    readonly isFixed: true;
    readonly fixedAddress: "0x0000000000000000000000000000000000005001";
    readonly abi: readonly [{
        readonly type: "function";
        readonly name: "exists";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "insertCtHash";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "value";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "insertPackedCtHashes";
        readonly inputs: readonly [{
            readonly name: "ctHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "values";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "zkVerify";
        readonly inputs: readonly [{
            readonly name: "value";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "utype";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "user";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "securityZone";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "tuple";
            readonly internalType: "struct EncryptedInput";
            readonly components: readonly [{
                readonly name: "ctHash";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "securityZone";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "utype";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "signature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "zkVerifyCalcCtHash";
        readonly inputs: readonly [{
            readonly name: "value";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "utype";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "user";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "securityZone";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "zkVerifyCalcCtHashesPacked";
        readonly inputs: readonly [{
            readonly name: "values";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "utypes";
            readonly type: "uint8[]";
            readonly internalType: "uint8[]";
        }, {
            readonly name: "user";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "securityZone";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "chainId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "ctHashes";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "zkVerifyPacked";
        readonly inputs: readonly [{
            readonly name: "values";
            readonly type: "uint256[]";
            readonly internalType: "uint256[]";
        }, {
            readonly name: "utypes";
            readonly type: "uint8[]";
            readonly internalType: "uint8[]";
        }, {
            readonly name: "user";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "securityZone";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "chainId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "inputs";
            readonly type: "tuple[]";
            readonly internalType: "struct EncryptedInput[]";
            readonly components: readonly [{
                readonly name: "ctHash";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "securityZone";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "utype";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "signature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "error";
        readonly name: "InvalidInputs";
        readonly inputs: readonly [];
    }];
};

declare const MockThresholdNetworkArtifact: {
    readonly contractName: "MockThresholdNetwork";
    readonly isFixed: true;
    readonly fixedAddress: "0x0000000000000000000000000000000000005002";
    readonly abi: readonly [{
        readonly type: "function";
        readonly name: "decodeLowLevelReversion";
        readonly inputs: readonly [{
            readonly name: "data";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
        readonly outputs: readonly [{
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "decryptForTxWithACP";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly outputs: readonly [{
            readonly name: "allowed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "decryptedValue";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "decryptForTxWithoutACP";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly outputs: readonly [{
            readonly name: "allowed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "decryptedValue";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "exists";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "initialize";
        readonly inputs: readonly [{
            readonly name: "_taskManager";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "_acl";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
    }, {
        readonly type: "function";
        readonly name: "mockAcl";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "contract MockACL";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "mockQueryDecrypt";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "issuer";
            readonly type: "address";
            readonly internalType: "address";
        }];
        readonly outputs: readonly [{
            readonly name: "allowed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "mockTaskManager";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "address";
            readonly internalType: "contract MockTaskManager";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "queryDecrypt";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly outputs: readonly [{
            readonly name: "allowed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "querySealOutput";
        readonly inputs: readonly [{
            readonly name: "ctHash";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "acp";
            readonly type: "tuple";
            readonly internalType: "struct ACP";
            readonly components: readonly [{
                readonly name: "issuer";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "expiration";
                readonly type: "uint64";
                readonly internalType: "uint64";
            }, {
                readonly name: "recipient";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "revokerData";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "revokerContract";
                readonly type: "address";
                readonly internalType: "address";
            }, {
                readonly name: "scope";
                readonly type: "uint8";
                readonly internalType: "uint8";
            }, {
                readonly name: "contracts";
                readonly type: "address[]";
                readonly internalType: "address[]";
            }, {
                readonly name: "handles";
                readonly type: "bytes32[]";
                readonly internalType: "bytes32[]";
            }, {
                readonly name: "sealingKey";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "issuerSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "recipientSignature";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }];
        }];
        readonly outputs: readonly [{
            readonly name: "allowed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "error";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "view";
    }, {
        readonly type: "function";
        readonly name: "seal";
        readonly inputs: readonly [{
            readonly name: "input";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "key";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "function";
        readonly name: "unseal";
        readonly inputs: readonly [{
            readonly name: "hashed";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "key";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
        readonly outputs: readonly [{
            readonly name: "";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
        readonly stateMutability: "pure";
    }, {
        readonly type: "error";
        readonly name: "NotAllowed";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "SealingKeyInvalid";
        readonly inputs: readonly [];
    }, {
        readonly type: "error";
        readonly name: "SealingKeyMissing";
        readonly inputs: readonly [];
    }];
};

interface TypedDeferredTopicFilter<_TCEvent extends TypedContractEvent> extends DeferredTopicFilter {
}
interface TypedContractEvent<InputTuple extends Array<any> = any, OutputTuple extends Array<any> = any, OutputObject = any> {
    (...args: Partial<InputTuple>): TypedDeferredTopicFilter<TypedContractEvent<InputTuple, OutputTuple, OutputObject>>;
    name: string;
    fragment: EventFragment;
    getFragment(...args: Partial<InputTuple>): EventFragment;
}
type __TypechainAOutputTuple<T> = T extends TypedContractEvent<infer _U, infer W> ? W : never;
type __TypechainOutputObject<T> = T extends TypedContractEvent<infer _U, infer _W, infer V> ? V : never;
interface TypedEventLog<TCEvent extends TypedContractEvent> extends Omit<EventLog, 'args'> {
    args: __TypechainAOutputTuple<TCEvent> & __TypechainOutputObject<TCEvent>;
}
interface TypedLogDescription<TCEvent extends TypedContractEvent> extends Omit<LogDescription, 'args'> {
    args: __TypechainAOutputTuple<TCEvent> & __TypechainOutputObject<TCEvent>;
}
type TypedListener<TCEvent extends TypedContractEvent> = (...listenerArg: [...__TypechainAOutputTuple<TCEvent>, TypedEventLog<TCEvent>, ...undefined[]]) => void;
type StateMutability = 'nonpayable' | 'payable' | 'view';
type BaseOverrides = Omit<TransactionRequest, 'to' | 'data'>;
type NonPayableOverrides = Omit<BaseOverrides, 'value' | 'blockTag' | 'enableCcipRead'>;
type PayableOverrides = Omit<BaseOverrides, 'blockTag' | 'enableCcipRead'>;
type ViewOverrides = Omit<TransactionRequest, 'to' | 'data'>;
type Overrides<S extends StateMutability> = S extends 'nonpayable' ? NonPayableOverrides : S extends 'payable' ? PayableOverrides : ViewOverrides;
type PostfixOverrides<A extends Array<any>, S extends StateMutability> = A | [...A, Overrides<S>];
type ContractMethodArgs<A extends Array<any>, S extends StateMutability> = PostfixOverrides<{
    [I in keyof A]-?: A[I] | Typed;
}, S>;
type DefaultReturnType<R> = R extends Array<any> ? R[0] : R;
interface TypedContractMethod<A extends Array<any> = Array<any>, R = any, S extends StateMutability = 'payable'> {
    (...args: ContractMethodArgs<A, S>): S extends 'view' ? Promise<DefaultReturnType<R>> : Promise<ContractTransactionResponse>;
    name: string;
    fragment: FunctionFragment;
    getFragment(...args: ContractMethodArgs<A, S>): FunctionFragment;
    populateTransaction(...args: ContractMethodArgs<A, S>): Promise<ContractTransaction>;
    staticCall(...args: ContractMethodArgs<A, 'view'>): Promise<DefaultReturnType<R>>;
    send(...args: ContractMethodArgs<A, S>): Promise<ContractTransactionResponse>;
    estimateGas(...args: ContractMethodArgs<A, S>): Promise<bigint>;
    staticCallResult(...args: ContractMethodArgs<A, 'view'>): Promise<R>;
}

type ACPStruct$3 = {
    issuer: AddressLike;
    expiration: BigNumberish;
    recipient: AddressLike;
    revokerData: BigNumberish;
    revokerContract: AddressLike;
    scope: BigNumberish;
    contracts: AddressLike[];
    handles: BytesLike[];
    sealingKey: BytesLike;
    issuerSignature: BytesLike;
    recipientSignature: BytesLike;
};
type ACPStructOutput = [
    issuer: string,
    expiration: bigint,
    recipient: string,
    revokerData: bigint,
    revokerContract: string,
    scope: bigint,
    contracts: string[],
    handles: string[],
    sealingKey: string,
    issuerSignature: string,
    recipientSignature: string
] & {
    issuer: string;
    expiration: bigint;
    recipient: string;
    revokerData: bigint;
    revokerContract: string;
    scope: bigint;
    contracts: string[];
    handles: string[];
    sealingKey: string;
    issuerSignature: string;
    recipientSignature: string;
};
interface ACPShareRegistryInterface extends Interface {
    getFunction(nameOrSignature: 'DEFAULT_ADMIN_ROLE' | 'UPGRADER_ROLE' | 'UPGRADE_INTERFACE_VERSION' | 'getRoleAdmin' | 'getShare' | 'grantRole' | 'hasRole' | 'initialize' | 'isShareValid' | 'proxiableUUID' | 'removeShare' | 'renounceRole' | 'revokeRole' | 'share' | 'sharesFor' | 'supportsInterface' | 'upgradeToAndCall'): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: 'Initialized' | 'RoleAdminChanged' | 'RoleGranted' | 'RoleRevoked' | 'ShareRemoved' | 'Shared' | 'Upgraded'): EventFragment;
    encodeFunctionData(functionFragment: 'DEFAULT_ADMIN_ROLE', values?: undefined): string;
    encodeFunctionData(functionFragment: 'UPGRADER_ROLE', values?: undefined): string;
    encodeFunctionData(functionFragment: 'UPGRADE_INTERFACE_VERSION', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getRoleAdmin', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'getShare', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'grantRole', values: [BytesLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'hasRole', values: [BytesLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'initialize', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'isShareValid', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'proxiableUUID', values?: undefined): string;
    encodeFunctionData(functionFragment: 'removeShare', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'renounceRole', values: [BytesLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'revokeRole', values: [BytesLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'share', values: [ACPStruct$3, BytesLike]): string;
    encodeFunctionData(functionFragment: 'sharesFor', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'supportsInterface', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'upgradeToAndCall', values: [AddressLike, BytesLike]): string;
    decodeFunctionResult(functionFragment: 'DEFAULT_ADMIN_ROLE', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'UPGRADER_ROLE', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'UPGRADE_INTERFACE_VERSION', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getRoleAdmin', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getShare', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'grantRole', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'hasRole', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isShareValid', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'proxiableUUID', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'removeShare', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'renounceRole', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'revokeRole', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'share', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'sharesFor', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'supportsInterface', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'upgradeToAndCall', data: BytesLike): Result;
}
declare namespace InitializedEvent$1 {
    type InputTuple = [version: BigNumberish];
    type OutputTuple = [version: bigint];
    interface OutputObject {
        version: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace RoleAdminChangedEvent {
    type InputTuple = [role: BytesLike, previousAdminRole: BytesLike, newAdminRole: BytesLike];
    type OutputTuple = [role: string, previousAdminRole: string, newAdminRole: string];
    interface OutputObject {
        role: string;
        previousAdminRole: string;
        newAdminRole: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace RoleGrantedEvent {
    type InputTuple = [role: BytesLike, account: AddressLike, sender: AddressLike];
    type OutputTuple = [role: string, account: string, sender: string];
    interface OutputObject {
        role: string;
        account: string;
        sender: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace RoleRevokedEvent {
    type InputTuple = [role: BytesLike, account: AddressLike, sender: AddressLike];
    type OutputTuple = [role: string, account: string, sender: string];
    interface OutputObject {
        role: string;
        account: string;
        sender: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace ShareRemovedEvent {
    type InputTuple = [recipient: AddressLike, issuer: AddressLike, shareId: BytesLike];
    type OutputTuple = [recipient: string, issuer: string, shareId: string];
    interface OutputObject {
        recipient: string;
        issuer: string;
        shareId: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace SharedEvent {
    type InputTuple = [
        recipient: AddressLike,
        issuer: AddressLike,
        shareId: BytesLike,
        acp: ACPStruct$3,
        metadata: BytesLike
    ];
    type OutputTuple = [
        recipient: string,
        issuer: string,
        shareId: string,
        acp: ACPStructOutput,
        metadata: string
    ];
    interface OutputObject {
        recipient: string;
        issuer: string;
        shareId: string;
        acp: ACPStructOutput;
        metadata: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace UpgradedEvent$1 {
    type InputTuple = [implementation: AddressLike];
    type OutputTuple = [implementation: string];
    interface OutputObject {
        implementation: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace ACPShareRegistry {
    type ShareHeaderStruct = {
        issuer: AddressLike;
        expiration: BigNumberish;
        recipient: AddressLike;
        blockNumber: BigNumberish;
        revokerContract: AddressLike;
        revokerData: BigNumberish;
    };
    type ShareHeaderStructOutput = [
        issuer: string,
        expiration: bigint,
        recipient: string,
        blockNumber: bigint,
        revokerContract: string,
        revokerData: bigint
    ] & {
        issuer: string;
        expiration: bigint;
        recipient: string;
        blockNumber: bigint;
        revokerContract: string;
        revokerData: bigint;
    };
}
interface ACPShareRegistry extends BaseContract {
    connect(runner?: ContractRunner | null): ACPShareRegistry;
    waitForDeployment(): Promise<this>;
    interface: ACPShareRegistryInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    DEFAULT_ADMIN_ROLE: TypedContractMethod<[], [string], 'view'>;
    UPGRADER_ROLE: TypedContractMethod<[], [string], 'view'>;
    UPGRADE_INTERFACE_VERSION: TypedContractMethod<[], [string], 'view'>;
    getRoleAdmin: TypedContractMethod<[role: BytesLike], [string], 'view'>;
    getShare: TypedContractMethod<[shareId: BytesLike], [ACPShareRegistry.ShareHeaderStructOutput], 'view'>;
    grantRole: TypedContractMethod<[role: BytesLike, account: AddressLike], [void], 'nonpayable'>;
    hasRole: TypedContractMethod<[role: BytesLike, account: AddressLike], [boolean], 'view'>;
    initialize: TypedContractMethod<[initialAdmin: AddressLike], [void], 'nonpayable'>;
    isShareValid: TypedContractMethod<[shareId: BytesLike], [boolean], 'view'>;
    proxiableUUID: TypedContractMethod<[], [string], 'view'>;
    removeShare: TypedContractMethod<[shareId: BytesLike], [void], 'nonpayable'>;
    renounceRole: TypedContractMethod<[role: BytesLike, callerConfirmation: AddressLike], [void], 'nonpayable'>;
    revokeRole: TypedContractMethod<[role: BytesLike, account: AddressLike], [void], 'nonpayable'>;
    share: TypedContractMethod<[acp: ACPStruct$3, metadata: BytesLike], [string], 'nonpayable'>;
    sharesFor: TypedContractMethod<[
        recipient: AddressLike
    ], [
        [
            string[],
            ACPShareRegistry.ShareHeaderStructOutput[]
        ] & {
            shareIds: string[];
            headers: ACPShareRegistry.ShareHeaderStructOutput[];
        }
    ], 'view'>;
    supportsInterface: TypedContractMethod<[interfaceId: BytesLike], [boolean], 'view'>;
    upgradeToAndCall: TypedContractMethod<[newImplementation: AddressLike, data: BytesLike], [void], 'payable'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'DEFAULT_ADMIN_ROLE'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'UPGRADER_ROLE'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'UPGRADE_INTERFACE_VERSION'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'getRoleAdmin'): TypedContractMethod<[role: BytesLike], [string], 'view'>;
    getFunction(nameOrSignature: 'getShare'): TypedContractMethod<[shareId: BytesLike], [ACPShareRegistry.ShareHeaderStructOutput], 'view'>;
    getFunction(nameOrSignature: 'grantRole'): TypedContractMethod<[role: BytesLike, account: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'hasRole'): TypedContractMethod<[role: BytesLike, account: AddressLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'initialize'): TypedContractMethod<[initialAdmin: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'isShareValid'): TypedContractMethod<[shareId: BytesLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'proxiableUUID'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'removeShare'): TypedContractMethod<[shareId: BytesLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'renounceRole'): TypedContractMethod<[role: BytesLike, callerConfirmation: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'revokeRole'): TypedContractMethod<[role: BytesLike, account: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'share'): TypedContractMethod<[acp: ACPStruct$3, metadata: BytesLike], [string], 'nonpayable'>;
    getFunction(nameOrSignature: 'sharesFor'): TypedContractMethod<[
        recipient: AddressLike
    ], [
        [
            string[],
            ACPShareRegistry.ShareHeaderStructOutput[]
        ] & {
            shareIds: string[];
            headers: ACPShareRegistry.ShareHeaderStructOutput[];
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'supportsInterface'): TypedContractMethod<[interfaceId: BytesLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'upgradeToAndCall'): TypedContractMethod<[newImplementation: AddressLike, data: BytesLike], [void], 'payable'>;
    getEvent(key: 'Initialized'): TypedContractEvent<InitializedEvent$1.InputTuple, InitializedEvent$1.OutputTuple, InitializedEvent$1.OutputObject>;
    getEvent(key: 'RoleAdminChanged'): TypedContractEvent<RoleAdminChangedEvent.InputTuple, RoleAdminChangedEvent.OutputTuple, RoleAdminChangedEvent.OutputObject>;
    getEvent(key: 'RoleGranted'): TypedContractEvent<RoleGrantedEvent.InputTuple, RoleGrantedEvent.OutputTuple, RoleGrantedEvent.OutputObject>;
    getEvent(key: 'RoleRevoked'): TypedContractEvent<RoleRevokedEvent.InputTuple, RoleRevokedEvent.OutputTuple, RoleRevokedEvent.OutputObject>;
    getEvent(key: 'ShareRemoved'): TypedContractEvent<ShareRemovedEvent.InputTuple, ShareRemovedEvent.OutputTuple, ShareRemovedEvent.OutputObject>;
    getEvent(key: 'Shared'): TypedContractEvent<SharedEvent.InputTuple, SharedEvent.OutputTuple, SharedEvent.OutputObject>;
    getEvent(key: 'Upgraded'): TypedContractEvent<UpgradedEvent$1.InputTuple, UpgradedEvent$1.OutputTuple, UpgradedEvent$1.OutputObject>;
    filters: {
        'Initialized(uint64)': TypedContractEvent<InitializedEvent$1.InputTuple, InitializedEvent$1.OutputTuple, InitializedEvent$1.OutputObject>;
        Initialized: TypedContractEvent<InitializedEvent$1.InputTuple, InitializedEvent$1.OutputTuple, InitializedEvent$1.OutputObject>;
        'RoleAdminChanged(bytes32,bytes32,bytes32)': TypedContractEvent<RoleAdminChangedEvent.InputTuple, RoleAdminChangedEvent.OutputTuple, RoleAdminChangedEvent.OutputObject>;
        RoleAdminChanged: TypedContractEvent<RoleAdminChangedEvent.InputTuple, RoleAdminChangedEvent.OutputTuple, RoleAdminChangedEvent.OutputObject>;
        'RoleGranted(bytes32,address,address)': TypedContractEvent<RoleGrantedEvent.InputTuple, RoleGrantedEvent.OutputTuple, RoleGrantedEvent.OutputObject>;
        RoleGranted: TypedContractEvent<RoleGrantedEvent.InputTuple, RoleGrantedEvent.OutputTuple, RoleGrantedEvent.OutputObject>;
        'RoleRevoked(bytes32,address,address)': TypedContractEvent<RoleRevokedEvent.InputTuple, RoleRevokedEvent.OutputTuple, RoleRevokedEvent.OutputObject>;
        RoleRevoked: TypedContractEvent<RoleRevokedEvent.InputTuple, RoleRevokedEvent.OutputTuple, RoleRevokedEvent.OutputObject>;
        'ShareRemoved(address,address,bytes32)': TypedContractEvent<ShareRemovedEvent.InputTuple, ShareRemovedEvent.OutputTuple, ShareRemovedEvent.OutputObject>;
        ShareRemoved: TypedContractEvent<ShareRemovedEvent.InputTuple, ShareRemovedEvent.OutputTuple, ShareRemovedEvent.OutputObject>;
        'Shared(address,address,bytes32,tuple,bytes)': TypedContractEvent<SharedEvent.InputTuple, SharedEvent.OutputTuple, SharedEvent.OutputObject>;
        Shared: TypedContractEvent<SharedEvent.InputTuple, SharedEvent.OutputTuple, SharedEvent.OutputObject>;
        'Upgraded(address)': TypedContractEvent<UpgradedEvent$1.InputTuple, UpgradedEvent$1.OutputTuple, UpgradedEvent$1.OutputObject>;
        Upgraded: TypedContractEvent<UpgradedEvent$1.InputTuple, UpgradedEvent$1.OutputTuple, UpgradedEvent$1.OutputObject>;
    };
}

interface ACPTimestampRevokerInterface extends Interface {
    getFunction(nameOrSignature: 'disabled' | 'revokeAllAt' | 'revokeAllExisting' | 'revokeSingle' | 'revokedSingle'): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: 'RevokedAll' | 'RevokedSingle'): EventFragment;
    encodeFunctionData(functionFragment: 'disabled', values: [AddressLike, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'revokeAllAt', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'revokeAllExisting', values?: undefined): string;
    encodeFunctionData(functionFragment: 'revokeSingle', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'revokedSingle', values: [AddressLike, BigNumberish]): string;
    decodeFunctionResult(functionFragment: 'disabled', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'revokeAllAt', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'revokeAllExisting', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'revokeSingle', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'revokedSingle', data: BytesLike): Result;
}
declare namespace RevokedAllEvent {
    type InputTuple = [issuer: AddressLike, at: BigNumberish];
    type OutputTuple = [issuer: string, at: bigint];
    interface OutputObject {
        issuer: string;
        at: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace RevokedSingleEvent {
    type InputTuple = [issuer: AddressLike, id: BigNumberish];
    type OutputTuple = [issuer: string, id: bigint];
    interface OutputObject {
        issuer: string;
        id: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
interface ACPTimestampRevoker extends BaseContract {
    connect(runner?: ContractRunner | null): ACPTimestampRevoker;
    waitForDeployment(): Promise<this>;
    interface: ACPTimestampRevokerInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    disabled: TypedContractMethod<[issuer: AddressLike, id: BigNumberish], [boolean], 'view'>;
    revokeAllAt: TypedContractMethod<[arg0: AddressLike], [bigint], 'view'>;
    revokeAllExisting: TypedContractMethod<[], [void], 'nonpayable'>;
    revokeSingle: TypedContractMethod<[id: BigNumberish], [void], 'nonpayable'>;
    revokedSingle: TypedContractMethod<[arg0: AddressLike, arg1: BigNumberish], [boolean], 'view'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'disabled'): TypedContractMethod<[issuer: AddressLike, id: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'revokeAllAt'): TypedContractMethod<[arg0: AddressLike], [bigint], 'view'>;
    getFunction(nameOrSignature: 'revokeAllExisting'): TypedContractMethod<[], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'revokeSingle'): TypedContractMethod<[id: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'revokedSingle'): TypedContractMethod<[arg0: AddressLike, arg1: BigNumberish], [boolean], 'view'>;
    getEvent(key: 'RevokedAll'): TypedContractEvent<RevokedAllEvent.InputTuple, RevokedAllEvent.OutputTuple, RevokedAllEvent.OutputObject>;
    getEvent(key: 'RevokedSingle'): TypedContractEvent<RevokedSingleEvent.InputTuple, RevokedSingleEvent.OutputTuple, RevokedSingleEvent.OutputObject>;
    filters: {
        'RevokedAll(address,uint256)': TypedContractEvent<RevokedAllEvent.InputTuple, RevokedAllEvent.OutputTuple, RevokedAllEvent.OutputObject>;
        RevokedAll: TypedContractEvent<RevokedAllEvent.InputTuple, RevokedAllEvent.OutputTuple, RevokedAllEvent.OutputObject>;
        'RevokedSingle(address,uint256)': TypedContractEvent<RevokedSingleEvent.InputTuple, RevokedSingleEvent.OutputTuple, RevokedSingleEvent.OutputObject>;
        RevokedSingle: TypedContractEvent<RevokedSingleEvent.InputTuple, RevokedSingleEvent.OutputTuple, RevokedSingleEvent.OutputObject>;
    };
}

type ACPStruct$2 = {
    issuer: AddressLike;
    expiration: BigNumberish;
    recipient: AddressLike;
    revokerData: BigNumberish;
    revokerContract: AddressLike;
    scope: BigNumberish;
    contracts: AddressLike[];
    handles: BytesLike[];
    sealingKey: BytesLike;
    issuerSignature: BytesLike;
    recipientSignature: BytesLike;
};
interface MockACLInterface extends Interface {
    getFunction(nameOrSignature: 'allow' | 'allowForDecryption' | 'allowGlobal' | 'allowTransient' | 'allowedOnBehalf' | 'allowedTransient' | 'checkPermissionValidity' | 'cleanTransientStorage' | 'defaultRevokerContract' | 'delegateAccount' | 'eip712Domain' | 'exists' | 'getTaskManagerAddress' | 'getVersion' | 'globalAllowed' | 'hashTypedDataV4' | 'isAllowed' | 'isAllowedForDecryption' | 'isAllowedWithPermission' | 'persistAllowed' | 'receiveCtHash' | 'setDefaultRevokerContract' | 'setShareRegistry' | 'setTaskManager' | 'shareCtHash' | 'shareRegistry'): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: 'AllowedForDecryption' | 'DefaultRevokerContractUpdated' | 'EIP712DomainChanged' | 'Initialized' | 'NewDelegation' | 'ShareRegistryUpdated' | 'TaskManagerUpdated'): EventFragment;
    encodeFunctionData(functionFragment: 'allow', values: [BigNumberish, AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowForDecryption', values: [BigNumberish[], AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowGlobal', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowTransient', values: [BigNumberish, AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowedOnBehalf', values: [AddressLike, BigNumberish, AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowedTransient', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'checkPermissionValidity', values: [ACPStruct$2]): string;
    encodeFunctionData(functionFragment: 'cleanTransientStorage', values?: undefined): string;
    encodeFunctionData(functionFragment: 'defaultRevokerContract', values?: undefined): string;
    encodeFunctionData(functionFragment: 'delegateAccount', values: [AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'eip712Domain', values?: undefined): string;
    encodeFunctionData(functionFragment: 'exists', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getTaskManagerAddress', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getVersion', values?: undefined): string;
    encodeFunctionData(functionFragment: 'globalAllowed', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'hashTypedDataV4', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'isAllowed', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'isAllowedForDecryption', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'isAllowedWithPermission', values: [ACPStruct$2, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'persistAllowed', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'receiveCtHash', values: [BigNumberish, AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'setDefaultRevokerContract', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'setShareRegistry', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'setTaskManager', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'shareCtHash', values: [BigNumberish, AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'shareRegistry', values?: undefined): string;
    decodeFunctionResult(functionFragment: 'allow', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowForDecryption', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowGlobal', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowTransient', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowedOnBehalf', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowedTransient', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'checkPermissionValidity', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'cleanTransientStorage', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'defaultRevokerContract', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'delegateAccount', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'eip712Domain', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'exists', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getTaskManagerAddress', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getVersion', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'globalAllowed', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'hashTypedDataV4', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isAllowed', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isAllowedForDecryption', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isAllowedWithPermission', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'persistAllowed', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'receiveCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setDefaultRevokerContract', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setShareRegistry', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setTaskManager', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'shareCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'shareRegistry', data: BytesLike): Result;
}
declare namespace AllowedForDecryptionEvent {
    type InputTuple = [handlesList: BigNumberish[]];
    type OutputTuple = [handlesList: bigint[]];
    interface OutputObject {
        handlesList: bigint[];
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace DefaultRevokerContractUpdatedEvent {
    type InputTuple = [oldAddress: AddressLike, newAddress: AddressLike];
    type OutputTuple = [oldAddress: string, newAddress: string];
    interface OutputObject {
        oldAddress: string;
        newAddress: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace EIP712DomainChangedEvent {
    type InputTuple = [];
    type OutputTuple = [];
    interface OutputObject {
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace InitializedEvent {
    type InputTuple = [version: BigNumberish];
    type OutputTuple = [version: bigint];
    interface OutputObject {
        version: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace NewDelegationEvent {
    type InputTuple = [sender: AddressLike, delegatee: AddressLike, contractAddress: AddressLike];
    type OutputTuple = [sender: string, delegatee: string, contractAddress: string];
    interface OutputObject {
        sender: string;
        delegatee: string;
        contractAddress: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace ShareRegistryUpdatedEvent {
    type InputTuple = [oldAddress: AddressLike, newAddress: AddressLike];
    type OutputTuple = [oldAddress: string, newAddress: string];
    interface OutputObject {
        oldAddress: string;
        newAddress: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace TaskManagerUpdatedEvent {
    type InputTuple = [oldAddress: AddressLike, newAddress: AddressLike];
    type OutputTuple = [oldAddress: string, newAddress: string];
    interface OutputObject {
        oldAddress: string;
        newAddress: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
interface MockACL extends BaseContract {
    connect(runner?: ContractRunner | null): MockACL;
    waitForDeployment(): Promise<this>;
    interface: MockACLInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    allow: TypedContractMethod<[
        handle: BigNumberish,
        account: AddressLike,
        requester: AddressLike
    ], [
        void
    ], 'nonpayable'>;
    allowForDecryption: TypedContractMethod<[handlesList: BigNumberish[], requester: AddressLike], [void], 'nonpayable'>;
    allowGlobal: TypedContractMethod<[handle: BigNumberish, requester: AddressLike], [void], 'nonpayable'>;
    allowTransient: TypedContractMethod<[
        handle: BigNumberish,
        account: AddressLike,
        requester: AddressLike
    ], [
        void
    ], 'nonpayable'>;
    allowedOnBehalf: TypedContractMethod<[
        delegatee: AddressLike,
        handle: BigNumberish,
        contractAddress: AddressLike,
        account: AddressLike
    ], [
        boolean
    ], 'view'>;
    allowedTransient: TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    checkPermissionValidity: TypedContractMethod<[acp: ACPStruct$2], [boolean], 'view'>;
    cleanTransientStorage: TypedContractMethod<[], [void], 'nonpayable'>;
    defaultRevokerContract: TypedContractMethod<[], [string], 'view'>;
    delegateAccount: TypedContractMethod<[delegatee: AddressLike, delegateeContract: AddressLike], [void], 'nonpayable'>;
    eip712Domain: TypedContractMethod<[
    ], [
        [
            string,
            string,
            string,
            bigint,
            string,
            string,
            bigint[]
        ] & {
            fields: string;
            name: string;
            version: string;
            chainId: bigint;
            verifyingContract: string;
            salt: string;
            extensions: bigint[];
        }
    ], 'view'>;
    exists: TypedContractMethod<[], [boolean], 'view'>;
    getTaskManagerAddress: TypedContractMethod<[], [string], 'view'>;
    getVersion: TypedContractMethod<[], [string], 'view'>;
    globalAllowed: TypedContractMethod<[handle: BigNumberish], [boolean], 'view'>;
    hashTypedDataV4: TypedContractMethod<[structHash: BytesLike], [string], 'view'>;
    isAllowed: TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    isAllowedForDecryption: TypedContractMethod<[handle: BigNumberish], [boolean], 'view'>;
    isAllowedWithPermission: TypedContractMethod<[acp: ACPStruct$2, handle: BigNumberish], [boolean], 'view'>;
    persistAllowed: TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    receiveCtHash: TypedContractMethod<[
        handle: BigNumberish,
        expectedSharer: AddressLike,
        receiver: AddressLike
    ], [
        void
    ], 'nonpayable'>;
    setDefaultRevokerContract: TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    setShareRegistry: TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    setTaskManager: TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    shareCtHash: TypedContractMethod<[
        handle: BigNumberish,
        sharer: AddressLike,
        receiver: AddressLike
    ], [
        void
    ], 'nonpayable'>;
    shareRegistry: TypedContractMethod<[], [string], 'view'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'allow'): TypedContractMethod<[handle: BigNumberish, account: AddressLike, requester: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowForDecryption'): TypedContractMethod<[handlesList: BigNumberish[], requester: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowGlobal'): TypedContractMethod<[handle: BigNumberish, requester: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowTransient'): TypedContractMethod<[handle: BigNumberish, account: AddressLike, requester: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowedOnBehalf'): TypedContractMethod<[
        delegatee: AddressLike,
        handle: BigNumberish,
        contractAddress: AddressLike,
        account: AddressLike
    ], [
        boolean
    ], 'view'>;
    getFunction(nameOrSignature: 'allowedTransient'): TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'checkPermissionValidity'): TypedContractMethod<[acp: ACPStruct$2], [boolean], 'view'>;
    getFunction(nameOrSignature: 'cleanTransientStorage'): TypedContractMethod<[], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'defaultRevokerContract'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'delegateAccount'): TypedContractMethod<[delegatee: AddressLike, delegateeContract: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'eip712Domain'): TypedContractMethod<[
    ], [
        [
            string,
            string,
            string,
            bigint,
            string,
            string,
            bigint[]
        ] & {
            fields: string;
            name: string;
            version: string;
            chainId: bigint;
            verifyingContract: string;
            salt: string;
            extensions: bigint[];
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'exists'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'getTaskManagerAddress'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'getVersion'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'globalAllowed'): TypedContractMethod<[handle: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'hashTypedDataV4'): TypedContractMethod<[structHash: BytesLike], [string], 'view'>;
    getFunction(nameOrSignature: 'isAllowed'): TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'isAllowedForDecryption'): TypedContractMethod<[handle: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'isAllowedWithPermission'): TypedContractMethod<[acp: ACPStruct$2, handle: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'persistAllowed'): TypedContractMethod<[handle: BigNumberish, account: AddressLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'receiveCtHash'): TypedContractMethod<[
        handle: BigNumberish,
        expectedSharer: AddressLike,
        receiver: AddressLike
    ], [
        void
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'setDefaultRevokerContract'): TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setShareRegistry'): TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setTaskManager'): TypedContractMethod<[newAddress: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'shareCtHash'): TypedContractMethod<[handle: BigNumberish, sharer: AddressLike, receiver: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'shareRegistry'): TypedContractMethod<[], [string], 'view'>;
    getEvent(key: 'AllowedForDecryption'): TypedContractEvent<AllowedForDecryptionEvent.InputTuple, AllowedForDecryptionEvent.OutputTuple, AllowedForDecryptionEvent.OutputObject>;
    getEvent(key: 'DefaultRevokerContractUpdated'): TypedContractEvent<DefaultRevokerContractUpdatedEvent.InputTuple, DefaultRevokerContractUpdatedEvent.OutputTuple, DefaultRevokerContractUpdatedEvent.OutputObject>;
    getEvent(key: 'EIP712DomainChanged'): TypedContractEvent<EIP712DomainChangedEvent.InputTuple, EIP712DomainChangedEvent.OutputTuple, EIP712DomainChangedEvent.OutputObject>;
    getEvent(key: 'Initialized'): TypedContractEvent<InitializedEvent.InputTuple, InitializedEvent.OutputTuple, InitializedEvent.OutputObject>;
    getEvent(key: 'NewDelegation'): TypedContractEvent<NewDelegationEvent.InputTuple, NewDelegationEvent.OutputTuple, NewDelegationEvent.OutputObject>;
    getEvent(key: 'ShareRegistryUpdated'): TypedContractEvent<ShareRegistryUpdatedEvent.InputTuple, ShareRegistryUpdatedEvent.OutputTuple, ShareRegistryUpdatedEvent.OutputObject>;
    getEvent(key: 'TaskManagerUpdated'): TypedContractEvent<TaskManagerUpdatedEvent.InputTuple, TaskManagerUpdatedEvent.OutputTuple, TaskManagerUpdatedEvent.OutputObject>;
    filters: {
        'AllowedForDecryption(uint256[])': TypedContractEvent<AllowedForDecryptionEvent.InputTuple, AllowedForDecryptionEvent.OutputTuple, AllowedForDecryptionEvent.OutputObject>;
        AllowedForDecryption: TypedContractEvent<AllowedForDecryptionEvent.InputTuple, AllowedForDecryptionEvent.OutputTuple, AllowedForDecryptionEvent.OutputObject>;
        'DefaultRevokerContractUpdated(address,address)': TypedContractEvent<DefaultRevokerContractUpdatedEvent.InputTuple, DefaultRevokerContractUpdatedEvent.OutputTuple, DefaultRevokerContractUpdatedEvent.OutputObject>;
        DefaultRevokerContractUpdated: TypedContractEvent<DefaultRevokerContractUpdatedEvent.InputTuple, DefaultRevokerContractUpdatedEvent.OutputTuple, DefaultRevokerContractUpdatedEvent.OutputObject>;
        'EIP712DomainChanged()': TypedContractEvent<EIP712DomainChangedEvent.InputTuple, EIP712DomainChangedEvent.OutputTuple, EIP712DomainChangedEvent.OutputObject>;
        EIP712DomainChanged: TypedContractEvent<EIP712DomainChangedEvent.InputTuple, EIP712DomainChangedEvent.OutputTuple, EIP712DomainChangedEvent.OutputObject>;
        'Initialized(uint64)': TypedContractEvent<InitializedEvent.InputTuple, InitializedEvent.OutputTuple, InitializedEvent.OutputObject>;
        Initialized: TypedContractEvent<InitializedEvent.InputTuple, InitializedEvent.OutputTuple, InitializedEvent.OutputObject>;
        'NewDelegation(address,address,address)': TypedContractEvent<NewDelegationEvent.InputTuple, NewDelegationEvent.OutputTuple, NewDelegationEvent.OutputObject>;
        NewDelegation: TypedContractEvent<NewDelegationEvent.InputTuple, NewDelegationEvent.OutputTuple, NewDelegationEvent.OutputObject>;
        'ShareRegistryUpdated(address,address)': TypedContractEvent<ShareRegistryUpdatedEvent.InputTuple, ShareRegistryUpdatedEvent.OutputTuple, ShareRegistryUpdatedEvent.OutputObject>;
        ShareRegistryUpdated: TypedContractEvent<ShareRegistryUpdatedEvent.InputTuple, ShareRegistryUpdatedEvent.OutputTuple, ShareRegistryUpdatedEvent.OutputObject>;
        'TaskManagerUpdated(address,address)': TypedContractEvent<TaskManagerUpdatedEvent.InputTuple, TaskManagerUpdatedEvent.OutputTuple, TaskManagerUpdatedEvent.OutputObject>;
        TaskManagerUpdated: TypedContractEvent<TaskManagerUpdatedEvent.InputTuple, TaskManagerUpdatedEvent.OutputTuple, TaskManagerUpdatedEvent.OutputObject>;
    };
}

interface MockCoFHEAddressBookInterface extends Interface {
    getFunction(nameOrSignature: 'exists' | 'getTm' | 'setTm' | 'unsetTm'): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: 'TaskManagerSet'): EventFragment;
    encodeFunctionData(functionFragment: 'exists', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getTm', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'setTm', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'unsetTm', values: [BigNumberish]): string;
    decodeFunctionResult(functionFragment: 'exists', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getTm', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setTm', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'unsetTm', data: BytesLike): Result;
}
declare namespace TaskManagerSetEvent {
    type InputTuple = [id: BigNumberish, previous: AddressLike, current: AddressLike];
    type OutputTuple = [id: bigint, previous: string, current: string];
    interface OutputObject {
        id: bigint;
        previous: string;
        current: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
interface MockCoFHEAddressBook extends BaseContract {
    connect(runner?: ContractRunner | null): MockCoFHEAddressBook;
    waitForDeployment(): Promise<this>;
    interface: MockCoFHEAddressBookInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    exists: TypedContractMethod<[], [boolean], 'view'>;
    getTm: TypedContractMethod<[id: BigNumberish], [string], 'view'>;
    setTm: TypedContractMethod<[id: BigNumberish, tm: AddressLike], [void], 'nonpayable'>;
    unsetTm: TypedContractMethod<[id: BigNumberish], [void], 'nonpayable'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'exists'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'getTm'): TypedContractMethod<[id: BigNumberish], [string], 'view'>;
    getFunction(nameOrSignature: 'setTm'): TypedContractMethod<[id: BigNumberish, tm: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'unsetTm'): TypedContractMethod<[id: BigNumberish], [void], 'nonpayable'>;
    getEvent(key: 'TaskManagerSet'): TypedContractEvent<TaskManagerSetEvent.InputTuple, TaskManagerSetEvent.OutputTuple, TaskManagerSetEvent.OutputObject>;
    filters: {
        'TaskManagerSet(uint256,address,address)': TypedContractEvent<TaskManagerSetEvent.InputTuple, TaskManagerSetEvent.OutputTuple, TaskManagerSetEvent.OutputObject>;
        TaskManagerSet: TypedContractEvent<TaskManagerSetEvent.InputTuple, TaskManagerSetEvent.OutputTuple, TaskManagerSetEvent.OutputObject>;
    };
}

interface MockERC1967ProxyInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: 'Upgraded'): EventFragment;
}
declare namespace UpgradedEvent {
    type InputTuple = [implementation: AddressLike];
    type OutputTuple = [implementation: string];
    interface OutputObject {
        implementation: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
interface MockERC1967Proxy extends BaseContract {
    connect(runner?: ContractRunner | null): MockERC1967Proxy;
    waitForDeployment(): Promise<this>;
    interface: MockERC1967ProxyInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getEvent(key: 'Upgraded'): TypedContractEvent<UpgradedEvent.InputTuple, UpgradedEvent.OutputTuple, UpgradedEvent.OutputObject>;
    filters: {
        'Upgraded(address)': TypedContractEvent<UpgradedEvent.InputTuple, UpgradedEvent.OutputTuple, UpgradedEvent.OutputObject>;
        Upgraded: TypedContractEvent<UpgradedEvent.InputTuple, UpgradedEvent.OutputTuple, UpgradedEvent.OutputObject>;
    };
}

type UnsignedEncryptedInputStruct = {
    ctHash: BigNumberish;
    securityZone: BigNumberish;
    utype: BigNumberish;
};
type ACPStruct$1 = {
    issuer: AddressLike;
    expiration: BigNumberish;
    recipient: AddressLike;
    revokerData: BigNumberish;
    revokerContract: AddressLike;
    scope: BigNumberish;
    contracts: AddressLike[];
    handles: BytesLike[];
    sealingKey: BytesLike;
    issuerSignature: BytesLike;
    recipientSignature: BytesLike;
};
interface MockTaskManagerInterface extends Interface {
    getFunction(nameOrSignature: 'MOCK_dispatchOperation' | 'MOCK_logAllow' | 'MOCK_setInEuintKey' | 'acl' | 'aggregator' | 'allow' | 'allowForDecryption' | 'allowGlobal' | 'allowTransient' | 'batchVerifyInputs' | 'createDecryptTask' | 'createRandomTask' | 'createTask' | 'decryptResultSigner' | 'exists' | 'getDecryptResult' | 'getDecryptResultSafe' | 'handleDecryptResult' | 'handleError' | 'inMockStorage' | 'initialize' | 'isAllowed' | 'isAllowedWithPermission' | 'isInitialized' | 'isPubliclyAllowed' | 'logOps' | 'mockGasExcluded' | 'mockStorage' | 'publishDecryptResult' | 'publishDecryptResultBatch' | 'receiveCtHash' | 'removeFirstLetter' | 'setACLContract' | 'setAggregator' | 'setDecryptResultSigner' | 'setLogOps' | 'setMockGasExcluded' | 'setSecurityZoneMax' | 'setSecurityZoneMin' | 'setSecurityZones' | 'setVerifierSigner' | 'shareCtHash' | 'sliceString' | 'verifyDecryptResult' | 'verifyDecryptResultBatch' | 'verifyDecryptResultBatchSafe' | 'verifyDecryptResultSafe'): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: 'DecryptionResult' | 'MockGasConsumed' | 'ProtocolNotification' | 'TaskCreated'): EventFragment;
    encodeFunctionData(functionFragment: 'MOCK_dispatchOperation', values: [BigNumberish, BigNumberish, BigNumberish[], BigNumberish]): string;
    encodeFunctionData(functionFragment: 'MOCK_logAllow', values: [string, BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'MOCK_setInEuintKey', values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'acl', values?: undefined): string;
    encodeFunctionData(functionFragment: 'aggregator', values?: undefined): string;
    encodeFunctionData(functionFragment: 'allow', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'allowForDecryption', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'allowGlobal', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'allowTransient', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'batchVerifyInputs', values: [UnsignedEncryptedInputStruct[], AddressLike, BytesLike]): string;
    encodeFunctionData(functionFragment: 'createDecryptTask', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'createRandomTask', values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'createTask', values: [BigNumberish, BigNumberish, BigNumberish[], BigNumberish[]]): string;
    encodeFunctionData(functionFragment: 'decryptResultSigner', values?: undefined): string;
    encodeFunctionData(functionFragment: 'exists', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getDecryptResult', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'getDecryptResultSafe', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'handleDecryptResult', values: [BigNumberish, BigNumberish, AddressLike[]]): string;
    encodeFunctionData(functionFragment: 'handleError', values: [BigNumberish, string, string]): string;
    encodeFunctionData(functionFragment: 'inMockStorage', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'initialize', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'isAllowed', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'isAllowedWithPermission', values: [ACPStruct$1, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'isInitialized', values?: undefined): string;
    encodeFunctionData(functionFragment: 'isPubliclyAllowed', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'logOps', values?: undefined): string;
    encodeFunctionData(functionFragment: 'mockGasExcluded', values?: undefined): string;
    encodeFunctionData(functionFragment: 'mockStorage', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'publishDecryptResult', values: [BigNumberish, BigNumberish, BytesLike]): string;
    encodeFunctionData(functionFragment: 'publishDecryptResultBatch', values: [BigNumberish[], BigNumberish[], BytesLike[]]): string;
    encodeFunctionData(functionFragment: 'receiveCtHash', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'removeFirstLetter', values: [string]): string;
    encodeFunctionData(functionFragment: 'setACLContract', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'setAggregator', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'setDecryptResultSigner', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'setLogOps', values: [boolean]): string;
    encodeFunctionData(functionFragment: 'setMockGasExcluded', values: [boolean]): string;
    encodeFunctionData(functionFragment: 'setSecurityZoneMax', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'setSecurityZoneMin', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'setSecurityZones', values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'setVerifierSigner', values: [AddressLike]): string;
    encodeFunctionData(functionFragment: 'shareCtHash', values: [BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'sliceString', values: [string, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'verifyDecryptResult', values: [BigNumberish, BigNumberish, BytesLike]): string;
    encodeFunctionData(functionFragment: 'verifyDecryptResultBatch', values: [BigNumberish[], BigNumberish[], BytesLike[]]): string;
    encodeFunctionData(functionFragment: 'verifyDecryptResultBatchSafe', values: [BigNumberish[], BigNumberish[], BytesLike[]]): string;
    encodeFunctionData(functionFragment: 'verifyDecryptResultSafe', values: [BigNumberish, BigNumberish, BytesLike]): string;
    decodeFunctionResult(functionFragment: 'MOCK_dispatchOperation', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'MOCK_logAllow', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'MOCK_setInEuintKey', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'acl', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'aggregator', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allow', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowForDecryption', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowGlobal', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'allowTransient', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'batchVerifyInputs', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'createDecryptTask', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'createRandomTask', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'createTask', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'decryptResultSigner', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'exists', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getDecryptResult', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getDecryptResultSafe', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'handleDecryptResult', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'handleError', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'inMockStorage', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isAllowed', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isAllowedWithPermission', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isInitialized', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isPubliclyAllowed', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'logOps', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'mockGasExcluded', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'mockStorage', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'publishDecryptResult', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'publishDecryptResultBatch', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'receiveCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'removeFirstLetter', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setACLContract', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setAggregator', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setDecryptResultSigner', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setLogOps', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setMockGasExcluded', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setSecurityZoneMax', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setSecurityZoneMin', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setSecurityZones', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setVerifierSigner', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'shareCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'sliceString', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'verifyDecryptResult', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'verifyDecryptResultBatch', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'verifyDecryptResultBatchSafe', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'verifyDecryptResultSafe', data: BytesLike): Result;
}
declare namespace DecryptionResultEvent {
    type InputTuple = [ctHash: BigNumberish, result: BigNumberish, requestor: AddressLike];
    type OutputTuple = [ctHash: bigint, result: bigint, requestor: string];
    interface OutputObject {
        ctHash: bigint;
        result: bigint;
        requestor: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace MockGasConsumedEvent {
    type InputTuple = [gas: BigNumberish];
    type OutputTuple = [gas: bigint];
    interface OutputObject {
        gas: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace ProtocolNotificationEvent {
    type InputTuple = [ctHash: BigNumberish, operation: string, errorMessage: string];
    type OutputTuple = [ctHash: bigint, operation: string, errorMessage: string];
    interface OutputObject {
        ctHash: bigint;
        operation: string;
        errorMessage: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
declare namespace TaskCreatedEvent {
    type InputTuple = [
        ctHash: BigNumberish,
        operation: string,
        input1: BigNumberish,
        input2: BigNumberish,
        input3: BigNumberish
    ];
    type OutputTuple = [ctHash: bigint, operation: string, input1: bigint, input2: bigint, input3: bigint];
    interface OutputObject {
        ctHash: bigint;
        operation: string;
        input1: bigint;
        input2: bigint;
        input3: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
interface MockTaskManager extends BaseContract {
    connect(runner?: ContractRunner | null): MockTaskManager;
    waitForDeployment(): Promise<this>;
    interface: MockTaskManagerInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    MOCK_dispatchOperation: TypedContractMethod<[
        ctHash: BigNumberish,
        funcId: BigNumberish,
        inputs: BigNumberish[],
        arity: BigNumberish
    ], [
        void
    ], 'nonpayable'>;
    MOCK_logAllow: TypedContractMethod<[operation: string, ctHash: BigNumberish, account: AddressLike], [void], 'view'>;
    MOCK_setInEuintKey: TypedContractMethod<[ctHash: BigNumberish, value: BigNumberish], [void], 'nonpayable'>;
    acl: TypedContractMethod<[], [string], 'view'>;
    aggregator: TypedContractMethod<[], [string], 'view'>;
    allow: TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [void], 'nonpayable'>;
    allowForDecryption: TypedContractMethod<[ctHash: BigNumberish], [void], 'nonpayable'>;
    allowGlobal: TypedContractMethod<[ctHash: BigNumberish], [void], 'nonpayable'>;
    allowTransient: TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [void], 'nonpayable'>;
    batchVerifyInputs: TypedContractMethod<[
        inputs: UnsignedEncryptedInputStruct[],
        sender: AddressLike,
        signature: BytesLike
    ], [
        bigint[]
    ], 'nonpayable'>;
    createDecryptTask: TypedContractMethod<[ctHash: BigNumberish, arg1: AddressLike], [void], 'nonpayable'>;
    createRandomTask: TypedContractMethod<[
        returnType: BigNumberish,
        seed: BigNumberish,
        securityZone: BigNumberish
    ], [
        bigint
    ], 'nonpayable'>;
    createTask: TypedContractMethod<[
        returnType: BigNumberish,
        funcId: BigNumberish,
        encryptedHashes: BigNumberish[],
        extraInputs: BigNumberish[]
    ], [
        bigint
    ], 'nonpayable'>;
    decryptResultSigner: TypedContractMethod<[], [string], 'view'>;
    exists: TypedContractMethod<[], [boolean], 'view'>;
    getDecryptResult: TypedContractMethod<[ctHash: BigNumberish], [bigint], 'view'>;
    getDecryptResultSafe: TypedContractMethod<[
        ctHash: BigNumberish
    ], [
        [bigint, boolean] & {
            result: bigint;
            decrypted: boolean;
        }
    ], 'view'>;
    handleDecryptResult: TypedContractMethod<[
        ctHash: BigNumberish,
        result: BigNumberish,
        arg2: AddressLike[]
    ], [
        void
    ], 'nonpayable'>;
    handleError: TypedContractMethod<[
        ctHash: BigNumberish,
        operation: string,
        errorMessage: string
    ], [
        void
    ], 'nonpayable'>;
    inMockStorage: TypedContractMethod<[arg0: BigNumberish], [boolean], 'view'>;
    initialize: TypedContractMethod<[initialOwner: AddressLike], [void], 'nonpayable'>;
    isAllowed: TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [boolean], 'view'>;
    isAllowedWithPermission: TypedContractMethod<[acp: ACPStruct$1, handle: BigNumberish], [boolean], 'view'>;
    isInitialized: TypedContractMethod<[], [boolean], 'view'>;
    isPubliclyAllowed: TypedContractMethod<[ctHash: BigNumberish], [boolean], 'view'>;
    logOps: TypedContractMethod<[], [boolean], 'view'>;
    mockGasExcluded: TypedContractMethod<[], [boolean], 'view'>;
    mockStorage: TypedContractMethod<[arg0: BigNumberish], [bigint], 'view'>;
    publishDecryptResult: TypedContractMethod<[
        ctHash: BigNumberish,
        result: BigNumberish,
        signature: BytesLike
    ], [
        void
    ], 'nonpayable'>;
    publishDecryptResultBatch: TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        void
    ], 'nonpayable'>;
    receiveCtHash: TypedContractMethod<[ctHash: BigNumberish, expectedSharer: AddressLike], [void], 'nonpayable'>;
    removeFirstLetter: TypedContractMethod<[str: string], [string], 'view'>;
    setACLContract: TypedContractMethod<[_aclAddress: AddressLike], [void], 'nonpayable'>;
    setAggregator: TypedContractMethod<[_aggregatorAddress: AddressLike], [void], 'nonpayable'>;
    setDecryptResultSigner: TypedContractMethod<[signer: AddressLike], [void], 'nonpayable'>;
    setLogOps: TypedContractMethod<[_logOps: boolean], [void], 'nonpayable'>;
    setMockGasExcluded: TypedContractMethod<[_mockGasExcluded: boolean], [void], 'nonpayable'>;
    setSecurityZoneMax: TypedContractMethod<[securityZone: BigNumberish], [void], 'nonpayable'>;
    setSecurityZoneMin: TypedContractMethod<[securityZone: BigNumberish], [void], 'nonpayable'>;
    setSecurityZones: TypedContractMethod<[minSZ: BigNumberish, maxSZ: BigNumberish], [void], 'nonpayable'>;
    setVerifierSigner: TypedContractMethod<[signer: AddressLike], [void], 'nonpayable'>;
    shareCtHash: TypedContractMethod<[ctHash: BigNumberish, receiver: AddressLike], [void], 'nonpayable'>;
    sliceString: TypedContractMethod<[str: string, start: BigNumberish, length: BigNumberish], [string], 'view'>;
    verifyDecryptResult: TypedContractMethod<[
        ctHash: BigNumberish,
        result: BigNumberish,
        signature: BytesLike
    ], [
        boolean
    ], 'view'>;
    verifyDecryptResultBatch: TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        boolean
    ], 'view'>;
    verifyDecryptResultBatchSafe: TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        boolean[]
    ], 'view'>;
    verifyDecryptResultSafe: TypedContractMethod<[
        ctHash: BigNumberish,
        result: BigNumberish,
        signature: BytesLike
    ], [
        boolean
    ], 'view'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'MOCK_dispatchOperation'): TypedContractMethod<[
        ctHash: BigNumberish,
        funcId: BigNumberish,
        inputs: BigNumberish[],
        arity: BigNumberish
    ], [
        void
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'MOCK_logAllow'): TypedContractMethod<[operation: string, ctHash: BigNumberish, account: AddressLike], [void], 'view'>;
    getFunction(nameOrSignature: 'MOCK_setInEuintKey'): TypedContractMethod<[ctHash: BigNumberish, value: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'acl'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'aggregator'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'allow'): TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowForDecryption'): TypedContractMethod<[ctHash: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowGlobal'): TypedContractMethod<[ctHash: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'allowTransient'): TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'batchVerifyInputs'): TypedContractMethod<[
        inputs: UnsignedEncryptedInputStruct[],
        sender: AddressLike,
        signature: BytesLike
    ], [
        bigint[]
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'createDecryptTask'): TypedContractMethod<[ctHash: BigNumberish, arg1: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'createRandomTask'): TypedContractMethod<[
        returnType: BigNumberish,
        seed: BigNumberish,
        securityZone: BigNumberish
    ], [
        bigint
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'createTask'): TypedContractMethod<[
        returnType: BigNumberish,
        funcId: BigNumberish,
        encryptedHashes: BigNumberish[],
        extraInputs: BigNumberish[]
    ], [
        bigint
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'decryptResultSigner'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'exists'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'getDecryptResult'): TypedContractMethod<[ctHash: BigNumberish], [bigint], 'view'>;
    getFunction(nameOrSignature: 'getDecryptResultSafe'): TypedContractMethod<[ctHash: BigNumberish], [[bigint, boolean] & {
        result: bigint;
        decrypted: boolean;
    }], 'view'>;
    getFunction(nameOrSignature: 'handleDecryptResult'): TypedContractMethod<[ctHash: BigNumberish, result: BigNumberish, arg2: AddressLike[]], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'handleError'): TypedContractMethod<[ctHash: BigNumberish, operation: string, errorMessage: string], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'inMockStorage'): TypedContractMethod<[arg0: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'initialize'): TypedContractMethod<[initialOwner: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'isAllowed'): TypedContractMethod<[ctHash: BigNumberish, account: AddressLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'isAllowedWithPermission'): TypedContractMethod<[acp: ACPStruct$1, handle: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'isInitialized'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'isPubliclyAllowed'): TypedContractMethod<[ctHash: BigNumberish], [boolean], 'view'>;
    getFunction(nameOrSignature: 'logOps'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'mockGasExcluded'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'mockStorage'): TypedContractMethod<[arg0: BigNumberish], [bigint], 'view'>;
    getFunction(nameOrSignature: 'publishDecryptResult'): TypedContractMethod<[ctHash: BigNumberish, result: BigNumberish, signature: BytesLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'publishDecryptResultBatch'): TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        void
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'receiveCtHash'): TypedContractMethod<[ctHash: BigNumberish, expectedSharer: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'removeFirstLetter'): TypedContractMethod<[str: string], [string], 'view'>;
    getFunction(nameOrSignature: 'setACLContract'): TypedContractMethod<[_aclAddress: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setAggregator'): TypedContractMethod<[_aggregatorAddress: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setDecryptResultSigner'): TypedContractMethod<[signer: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setLogOps'): TypedContractMethod<[_logOps: boolean], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setMockGasExcluded'): TypedContractMethod<[_mockGasExcluded: boolean], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setSecurityZoneMax'): TypedContractMethod<[securityZone: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setSecurityZoneMin'): TypedContractMethod<[securityZone: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setSecurityZones'): TypedContractMethod<[minSZ: BigNumberish, maxSZ: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'setVerifierSigner'): TypedContractMethod<[signer: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'shareCtHash'): TypedContractMethod<[ctHash: BigNumberish, receiver: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'sliceString'): TypedContractMethod<[str: string, start: BigNumberish, length: BigNumberish], [string], 'view'>;
    getFunction(nameOrSignature: 'verifyDecryptResult'): TypedContractMethod<[ctHash: BigNumberish, result: BigNumberish, signature: BytesLike], [boolean], 'view'>;
    getFunction(nameOrSignature: 'verifyDecryptResultBatch'): TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        boolean
    ], 'view'>;
    getFunction(nameOrSignature: 'verifyDecryptResultBatchSafe'): TypedContractMethod<[
        ctHashes: BigNumberish[],
        results: BigNumberish[],
        signatures: BytesLike[]
    ], [
        boolean[]
    ], 'view'>;
    getFunction(nameOrSignature: 'verifyDecryptResultSafe'): TypedContractMethod<[ctHash: BigNumberish, result: BigNumberish, signature: BytesLike], [boolean], 'view'>;
    getEvent(key: 'DecryptionResult'): TypedContractEvent<DecryptionResultEvent.InputTuple, DecryptionResultEvent.OutputTuple, DecryptionResultEvent.OutputObject>;
    getEvent(key: 'MockGasConsumed'): TypedContractEvent<MockGasConsumedEvent.InputTuple, MockGasConsumedEvent.OutputTuple, MockGasConsumedEvent.OutputObject>;
    getEvent(key: 'ProtocolNotification'): TypedContractEvent<ProtocolNotificationEvent.InputTuple, ProtocolNotificationEvent.OutputTuple, ProtocolNotificationEvent.OutputObject>;
    getEvent(key: 'TaskCreated'): TypedContractEvent<TaskCreatedEvent.InputTuple, TaskCreatedEvent.OutputTuple, TaskCreatedEvent.OutputObject>;
    filters: {
        'DecryptionResult(uint256,uint256,address)': TypedContractEvent<DecryptionResultEvent.InputTuple, DecryptionResultEvent.OutputTuple, DecryptionResultEvent.OutputObject>;
        DecryptionResult: TypedContractEvent<DecryptionResultEvent.InputTuple, DecryptionResultEvent.OutputTuple, DecryptionResultEvent.OutputObject>;
        'MockGasConsumed(uint256)': TypedContractEvent<MockGasConsumedEvent.InputTuple, MockGasConsumedEvent.OutputTuple, MockGasConsumedEvent.OutputObject>;
        MockGasConsumed: TypedContractEvent<MockGasConsumedEvent.InputTuple, MockGasConsumedEvent.OutputTuple, MockGasConsumedEvent.OutputObject>;
        'ProtocolNotification(uint256,string,string)': TypedContractEvent<ProtocolNotificationEvent.InputTuple, ProtocolNotificationEvent.OutputTuple, ProtocolNotificationEvent.OutputObject>;
        ProtocolNotification: TypedContractEvent<ProtocolNotificationEvent.InputTuple, ProtocolNotificationEvent.OutputTuple, ProtocolNotificationEvent.OutputObject>;
        'TaskCreated(uint256,string,uint256,uint256,uint256)': TypedContractEvent<TaskCreatedEvent.InputTuple, TaskCreatedEvent.OutputTuple, TaskCreatedEvent.OutputObject>;
        TaskCreated: TypedContractEvent<TaskCreatedEvent.InputTuple, TaskCreatedEvent.OutputTuple, TaskCreatedEvent.OutputObject>;
    };
}

type ACPStruct = {
    issuer: AddressLike;
    expiration: BigNumberish;
    recipient: AddressLike;
    revokerData: BigNumberish;
    revokerContract: AddressLike;
    scope: BigNumberish;
    contracts: AddressLike[];
    handles: BytesLike[];
    sealingKey: BytesLike;
    issuerSignature: BytesLike;
    recipientSignature: BytesLike;
};
interface MockThresholdNetworkInterface extends Interface {
    getFunction(nameOrSignature: 'decodeLowLevelReversion' | 'decryptForTxWithACP' | 'decryptForTxWithoutACP' | 'exists' | 'initialize' | 'mockAcl' | 'mockQueryDecrypt' | 'mockTaskManager' | 'queryDecrypt' | 'querySealOutput' | 'seal' | 'unseal'): FunctionFragment;
    encodeFunctionData(functionFragment: 'decodeLowLevelReversion', values: [BytesLike]): string;
    encodeFunctionData(functionFragment: 'decryptForTxWithACP', values: [BigNumberish, ACPStruct]): string;
    encodeFunctionData(functionFragment: 'decryptForTxWithoutACP', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'exists', values?: undefined): string;
    encodeFunctionData(functionFragment: 'initialize', values: [AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: 'mockAcl', values?: undefined): string;
    encodeFunctionData(functionFragment: 'mockQueryDecrypt', values: [BigNumberish, BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: 'mockTaskManager', values?: undefined): string;
    encodeFunctionData(functionFragment: 'queryDecrypt', values: [BigNumberish, BigNumberish, ACPStruct]): string;
    encodeFunctionData(functionFragment: 'querySealOutput', values: [BigNumberish, BigNumberish, ACPStruct]): string;
    encodeFunctionData(functionFragment: 'seal', values: [BigNumberish, BytesLike]): string;
    encodeFunctionData(functionFragment: 'unseal', values: [BytesLike, BytesLike]): string;
    decodeFunctionResult(functionFragment: 'decodeLowLevelReversion', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'decryptForTxWithACP', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'decryptForTxWithoutACP', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'exists', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'mockAcl', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'mockQueryDecrypt', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'mockTaskManager', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'queryDecrypt', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'querySealOutput', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'seal', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'unseal', data: BytesLike): Result;
}
interface MockThresholdNetwork extends BaseContract {
    connect(runner?: ContractRunner | null): MockThresholdNetwork;
    waitForDeployment(): Promise<this>;
    interface: MockThresholdNetworkInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    decodeLowLevelReversion: TypedContractMethod<[data: BytesLike], [string], 'view'>;
    decryptForTxWithACP: TypedContractMethod<[
        ctHash: BigNumberish,
        acp: ACPStruct
    ], [
        [
            boolean,
            string,
            bigint
        ] & {
            allowed: boolean;
            error: string;
            decryptedValue: bigint;
        }
    ], 'view'>;
    decryptForTxWithoutACP: TypedContractMethod<[
        ctHash: BigNumberish
    ], [
        [
            boolean,
            string,
            bigint
        ] & {
            allowed: boolean;
            error: string;
            decryptedValue: bigint;
        }
    ], 'view'>;
    exists: TypedContractMethod<[], [boolean], 'view'>;
    initialize: TypedContractMethod<[_taskManager: AddressLike, _acl: AddressLike], [void], 'nonpayable'>;
    mockAcl: TypedContractMethod<[], [string], 'view'>;
    mockQueryDecrypt: TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        issuer: AddressLike
    ], [
        [boolean, string, bigint] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    mockTaskManager: TypedContractMethod<[], [string], 'view'>;
    queryDecrypt: TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        acp: ACPStruct
    ], [
        [boolean, string, bigint] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    querySealOutput: TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        acp: ACPStruct
    ], [
        [boolean, string, string] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    seal: TypedContractMethod<[input: BigNumberish, key: BytesLike], [string], 'view'>;
    unseal: TypedContractMethod<[hashed: BytesLike, key: BytesLike], [bigint], 'view'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'decodeLowLevelReversion'): TypedContractMethod<[data: BytesLike], [string], 'view'>;
    getFunction(nameOrSignature: 'decryptForTxWithACP'): TypedContractMethod<[
        ctHash: BigNumberish,
        acp: ACPStruct
    ], [
        [
            boolean,
            string,
            bigint
        ] & {
            allowed: boolean;
            error: string;
            decryptedValue: bigint;
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'decryptForTxWithoutACP'): TypedContractMethod<[
        ctHash: BigNumberish
    ], [
        [
            boolean,
            string,
            bigint
        ] & {
            allowed: boolean;
            error: string;
            decryptedValue: bigint;
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'exists'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'initialize'): TypedContractMethod<[_taskManager: AddressLike, _acl: AddressLike], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'mockAcl'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'mockQueryDecrypt'): TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        issuer: AddressLike
    ], [
        [boolean, string, bigint] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'mockTaskManager'): TypedContractMethod<[], [string], 'view'>;
    getFunction(nameOrSignature: 'queryDecrypt'): TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        acp: ACPStruct
    ], [
        [boolean, string, bigint] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'querySealOutput'): TypedContractMethod<[
        ctHash: BigNumberish,
        arg1: BigNumberish,
        acp: ACPStruct
    ], [
        [boolean, string, string] & {
            allowed: boolean;
            error: string;
        }
    ], 'view'>;
    getFunction(nameOrSignature: 'seal'): TypedContractMethod<[input: BigNumberish, key: BytesLike], [string], 'view'>;
    getFunction(nameOrSignature: 'unseal'): TypedContractMethod<[hashed: BytesLike, key: BytesLike], [bigint], 'view'>;
    filters: {};
}

type EncryptedInputStructOutput = [ctHash: bigint, securityZone: bigint, utype: bigint, signature: string] & {
    ctHash: bigint;
    securityZone: bigint;
    utype: bigint;
    signature: string;
};
interface MockZkVerifierInterface extends Interface {
    getFunction(nameOrSignature: 'exists' | 'insertCtHash' | 'insertPackedCtHashes' | 'zkVerify' | 'zkVerifyCalcCtHash' | 'zkVerifyCalcCtHashesPacked' | 'zkVerifyPacked'): FunctionFragment;
    encodeFunctionData(functionFragment: 'exists', values?: undefined): string;
    encodeFunctionData(functionFragment: 'insertCtHash', values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'insertPackedCtHashes', values: [BigNumberish[], BigNumberish[]]): string;
    encodeFunctionData(functionFragment: 'zkVerify', values: [BigNumberish, BigNumberish, AddressLike, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'zkVerifyCalcCtHash', values: [BigNumberish, BigNumberish, AddressLike, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'zkVerifyCalcCtHashesPacked', values: [BigNumberish[], BigNumberish[], AddressLike, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'zkVerifyPacked', values: [BigNumberish[], BigNumberish[], AddressLike, BigNumberish, BigNumberish]): string;
    decodeFunctionResult(functionFragment: 'exists', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'insertCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'insertPackedCtHashes', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'zkVerify', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'zkVerifyCalcCtHash', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'zkVerifyCalcCtHashesPacked', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'zkVerifyPacked', data: BytesLike): Result;
}
interface MockZkVerifier extends BaseContract {
    connect(runner?: ContractRunner | null): MockZkVerifier;
    waitForDeployment(): Promise<this>;
    interface: MockZkVerifierInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    exists: TypedContractMethod<[], [boolean], 'view'>;
    insertCtHash: TypedContractMethod<[ctHash: BigNumberish, value: BigNumberish], [void], 'nonpayable'>;
    insertPackedCtHashes: TypedContractMethod<[ctHashes: BigNumberish[], values: BigNumberish[]], [void], 'nonpayable'>;
    zkVerify: TypedContractMethod<[
        value: BigNumberish,
        utype: BigNumberish,
        user: AddressLike,
        securityZone: BigNumberish,
        arg4: BigNumberish
    ], [
        EncryptedInputStructOutput
    ], 'nonpayable'>;
    zkVerifyCalcCtHash: TypedContractMethod<[
        value: BigNumberish,
        utype: BigNumberish,
        user: AddressLike,
        securityZone: BigNumberish,
        arg4: BigNumberish
    ], [
        bigint
    ], 'view'>;
    zkVerifyCalcCtHashesPacked: TypedContractMethod<[
        values: BigNumberish[],
        utypes: BigNumberish[],
        user: AddressLike,
        securityZone: BigNumberish,
        chainId: BigNumberish
    ], [
        bigint[]
    ], 'view'>;
    zkVerifyPacked: TypedContractMethod<[
        values: BigNumberish[],
        utypes: BigNumberish[],
        user: AddressLike,
        securityZone: BigNumberish,
        chainId: BigNumberish
    ], [
        EncryptedInputStructOutput[]
    ], 'nonpayable'>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: 'exists'): TypedContractMethod<[], [boolean], 'view'>;
    getFunction(nameOrSignature: 'insertCtHash'): TypedContractMethod<[ctHash: BigNumberish, value: BigNumberish], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'insertPackedCtHashes'): TypedContractMethod<[ctHashes: BigNumberish[], values: BigNumberish[]], [void], 'nonpayable'>;
    getFunction(nameOrSignature: 'zkVerify'): TypedContractMethod<[
        value: BigNumberish,
        utype: BigNumberish,
        user: AddressLike,
        securityZone: BigNumberish,
        arg4: BigNumberish
    ], [
        EncryptedInputStructOutput
    ], 'nonpayable'>;
    getFunction(nameOrSignature: 'zkVerifyCalcCtHash'): TypedContractMethod<[
        value: BigNumberish,
        utype: BigNumberish,
        user: AddressLike,
        securityZone: BigNumberish,
        arg4: BigNumberish
    ], [
        bigint
    ], 'view'>;
    getFunction(nameOrSignature: 'zkVerifyCalcCtHashesPacked'): TypedContractMethod<[
        values: BigNumberish[],
        utypes: BigNumberish[],
        user: AddressLike,
        securityZone: BigNumberish,
        chainId: BigNumberish
    ], [
        bigint[]
    ], 'view'>;
    getFunction(nameOrSignature: 'zkVerifyPacked'): TypedContractMethod<[
        values: BigNumberish[],
        utypes: BigNumberish[],
        user: AddressLike,
        securityZone: BigNumberish,
        chainId: BigNumberish
    ], [
        EncryptedInputStructOutput[]
    ], 'nonpayable'>;
    filters: {};
}

export { ACPShareRegistry, ACPShareRegistryArtifact, type ACPTimestampRevoker, ACPTimestampRevokerArtifact, type MockACL, MockACLArtifact, type MockArtifact, type MockCoFHEAddressBook, MockCoFHEAddressBookArtifact, type MockERC1967Proxy, MockERC1967ProxyArtifact, type MockTaskManager, MockTaskManagerArtifact, type MockThresholdNetwork, MockThresholdNetworkArtifact, type MockZkVerifier, MockZkVerifierArtifact };
