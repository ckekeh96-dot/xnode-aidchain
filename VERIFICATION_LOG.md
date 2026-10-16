# AidChain v6.0 — verification log (what was actually run, and what was not)

Recorded 2026-10-15. Environment: Windows 10, Node v24.19.0, Python 3.12.10, no Docker.
Foundry `v1.8.5` win32 binary installed to `%USERPROFILE%\.foundry\bin` from the official GitHub
release; the downloaded zip's SHA-256 matched the published checksum
(`21f86b56…1afd72` was the artifact digest, verified before unpacking).

## 1. Contract compile and unit tests — PASSED

```
forge build      # solc 0.8.24, optimizer on, runs 200 — compiles clean
forge test -vv   # 20 passed; 0 failed; 0 skipped
```

Coverage of the 20 tests includes the three controls the brief demanded plus the two new features:

| Rule | Test |
|---|---|
| Unauthorized withdrawal blocked | `testNonNGOCannotRelease`, `testOnlyReviewerCanApprove`, `testOnlyReviewerCanReject` |
| Duplicate release blocked | `testCannotReleaseTwice` |
| Release beyond escrow blocked | `testRefundCannotExceedProjectHoldings`, `testEscrowTokenBalanceMatchesAccounting` |
| Reject returns a milestone to the NGO | `testRejectReturnsMilestoneToNGO` |
| Rejection is visible to donors in `milestoneStatus` | `testMilestoneStatusStrings` |
| Cannot approve a rejected milestone | `testCannotApproveAfterReject` |
| Evidence cannot be swapped mid-review | `testEvidenceCannotChangeWhileUnderReview` |
| Refund capped by own contribution | `testCannotRefundMoreThanContributed` |
| Refund + release cannot overdraw | `testRefundCannotExceedProjectHoldings` |

**Bug found and fixed during the pre-deployment pass:** `milestoneStatus()` tested
`m.submitted && m.rejected` for the rejected state, but `rejectMilestone` sets
`submitted = false`, so that branch was unreachable and a rejected milestone reported
`"pending"` — exactly what judges would have read in the dashboard. Now it tests `m.rejected`
alone, and `testMilestoneStatusStrings` walks the full string lifecycle
(`pending → under_review → rejected → under_review → approved → released`).

Two `forge` lint warnings were fixed (events now emitted before the external token call in
`donate`, `releaseFunds`, `refund`). Two remain and are accepted deliberately:
`reentrancy-no-eth` (the state-first/lock-first pattern already covers it; the low-level `call`
exists to tolerate ERC20s that return no boolean) and `require-revert-in-loop` (bounded at 12
milestones by `createProject`).

## 2. Test deployment to a live local node — PASSED

`bash .build/deploy_local.sh` deploys both contracts to a fresh `anvil` chain on port 8546 and
drives the whole lifecycle through JSON-RPC with four distinct funded accounts (deployer, NGO,
independent reviewer, donor). Run on 2026-10-15 against the current build:

```
== ALL CHECKS PASSED
49 checks passed (42 behavioural + 7 on-chain event counts), 0 failed
13 transactions confirmed on-chain, status 0x1 each
8 guard simulations reverted with their intended reason string, 0 unexpected successes
```

| Stage | Observed |
|---|---|
| NGO creates project 1 (target 1000, milestones 400/600) | `ProjectCreated`, `nextProjectId` → 2 |
| Donor mints, approves, donates 1000 dUSDC | escrow holds 1000000000, `available(1)` == 1000000000 |
| NGO submits weak evidence | state `under_review` |
| Reviewer rejects | state `rejected` (the fixed branch), approval now refused |
| NGO resubmits, reviewer approves, NGO releases | NGO paid 400, `available(1)` == 600, state `released` |
| Donor refunds 200, then a further 400 | `refundable` shrinks correctly; escrow ends at 0 |
| Final accounting | raised 1000000000 == released 400000000 + refunded 600000000, escrow balance 0 |

Guards observed reverting with their contract reason strings: `Independent reviewer required`,
`Milestones must equal target`, `Exceeds target`, `Not eligible`, `Not project NGO`,
`Not approved or already paid`, `Exceeds refundable`, `Insufficient escrow`.

The last two are the ones the brief called out: a milestone approved for 600 dUSDC could not be
released once refunds had reduced the escrow to 400, proving `released + refunded <= raised`
holds against real token custody, not just in unit tests. Event counts were checked per signature
(`EvidenceSubmitted` 3, `MilestoneApproved` 2, `Refunded` 2, others 1) because those are exactly
what the dashboard audit view reads back. Addresses and transaction hashes are recorded in
`deployments/local-test.json`.

## 3. Deployed bytecode equals tested bytecode — PASSED

`python .build/verify_code.py <escrow> <token> <rpc>` → `MATCH` for both, against the local
deployment above.

Important: a plain hash comparison **fails for the escrow by design**. `token` is an `immutable`,
so the compiler bakes the token address into the runtime code; the artifact carries zero
placeholders at three sites. The verifier writes the real address into those slots and then
requires byte-exact equality, so a genuine swap of code still fails loudly. Proven against the
local node before you rely on it against Sepolia.

Reference compiled runtime code (SHA-256 of the hex, `0x` stripped) for this build:
- `MockUSDC` runtime: `9bee8eed532aaefbacf58d4ac665c36fb6932cdd071af58a0d01fe1f078d9fb3` (1666 bytes)
- `AidChainEscrow` runtime with zeroed immutable slots: `16c145f69c085a36979b5195e0fa1d64fc1f987b117424cc9895d61aaedbffae` (6334 bytes)

These match only if you compile with solc 0.8.24, optimizer ON, runs 200 (Part 4 of
`DEPLOY_SEPOLIA.md`). Note that editing *any* source file changes the metadata tail appended to
every contract in the compilation — `MockUSDC`'s hash changed between builds even though
`MockUSDC.sol` was untouched — so re-record these hashes if you recompile after any edit.

## 4. Dashboard static checks — PASSED

`python .build/validate.py`
- 3 inline scripts parse (`node --check`), including the ES module.
- 42 element IDs referenced by the chain module all exist in the DOM; no duplicate IDs.
- Every nav view has both a section and a title entry.
- Every `<label for=…>` points at a real control.

`python .build/abi_check.py`
- All 23 escrow signatures declared in the UI match the compiled ABI on name, input count and
  output count; all 6 declared MockUSDC signatures match too.

Real bugs this caught before packaging: an `await` inside a non-async callback in the mint handler
(a hard `SyntaxError` that would have killed the whole module), and an ABI whose escrow `projects()`
tuple still had 7 fields after the contract gained `refunded`.

## 5. Browser end-to-end run against a live local chain — PASSED

Run on 2026-10-15 in a real browser (the in-app automation browser) against the local `anvil`
deployment from section 2, with an injected EIP-1193 provider (`window.ethereum` shim forwarding
JSON-RPC to `127.0.0.1:8546` with switchable anvil accounts; anvil signs its own unlocked accounts).
Every button in the Testnet Lab, the On-chain Audit view and the offline demo was clicked and its
result checked, capturing `window.onerror`, `unhandledrejection` and `console.error` throughout:
**zero page errors for the entire run.**

On-chain lifecycle (wallet shim switching accounts exactly like MetaMask account-switching, which
also exercises the module's `accountsChanged` reset – each switch correctly forced reconnect +
re-validate):

| Button | Observed |
|---|---|
| Connect wallet | connects on chain 31337; was hard-coded to Sepolia before this run (the reported bug) |
| Validate contracts | code + token + decimals checks pass; chip → "blockchain mode" |
| Refresh balances | gas / demo balance / allowance / escrow hold read back per metric |
| Create project on-chain | project #2 created (reviewer = account 2), field auto-filled |
| Mint demo tokens | 400 dUSDC minted to the donor wallet |
| Approve & donate | 2 transactions confirmed; Donation receipt modal (hash, block, network, gas) |
| Submit evidence hash | tx confirmed; state read → `under_review` |
| Reject evidence | reviewer tx confirmed; state read → **`rejected`** (the section-1 contract fix, now proven through the live UI) |
| Resubmit + Approve | `under_review` → `approved` |
| Release funds | 250 dUSDC released; Milestone-release receipt; escrow `available` 400 → 150 |
| Read refundable | 150 dUSDC = 400 contributed − 250 released (exact) |
| Claim refund | 150 dUSDC refunded; Donor-refund receipt |
| Receipt modal | Save JSON, View on-chain audit (navigates + closes), × close, Escape close, list "view" reopen |
| Audit: Sync events | 19 events read from the contract's own logs (blocks 0–25, 0 undecodable), newest first |
| Audit: filter / export | project filter 19 → 8 rows and back; CSV export of all 19 events |
| Clear log | log area resets |
| Guard check | wrong token address → "No deployed code… run .build/deploy_local.sh" surfaced in status + log, validated state preserved |

Offline demo sweep: all six views navigate; project search filters 3 → 1 → 3; create-project panel
toggles, validation toast fires on empty submit, a labelled QA project was created; donation flow
all three steps (review → payment proof → record) with the attachment control exercised both with a
real previously-selected file and with an injected `qa-check.png` (status line updates, receipt
records name/size, file explicitly "not stored"); NGO submit → reviewer approve+release → NGO
submit → reviewer reject all confirmed with toasts and ledger entries; ledger hash-chain verify
("✓ … 7 entries"), CSV export, receipt save/close/navigate; **Reset demo** (its confirm dialog) was
used afterwards to restore the seed sample data, closing every QA write.

Bugs found by this run and fixed in `index.html` in the same session:

1. **Connect wallet refused the local chain** — the module hard-coded Sepolia (`chainId='0xaa36a7'`,
   `ready()` required `11155111n`), which is exactly why connecting felt broken after adding chain
   31337 to the wallet. The dashboard is now network-aware (Sepolia + local anvil, everything else
   refused before any provider is created); labels, explorer links and CSV names follow the chain.
2. **Mode chip printed `[objec…ise]`** — `short(signer.getAddress())` passed a Promise. The wallet
   address is now cached at connect/refresh time.
3. **Receipts printed the confirmations getter's source code** — ethers v6 `receipt.confirmations`
   is an async method, not a number; `issueReceipt` now awaits it ("1 confirmation(s)" observed).
4. **Audit sync always failed on live ethers v6** — `queryFilter(null,…)` throws ("Cannot use 'in'
   operator…"); replaced with `eth_getLogs` + the existing manual parse loop, which is stable across
   ethers releases, and verified live (19 events decoded).

Also verified while there: a stale manual address entry in this browser's localStorage took
precedence over the config file exactly as designed (and was cleared before the run); the config's
`local` block pre-fills the local addresses on load.

## 6. NOT verified — be honest about this

- **Wallet signing popups were not exercised.** The browser run used a programmatic EIP-1193 wallet
  (anvil-signed), not MetaMask; MetaMask's own approval/rejection dialogs, network-switch prompts
  and account-change prompts remain unproven. Everything behind the prompt (parsing, validation,
  receipts, guards) was exercised.
- **The refused-network path is code-verified only.** The automation environment blocks simulating a
  mainnet connect attempt; the guard itself (`NETWORKS[raw]` lookup rejecting anything but 31337 /
  11155111 before a provider exists) was verified by reading the shipped code, not by a live run.
- **Nothing is deployed to Sepolia yet.** The dashboard deliberately contains no Sepolia addresses;
  the `local` block of `deployments/sepolia.config.js` carries only the local test deployment.
- **Gas/fee behaviour, wallet-rejection paths and network-switch races are untested** (balance
  display and unmetered anvil gas were, but real fee estimation on Sepolia was not).
- Audit-sync behaviour against a real public RPC (block-range caps, rate limits) is untested; the
  sync path reports read failures explicitly rather than showing an empty "all clear" table.

Run Part 11 of `DEPLOY_SEPOLIA.md` yourself before the demo and treat the first successful
donation as the acceptance test.

## 7. Demo-wallet fallback for wallet-free machines — PASSED (added 2026-10-15)

On a machine without MetaMask the dashboard's connect button can only report "No injected wallet
found". `.build/demo-wallet.js` closes that gap for **local demos only**: it is an EIP-1193 shim
that forwards JSON-RPC to `http://127.0.0.1:8546` and answers `eth_requestAccounts` with whichever
of anvil's four default development accounts is selected — `demoWallet.setAccount('deployer' |
'ngo' | 'reviewer' | 'donor')`. anvil signs for its own unlocked accounts, so the file contains
**no private keys**, and it speaks to chain 31337 only — it cannot touch Sepolia or real funds.
Load it from the browser console while the dashboard is open:

    const s=document.createElement('script');s.src='/.build/demo-wallet.js';document.head.appendChild(s);

Verified 2026-10-15 in the browser against the freshly re-run local chain, with the page loaded
*without* any wallet (`typeof window.ethereum` === `"undefined"` before install — the same state a
wallet-free machine has). Before this test, the full battery was re-run on the current build: a
fresh chain was started, `deploy_local.sh` reported ALL CHECKS PASSED (every ok line across input
guards, the full lifecycle, refunds, accounting and the 7 event-count checks; same deterministic
contract addresses, so the dashboard's saved addresses still match), `forge test` 20/20 passed, and
`validate.py` + `abi_check.py` were clean.

| Step | Result |
|---|---|
| Install via the console one-liner | `window.ethereum.isDemoWallet === true`, 4 accounts listed, `eth_chainId` → `0x7a69` |
| Connect wallet | "Connected to local anvil test chain: 0xf39F…2266", chip updates |
| Check contracts | verified at the deterministic addresses; readout: gas 9,999.99 ETH, escrow 0 dUSDC, project #1 raised 1,000 / released 400 / refunded 600 |
| `demoWallet.setAccount('ngo')` + Connect + Check contracts | chip and reads rebind to 0x7099…79C8; demo balance reads 400 dUSDC (matches the harness's NGO payout exactly) |
| Mint 5 dUSDC (write path) | tx `0xa6e7…d411` confirmed; node-side check: `from` = 0x7099…79C8 (the switched account), `to` = the token, selector `0x40c10f19`; balance 400 → 405 |
| On-chain Audit → Sync | 11 events across blocks 0–16, 0 undecodable — exactly the harness's 11 escrow events |
| Console | 10 lines, all `log` level, all from demo-wallet.js; zero errors or warnings |

Known behaviour, by design: the dashboard attaches its `accountsChanged`/`chainChanged` listeners
only when a wallet exists at page load, so after `setAccount(...)` the operator clicks **Connect
wallet** then **Check contracts** again — the two clicks re-bind both the signer (`connect()`)
and the action contracts (`validate()`, which is what actually swaps the signer the actions use).
Both were exercised above exactly in that order.

Not verified / out of scope: Sepolia — the shim is local-chain only, so the public demo still
needs MetaMask; and browser-profile gates like Chrome's "allow pasting" prompt (documented in the
file header). This is a demo convenience, not a wallet.

## 8. v6.1 one-click local demo panel — PASSED (added 2026-10-15)

The Testnet Lab gained a **One-click local blockchain demo** panel: on load it probes
`127.0.0.1:8546` for chain 31337 and reports "chain detected" / "chain not found" / "needs
localhost" (`file://`); one click installs `.build/demo-wallet.js`, connects, validates the
configured contracts, pre-fills the reviewer field and reveals a numbered guided walkthrough. The
**Act as** role dropdown reconnects and re-validates automatically on every switch — a small
`attachWalletEvents()` guard now attaches the `accountsChanged`/`chainChanged` listeners at page
load *or* at the end of the first successful connect, so a wallet installed after load works too
(previously the listeners only attached if a wallet existed at load, which is why section 7's
manual flow needed explicit clicks after `setAccount`).

Verified 2026-10-15 in the browser on a fresh harness chain (anvil 8546, `deploy_local.sh` run
once; page loaded with `typeof window.ethereum === "undefined"`):

| Step | Result |
|---|---|
| Fresh load | panel reports "chain detected"; no wallet installed yet |
| One click **Launch local blockchain demo** | demo wallet installed, connected as deployer 0xf39F…2266, contracts validated, chip "Blockchain mode · Local chain 31337", role dropdown enabled, reviewer pre-filled 0x3C44…93BC |
| Dropdown → NGO | auto reconnect + validate, 0x7099…79C8, no manual Connect/Check clicks |
| NGO: create project | project #2, tx `0x657a…c551`, `#chainProject` auto→2 |
| Dropdown → Donor | auto reconnect, 0x90F7…b906 |
| Donor: mint 300 dUSDC | tx `0x6ae5…b9e9`, block 17, node-side `from`/selector/balance check passed |
| Donor: Approve & donate 300 | approve `0x5d12…cc5a` then donate `0x94e3…7520` (block 19) both confirmed; receipt modal shown with status success |
| Dropdown → NGO; submit evidence (milestone 0) | tx `0x66b3…ab58` |
| Dropdown → Reviewer; approve | tx `0xcf27…8647` |
| Dropdown → NGO; release | tx `0x5761…2cc3`, block 22, receipt: 250 dUSDC |
| Dropdown → Donor; refund (blank = max) | tx `0xd45c…f777`, block 23, receipt: 50 dUSDC |
| On-chain Audit → Sync | 17 events across blocks 0–23, 0 undecodable — 11 harness + 6 project-#2 |
| Console | only demo-wallet `log` lines; zero errors or warnings |

Node-side accounting (cast against 127.0.0.1:8546): project #2 raised 300 = released 250 +
refunded 50 dUSDC exactly; `available(2)` = 0; milestone 0 paid; escrow token balance 0; donor
balance 50 (300 minted − 300 donated + 50 refunded); NGO balance 650 (400 harness payout + 250
release).

Honest note on role labels: the demo-wallet account names ("donor" etc.) are conveniences, not
chain facts — on a harness chain the harness reserved its own donor address (0x15d3…), so the
panel's "donor" account starts at 0 dUSDC; the guide's mint-first step exists for exactly that
reason. After this run the two demo-wallet console hints were reworded to mention the automatic
reconnect instead of telling users to click Connect/Check manually.

Still untested / unchanged: MetaMask's own popup flow, anything on Sepolia, and real fee
estimation. The one-click panel is local-chain only; remote judges still need Sepolia.

## 9. Sepolia deployment — LIVE, core-code match (added 2026-10-15)

Deployed by the user through Remix 2.6.7 + MetaMask (Injected Provider — every transaction
confirmed inside the wallet; the private key never left MetaMask, and no key was ever written to
any file). Compiler settings: solc 0.8.24+commit.e11b9ed9, optimizer on with 200 runs, EVM
version `cancun`, sources pasted as `src/MockUSDC.sol` and `src/AidChainEscrow.sol`. Gas came
from the user's MetaMask account — notably **not** the faucet wallet `0xfA35B2C5…905a`, which
still has nonce 0 and its 0.05 test ETH intact.

| Contract | Address | Creation block (RPC binary search on `eth_getCode`) |
|---|---|---|
| MockUSDC | `0x459324ca0a4BFe081497Cf4578267d8AD22646FC` | 11922882 |
| AidChainEscrow | `0x69A1857f7baC724637D157d9a0E527a5c76De868` | 11922896 (constructor arg = the token address) |

`verify_code.py` against `https://ethereum-sepolia-rpc.publicnode.com`:

```
MockUSDC       artifact=1666 live=1666 bytes
  MATCH (core code) - logic bytes identical; compiler metadata trailer differs
AidChainEscrow artifact=6334 live=6334 bytes; immutable token slots filled=3
  MATCH (core code) - logic bytes identical; compiler metadata trailer differs
```

Both contracts' **logic bytecode is byte-identical to the tested artifacts** (§1–§3), including
the escrow's three immutable `token` slots, which correctly hold `0x4593…46FC`; only the ~53-byte
CBOR compiler-metadata trailer differs (solc 0.8.24 on both sides) — the build-fingerprint
difference between a Remix compile and a Foundry compile of the same settings, which does not
affect execution. On-chain sanity: escrow `token()` returns the token address; `symbol()` =
"dUSDC", `name()` = "AidChain Demo USD", `decimals()` = 6.

**First attempt — optimizer off, abandoned:** the initial pair (MockUSDC
`0x9a9D9ca3C8C62138EB7D27E41835e817e8f7614D`, AidChainEscrow
`0x3b9Ff1EF6006C91d382e0287EF57E4F065F66653`) was compiled with Remix's default optimizer-off
setting: functional (all sanity calls pass) but ~2x the bytecode (3370 / 11866 bytes). Proven to
be the same source by a local optimizer-off recompile (`FOUNDRY_OPTIMIZER=false`, `--out
out-noopt`) whose core bytes matched the on-chain code exactly — but it fails the "deployed code
equals the tested build" standard, so both addresses were abandoned (no funds in them, nothing
references them) and re-deployed as the pair above.

`deployments/sepolia.config.js` now carries the live pair (escrow, token, `fromBlock` 11922882,
`deployedAt` 2026-10-15); `escrowVerifiedOn` stays empty until source verification on
sepolia.etherscan.io is done.

**Still untested — be honest:** Etherscan source verification; the full acceptance journey
(donate → evidence → approve → release → audit sync) on Sepolia through the dashboard; the
multi-role flow with real MetaMask account switching. Section 8's "anything on Sepolia" caveat
is superseded by this deployment, but the journey-level testing it implied is still open.
