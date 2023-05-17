# ChainGuard - A Secure and Flexible Wallet for Self-Sovereign Identity and Digital Assets Using Account Abstraction

Smart contract implementation of Account Abstraction.

**Contracts list**
- `BaseAccount.sol`: Basic account implementation. This contract provides the basic logic for implementing the IAccount interface  - validateUserOp. Specific account implementation should inherit it and provide the account-specific logic
- `BasePaymaster.sol`: Helper class for creating a paymaster. Provides helper methods for staking. Validates that the postOp is called only by the entryPoint
- `Account.sol`: This is sample minimal account, has execute, eth handling methods, has a single signer that can send requests through the entryPoint.
- `DepositPaymaster.sol`: A token-based paymaster that accepts token deposits. The deposit is only a safeguard: the user pays with his token balance.
- `AccountFactory`: A simple factory contract for `Account.sol`. A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
