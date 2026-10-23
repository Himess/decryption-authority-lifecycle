'use strict';

// src/MockCoFHEAddressBook.ts
var MockCoFHEAddressBookArtifact = {
  contractName: "MockCoFHEAddressBook",
  isFixed: true,
  fixedAddress: "0xC0F4e00E531a2B086492Ae3DCC1515038307196b",
  abi: [
    {
      type: "function",
      name: "exists",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "getTm",
      inputs: [
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "tm",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "setTm",
      inputs: [
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "tm",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "unsetTm",
      inputs: [
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "event",
      name: "TaskManagerSet",
      inputs: [
        {
          name: "id",
          type: "uint256",
          indexed: true,
          internalType: "uint256"
        },
        {
          name: "previous",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "current",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "error",
      name: "InvalidAddress",
      inputs: []
    },
    {
      type: "error",
      name: "TaskManagerNotSet",
      inputs: [
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    }
  ]
};

// src/MockTaskManager.ts
var MockTaskManagerArtifact = {
  contractName: "MockTaskManager",
  isFixed: true,
  fixedAddress: "0x0000000000000000000000000000000000005000",
  abi: [
    {
      type: "constructor",
      inputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "MOCK_dispatchOperation",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "funcId",
          type: "uint8",
          internalType: "enum FunctionId"
        },
        {
          name: "inputs",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "arity",
          type: "uint8",
          internalType: "uint8"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "MOCK_logAllow",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        },
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "MOCK_setInEuintKey",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "value",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "acl",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "contract MockACL"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "aggregator",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "allow",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowForDecryption",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowGlobal",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowTransient",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "batchVerifyInputs",
      inputs: [
        {
          name: "inputs",
          type: "tuple[]",
          internalType: "struct UnsignedEncryptedInput[]",
          components: [
            {
              name: "ctHash",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "securityZone",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "utype",
              type: "uint8",
              internalType: "uint8"
            }
          ]
        },
        {
          name: "sender",
          type: "address",
          internalType: "address"
        },
        {
          name: "signature",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256[]",
          internalType: "uint256[]"
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "createDecryptTask",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "createRandomTask",
      inputs: [
        {
          name: "returnType",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "seed",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "securityZone",
          type: "int32",
          internalType: "int32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "createTask",
      inputs: [
        {
          name: "returnType",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "funcId",
          type: "uint8",
          internalType: "enum FunctionId"
        },
        {
          name: "encryptedHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "extraInputs",
          type: "uint256[]",
          internalType: "uint256[]"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "decryptResultSigner",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "exists",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "getDecryptResult",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getDecryptResultSafe",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "result",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "decrypted",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "handleDecryptResult",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "result",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "",
          type: "address[]",
          internalType: "address[]"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "handleError",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "operation",
          type: "string",
          internalType: "string"
        },
        {
          name: "errorMessage",
          type: "string",
          internalType: "string"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "inMockStorage",
      inputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "initialize",
      inputs: [
        {
          name: "initialOwner",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "isAllowed",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isAllowedWithPermission",
      inputs: [
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        },
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isInitialized",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isPubliclyAllowed",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "logOps",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "mockGasExcluded",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "mockStorage",
      inputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "publishDecryptResult",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "result",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "signature",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "publishDecryptResultBatch",
      inputs: [
        {
          name: "ctHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "results",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "signatures",
          type: "bytes[]",
          internalType: "bytes[]"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "receiveCtHash",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "expectedSharer",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "removeFirstLetter",
      inputs: [
        {
          name: "str",
          type: "string",
          internalType: "string"
        }
      ],
      outputs: [
        {
          name: "",
          type: "string",
          internalType: "string"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "setACLContract",
      inputs: [
        {
          name: "_aclAddress",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setAggregator",
      inputs: [
        {
          name: "_aggregatorAddress",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setDecryptResultSigner",
      inputs: [
        {
          name: "signer",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setLogOps",
      inputs: [
        {
          name: "_logOps",
          type: "bool",
          internalType: "bool"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setMockGasExcluded",
      inputs: [
        {
          name: "_mockGasExcluded",
          type: "bool",
          internalType: "bool"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setSecurityZoneMax",
      inputs: [
        {
          name: "securityZone",
          type: "int32",
          internalType: "int32"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setSecurityZoneMin",
      inputs: [
        {
          name: "securityZone",
          type: "int32",
          internalType: "int32"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setSecurityZones",
      inputs: [
        {
          name: "minSZ",
          type: "int32",
          internalType: "int32"
        },
        {
          name: "maxSZ",
          type: "int32",
          internalType: "int32"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setVerifierSigner",
      inputs: [
        {
          name: "signer",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "shareCtHash",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "receiver",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "sliceString",
      inputs: [
        {
          name: "str",
          type: "string",
          internalType: "string"
        },
        {
          name: "start",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "length",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "string",
          internalType: "string"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "verifyDecryptResult",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "result",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "signature",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "verifyDecryptResultBatch",
      inputs: [
        {
          name: "ctHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "results",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "signatures",
          type: "bytes[]",
          internalType: "bytes[]"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "verifyDecryptResultBatchSafe",
      inputs: [
        {
          name: "ctHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "results",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "signatures",
          type: "bytes[]",
          internalType: "bytes[]"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool[]",
          internalType: "bool[]"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "verifyDecryptResultSafe",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "result",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "signature",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "DecryptionResult",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "result",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "requestor",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "MockGasConsumed",
      inputs: [
        {
          name: "gas",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "ProtocolNotification",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "operation",
          type: "string",
          indexed: false,
          internalType: "string"
        },
        {
          name: "errorMessage",
          type: "string",
          indexed: false,
          internalType: "string"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "TaskCreated",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "operation",
          type: "string",
          indexed: false,
          internalType: "string"
        },
        {
          name: "input1",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "input2",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        },
        {
          name: "input3",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        }
      ],
      anonymous: false
    },
    {
      type: "error",
      name: "ACLNotAllowed",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "DecryptionResultNotReady",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    },
    {
      type: "error",
      name: "ECDSAInvalidSignature",
      inputs: []
    },
    {
      type: "error",
      name: "ECDSAInvalidSignatureLength",
      inputs: [
        {
          name: "length",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    },
    {
      type: "error",
      name: "ECDSAInvalidSignatureS",
      inputs: [
        {
          name: "s",
          type: "bytes32",
          internalType: "bytes32"
        }
      ]
    },
    {
      type: "error",
      name: "InputNotInMockStorage",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidAddress",
      inputs: []
    },
    {
      type: "error",
      name: "InvalidInputForFunction",
      inputs: [
        {
          name: "functionName",
          type: "string",
          internalType: "string"
        },
        {
          name: "inputType",
          type: "uint8",
          internalType: "uint8"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidInputType",
      inputs: [
        {
          name: "actual",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "expected",
          type: "uint8",
          internalType: "uint8"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidInputsAmount",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        },
        {
          name: "got",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "expected",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidOperationInputs",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidSecurityZone",
      inputs: [
        {
          name: "zone",
          type: "int32",
          internalType: "int32"
        },
        {
          name: "min",
          type: "int32",
          internalType: "int32"
        },
        {
          name: "max",
          type: "int32",
          internalType: "int32"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidSignature",
      inputs: []
    },
    {
      type: "error",
      name: "InvalidSigner",
      inputs: [
        {
          name: "signer",
          type: "address",
          internalType: "address"
        },
        {
          name: "expectedSigner",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidThreeInputOperation",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidTwoInputOperation",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidTypeOrSecurityZone",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidUnaryOperation",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        }
      ]
    },
    {
      type: "error",
      name: "LengthMismatch",
      inputs: []
    },
    {
      type: "error",
      name: "OnlyAggregatorAllowed",
      inputs: [
        {
          name: "caller",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "OnlyOwnerAllowed",
      inputs: [
        {
          name: "caller",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "OnlySelf",
      inputs: []
    },
    {
      type: "error",
      name: "RandomFunctionNotSupported",
      inputs: []
    },
    {
      type: "error",
      name: "StringsInsufficientHexLength",
      inputs: [
        {
          name: "value",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "length",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    },
    {
      type: "error",
      name: "TooManyInputs",
      inputs: [
        {
          name: "operation",
          type: "string",
          internalType: "string"
        },
        {
          name: "got",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "maxAllowed",
          type: "uint256",
          internalType: "uint256"
        }
      ]
    }
  ]
};

// src/MockACL.ts
var MockACLArtifact = {
  contractName: "MockACL",
  isFixed: false,
  abi: [
    {
      type: "constructor",
      inputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allow",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        },
        {
          name: "requester",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowForDecryption",
      inputs: [
        {
          name: "handlesList",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "requester",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowGlobal",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "requester",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowTransient",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        },
        {
          name: "requester",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowedOnBehalf",
      inputs: [
        {
          name: "delegatee",
          type: "address",
          internalType: "address"
        },
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "contractAddress",
          type: "address",
          internalType: "address"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "allowedTransient",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "checkPermissionValidity",
      inputs: [
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "cleanTransientStorage",
      inputs: [],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "defaultRevokerContract",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "delegateAccount",
      inputs: [
        {
          name: "delegatee",
          type: "address",
          internalType: "address"
        },
        {
          name: "delegateeContract",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "eip712Domain",
      inputs: [],
      outputs: [
        {
          name: "fields",
          type: "bytes1",
          internalType: "bytes1"
        },
        {
          name: "name",
          type: "string",
          internalType: "string"
        },
        {
          name: "version",
          type: "string",
          internalType: "string"
        },
        {
          name: "chainId",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "verifyingContract",
          type: "address",
          internalType: "address"
        },
        {
          name: "salt",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "extensions",
          type: "uint256[]",
          internalType: "uint256[]"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "exists",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "getTaskManagerAddress",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getVersion",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "string",
          internalType: "string"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "globalAllowed",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "hashTypedDataV4",
      inputs: [
        {
          name: "structHash",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isAllowed",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isAllowedForDecryption",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "isAllowedWithPermission",
      inputs: [
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        },
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "persistAllowed",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "receiveCtHash",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "expectedSharer",
          type: "address",
          internalType: "address"
        },
        {
          name: "receiver",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setDefaultRevokerContract",
      inputs: [
        {
          name: "newAddress",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setShareRegistry",
      inputs: [
        {
          name: "newAddress",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setTaskManager",
      inputs: [
        {
          name: "newAddress",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "shareCtHash",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "sharer",
          type: "address",
          internalType: "address"
        },
        {
          name: "receiver",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "shareRegistry",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "AllowedForDecryption",
      inputs: [
        {
          name: "handlesList",
          type: "uint256[]",
          indexed: false,
          internalType: "uint256[]"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "DefaultRevokerContractUpdated",
      inputs: [
        {
          name: "oldAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        },
        {
          name: "newAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "EIP712DomainChanged",
      inputs: [],
      anonymous: false
    },
    {
      type: "event",
      name: "Initialized",
      inputs: [
        {
          name: "version",
          type: "uint64",
          indexed: false,
          internalType: "uint64"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "NewDelegation",
      inputs: [
        {
          name: "sender",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "delegatee",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "contractAddress",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "ShareRegistryUpdated",
      inputs: [
        {
          name: "oldAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        },
        {
          name: "newAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "TaskManagerUpdated",
      inputs: [
        {
          name: "oldAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        },
        {
          name: "newAddress",
          type: "address",
          indexed: false,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "error",
      name: "AlreadyDelegated",
      inputs: []
    },
    {
      type: "error",
      name: "DirectAllowForbidden",
      inputs: [
        {
          name: "sender",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "InvalidInitialization",
      inputs: []
    },
    {
      type: "error",
      name: "InvalidTaskManagerAddress",
      inputs: []
    },
    {
      type: "error",
      name: "NotInitializing",
      inputs: []
    },
    {
      type: "error",
      name: "NotShared",
      inputs: [
        {
          name: "handle",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "receiver",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "PermissionInvalid_Disabled",
      inputs: []
    },
    {
      type: "error",
      name: "PermissionInvalid_Expired",
      inputs: []
    },
    {
      type: "error",
      name: "PermissionInvalid_IssuerSignature",
      inputs: []
    },
    {
      type: "error",
      name: "PermissionInvalid_RecipientSignature",
      inputs: []
    },
    {
      type: "error",
      name: "SenderCannotBeDelegateeAddress",
      inputs: []
    },
    {
      type: "error",
      name: "SenderNotAllowed",
      inputs: [
        {
          name: "sender",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "UnexpectedSharer",
      inputs: [
        {
          name: "expected",
          type: "address",
          internalType: "address"
        },
        {
          name: "actual",
          type: "address",
          internalType: "address"
        }
      ]
    }
  ]
};

// src/ACPTimestampRevoker.ts
var ACPTimestampRevokerArtifact = {
  contractName: "ACPTimestampRevoker",
  isFixed: false,
  abi: [
    {
      type: "function",
      name: "disabled",
      inputs: [
        {
          name: "issuer",
          type: "address",
          internalType: "address"
        },
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "revokeAllAt",
      inputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "revokeAllExisting",
      inputs: [],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "revokeSingle",
      inputs: [
        {
          name: "id",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "revokedSingle",
      inputs: [
        {
          name: "",
          type: "address",
          internalType: "address"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "RevokedAll",
      inputs: [
        {
          name: "issuer",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "at",
          type: "uint256",
          indexed: false,
          internalType: "uint256"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "RevokedSingle",
      inputs: [
        {
          name: "issuer",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "id",
          type: "uint256",
          indexed: true,
          internalType: "uint256"
        }
      ],
      anonymous: false
    }
  ]
};

// src/ACPShareRegistry.ts
var ACPShareRegistryArtifact = {
  contractName: "ACPShareRegistry",
  isFixed: false,
  abi: [
    {
      type: "constructor",
      inputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "DEFAULT_ADMIN_ROLE",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "UPGRADER_ROLE",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "UPGRADE_INTERFACE_VERSION",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "string",
          internalType: "string"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getRoleAdmin",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getShare",
      inputs: [
        {
          name: "shareId",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "tuple",
          internalType: "struct ACPShareRegistry.ShareHeader",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "blockNumber",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            }
          ]
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "grantRole",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "hasRole",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "initialize",
      inputs: [
        {
          name: "initialAdmin",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "isShareValid",
      inputs: [
        {
          name: "shareId",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "proxiableUUID",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "removeShare",
      inputs: [
        {
          name: "shareId",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "renounceRole",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "callerConfirmation",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "revokeRole",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "account",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "share",
      inputs: [
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        },
        {
          name: "metadata",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [
        {
          name: "shareId",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "sharesFor",
      inputs: [
        {
          name: "recipient",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "shareIds",
          type: "bytes32[]",
          internalType: "bytes32[]"
        },
        {
          name: "headers",
          type: "tuple[]",
          internalType: "struct ACPShareRegistry.ShareHeader[]",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "blockNumber",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            }
          ]
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "supportsInterface",
      inputs: [
        {
          name: "interfaceId",
          type: "bytes4",
          internalType: "bytes4"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "upgradeToAndCall",
      inputs: [
        {
          name: "newImplementation",
          type: "address",
          internalType: "address"
        },
        {
          name: "data",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [],
      stateMutability: "payable"
    },
    {
      type: "event",
      name: "Initialized",
      inputs: [
        {
          name: "version",
          type: "uint64",
          indexed: false,
          internalType: "uint64"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "RoleAdminChanged",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        },
        {
          name: "previousAdminRole",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        },
        {
          name: "newAdminRole",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "RoleGranted",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        },
        {
          name: "account",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "sender",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "RoleRevoked",
      inputs: [
        {
          name: "role",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        },
        {
          name: "account",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "sender",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "ShareRemoved",
      inputs: [
        {
          name: "recipient",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "issuer",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "shareId",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "Shared",
      inputs: [
        {
          name: "recipient",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "issuer",
          type: "address",
          indexed: true,
          internalType: "address"
        },
        {
          name: "shareId",
          type: "bytes32",
          indexed: true,
          internalType: "bytes32"
        },
        {
          name: "acp",
          type: "tuple",
          indexed: false,
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        },
        {
          name: "metadata",
          type: "bytes",
          indexed: false,
          internalType: "bytes"
        }
      ],
      anonymous: false
    },
    {
      type: "event",
      name: "Upgraded",
      inputs: [
        {
          name: "implementation",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "error",
      name: "AccessControlBadConfirmation",
      inputs: []
    },
    {
      type: "error",
      name: "AccessControlUnauthorizedAccount",
      inputs: [
        {
          name: "account",
          type: "address",
          internalType: "address"
        },
        {
          name: "neededRole",
          type: "bytes32",
          internalType: "bytes32"
        }
      ]
    },
    {
      type: "error",
      name: "AddressEmptyCode",
      inputs: [
        {
          name: "target",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "AlreadyShared",
      inputs: []
    },
    {
      type: "error",
      name: "ERC1967InvalidImplementation",
      inputs: [
        {
          name: "implementation",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "ERC1967NonPayable",
      inputs: []
    },
    {
      type: "error",
      name: "FailedCall",
      inputs: []
    },
    {
      type: "error",
      name: "InvalidInitialization",
      inputs: []
    },
    {
      type: "error",
      name: "IssuerSignatureMissing",
      inputs: []
    },
    {
      type: "error",
      name: "NotInitializing",
      inputs: []
    },
    {
      type: "error",
      name: "NotIssuer",
      inputs: []
    },
    {
      type: "error",
      name: "NotIssuerOrRecipient",
      inputs: []
    },
    {
      type: "error",
      name: "RecipientMissing",
      inputs: []
    },
    {
      type: "error",
      name: "SealingKeyMustBeEmpty",
      inputs: []
    },
    {
      type: "error",
      name: "ShareExpired",
      inputs: []
    },
    {
      type: "error",
      name: "UUPSUnauthorizedCallContext",
      inputs: []
    },
    {
      type: "error",
      name: "UUPSUnsupportedProxiableUUID",
      inputs: [
        {
          name: "slot",
          type: "bytes32",
          internalType: "bytes32"
        }
      ]
    },
    {
      type: "error",
      name: "UnknownShare",
      inputs: []
    }
  ]
};

// src/MockERC1967Proxy.ts
var MockERC1967ProxyArtifact = {
  contractName: "MockERC1967Proxy",
  isFixed: false,
  abi: [
    {
      type: "constructor",
      inputs: [
        {
          name: "implementation",
          type: "address",
          internalType: "address"
        },
        {
          name: "data",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      stateMutability: "payable"
    },
    {
      type: "fallback",
      stateMutability: "payable"
    },
    {
      type: "event",
      name: "Upgraded",
      inputs: [
        {
          name: "implementation",
          type: "address",
          indexed: true,
          internalType: "address"
        }
      ],
      anonymous: false
    },
    {
      type: "error",
      name: "AddressEmptyCode",
      inputs: [
        {
          name: "target",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "ERC1967InvalidImplementation",
      inputs: [
        {
          name: "implementation",
          type: "address",
          internalType: "address"
        }
      ]
    },
    {
      type: "error",
      name: "ERC1967NonPayable",
      inputs: []
    },
    {
      type: "error",
      name: "FailedCall",
      inputs: []
    }
  ]
};

// src/MockZkVerifier.ts
var MockZkVerifierArtifact = {
  contractName: "MockZkVerifier",
  isFixed: true,
  fixedAddress: "0x0000000000000000000000000000000000005001",
  abi: [
    {
      type: "function",
      name: "exists",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "insertCtHash",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "value",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "insertPackedCtHashes",
      inputs: [
        {
          name: "ctHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "values",
          type: "uint256[]",
          internalType: "uint256[]"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "zkVerify",
      inputs: [
        {
          name: "value",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "utype",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "user",
          type: "address",
          internalType: "address"
        },
        {
          name: "securityZone",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "",
          type: "tuple",
          internalType: "struct EncryptedInput",
          components: [
            {
              name: "ctHash",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "securityZone",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "utype",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "zkVerifyCalcCtHash",
      inputs: [
        {
          name: "value",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "utype",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "user",
          type: "address",
          internalType: "address"
        },
        {
          name: "securityZone",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "zkVerifyCalcCtHashesPacked",
      inputs: [
        {
          name: "values",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "utypes",
          type: "uint8[]",
          internalType: "uint8[]"
        },
        {
          name: "user",
          type: "address",
          internalType: "address"
        },
        {
          name: "securityZone",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "chainId",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "ctHashes",
          type: "uint256[]",
          internalType: "uint256[]"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "zkVerifyPacked",
      inputs: [
        {
          name: "values",
          type: "uint256[]",
          internalType: "uint256[]"
        },
        {
          name: "utypes",
          type: "uint8[]",
          internalType: "uint8[]"
        },
        {
          name: "user",
          type: "address",
          internalType: "address"
        },
        {
          name: "securityZone",
          type: "uint8",
          internalType: "uint8"
        },
        {
          name: "chainId",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "inputs",
          type: "tuple[]",
          internalType: "struct EncryptedInput[]",
          components: [
            {
              name: "ctHash",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "securityZone",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "utype",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "signature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      stateMutability: "nonpayable"
    },
    {
      type: "error",
      name: "InvalidInputs",
      inputs: []
    }
  ]
};

// src/MockThresholdNetwork.ts
var MockThresholdNetworkArtifact = {
  contractName: "MockThresholdNetwork",
  isFixed: true,
  fixedAddress: "0x0000000000000000000000000000000000005002",
  abi: [
    {
      type: "function",
      name: "decodeLowLevelReversion",
      inputs: [
        {
          name: "data",
          type: "bytes",
          internalType: "bytes"
        }
      ],
      outputs: [
        {
          name: "error",
          type: "string",
          internalType: "string"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "decryptForTxWithACP",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      outputs: [
        {
          name: "allowed",
          type: "bool",
          internalType: "bool"
        },
        {
          name: "error",
          type: "string",
          internalType: "string"
        },
        {
          name: "decryptedValue",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "decryptForTxWithoutACP",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      outputs: [
        {
          name: "allowed",
          type: "bool",
          internalType: "bool"
        },
        {
          name: "error",
          type: "string",
          internalType: "string"
        },
        {
          name: "decryptedValue",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "exists",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "bool",
          internalType: "bool"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "initialize",
      inputs: [
        {
          name: "_taskManager",
          type: "address",
          internalType: "address"
        },
        {
          name: "_acl",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "mockAcl",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "contract MockACL"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "mockQueryDecrypt",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "issuer",
          type: "address",
          internalType: "address"
        }
      ],
      outputs: [
        {
          name: "allowed",
          type: "bool",
          internalType: "bool"
        },
        {
          name: "error",
          type: "string",
          internalType: "string"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "mockTaskManager",
      inputs: [],
      outputs: [
        {
          name: "",
          type: "address",
          internalType: "contract MockTaskManager"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "queryDecrypt",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      outputs: [
        {
          name: "allowed",
          type: "bool",
          internalType: "bool"
        },
        {
          name: "error",
          type: "string",
          internalType: "string"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "querySealOutput",
      inputs: [
        {
          name: "ctHash",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "acp",
          type: "tuple",
          internalType: "struct ACP",
          components: [
            {
              name: "issuer",
              type: "address",
              internalType: "address"
            },
            {
              name: "expiration",
              type: "uint64",
              internalType: "uint64"
            },
            {
              name: "recipient",
              type: "address",
              internalType: "address"
            },
            {
              name: "revokerData",
              type: "uint256",
              internalType: "uint256"
            },
            {
              name: "revokerContract",
              type: "address",
              internalType: "address"
            },
            {
              name: "scope",
              type: "uint8",
              internalType: "uint8"
            },
            {
              name: "contracts",
              type: "address[]",
              internalType: "address[]"
            },
            {
              name: "handles",
              type: "bytes32[]",
              internalType: "bytes32[]"
            },
            {
              name: "sealingKey",
              type: "bytes32",
              internalType: "bytes32"
            },
            {
              name: "issuerSignature",
              type: "bytes",
              internalType: "bytes"
            },
            {
              name: "recipientSignature",
              type: "bytes",
              internalType: "bytes"
            }
          ]
        }
      ],
      outputs: [
        {
          name: "allowed",
          type: "bool",
          internalType: "bool"
        },
        {
          name: "error",
          type: "string",
          internalType: "string"
        },
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "seal",
      inputs: [
        {
          name: "input",
          type: "uint256",
          internalType: "uint256"
        },
        {
          name: "key",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "function",
      name: "unseal",
      inputs: [
        {
          name: "hashed",
          type: "bytes32",
          internalType: "bytes32"
        },
        {
          name: "key",
          type: "bytes32",
          internalType: "bytes32"
        }
      ],
      outputs: [
        {
          name: "",
          type: "uint256",
          internalType: "uint256"
        }
      ],
      stateMutability: "pure"
    },
    {
      type: "error",
      name: "NotAllowed",
      inputs: []
    },
    {
      type: "error",
      name: "SealingKeyInvalid",
      inputs: []
    },
    {
      type: "error",
      name: "SealingKeyMissing",
      inputs: []
    }
  ]
};

exports.ACPShareRegistryArtifact = ACPShareRegistryArtifact;
exports.ACPTimestampRevokerArtifact = ACPTimestampRevokerArtifact;
exports.MockACLArtifact = MockACLArtifact;
exports.MockCoFHEAddressBookArtifact = MockCoFHEAddressBookArtifact;
exports.MockERC1967ProxyArtifact = MockERC1967ProxyArtifact;
exports.MockTaskManagerArtifact = MockTaskManagerArtifact;
exports.MockThresholdNetworkArtifact = MockThresholdNetworkArtifact;
exports.MockZkVerifierArtifact = MockZkVerifierArtifact;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map