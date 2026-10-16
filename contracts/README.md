# AidChain Solidity prototype (v6.0)

Build and test with Foundry:

```bash
forge build
forge test -vv     # 20 passing tests
```

No `forge-std` dependency: the test contract calls the cheatcode address directly, so this folder
compiles on its own.

## Contracts

**`src/MockUSDC.sol` — `dUSDC`.** Mintable demonstration token, 6 decimals, no owner, no value.
Anyone can mint, on purpose, so a testnet demo never stalls waiting for a faucet. Never present it
as USDC.

**`src/AidChainEscrow.sol`.** Per-project escrow.

| Function | Who | Effect |
|---|---|---|
| `createProject(reviewer, target, allocations)` | NGO | Milestone allocations must sum to `target`; reviewer must be a different address; max 12 milestones |
| `donate(projectId, amount)` | anyone | Capped at the project target; records per-donor `contributed` |
| `submitEvidence(projectId, milestoneId, hash)` | NGO | Rejected milestones can be re-submitted; a milestone already under review cannot be silently edited |
| `approveMilestone(projectId, milestoneId)` | reviewer | Only after evidence is submitted |
| `rejectMilestone(projectId, milestoneId)` | reviewer | Returns the milestone to the NGO instead of paying it |
| `releaseFunds(projectId, milestoneId)` | NGO | Only approved, never-paid milestones, and only up to `available()` |
| `refund(projectId, amount)` | any donor | Up to `refundable(projectId, donor)` |
| `available(id)` / `refundable(id, donor)` / `milestoneStatus(id, m)` | views | Used by the dashboard to display live contract state |

Invariants the tests and a live-node run check: `released + refunded <= raised` per project, and the
contract's `dUSDC` balance equals the sum of `available()` across projects, so neither a payout nor
a refund can overdraw escrow.

## Two things to know before you verify a deployment

- `token` is an `immutable`, so the deployed runtime code contains the token address where the
  compiled artifact has zero placeholders. Compare code with `.build/verify_code.py`, not with a
  naive hash of `deployedBytecode`.
- Two `forge` lint warnings remain by choice: `reentrancy-no-eth` (state is written before the
  external call and the `locked` guard is set on entry) and `require-revert-in-loop` (bounded at 12
  iterations). Events are emitted before transfers.

## Status

Testnet prototype. Not audited, not upgradeable, no dispute resolution, no pause. NGO and reviewer
collusion is not prevented — independence is address-based only. Refunds are first-come when
several donors claim against the same project. Use Sepolia only; never real funds.
