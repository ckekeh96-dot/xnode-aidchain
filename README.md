# XNode AidChain — Hackathon Demo v6.1

## Two separate modes

**Demo Mode** works offline with no wallet: simulated donations, uploaded sample payment proofs,
simulated receipts, role switching, the local hash-chained ledger and impact views.

**Blockchain Mode** is the **Testnet Lab** and **On-chain Audit** navigation views: an optional
Ethereum Sepolia **or local anvil test chain (chain id 31337)** connection using ethers.js. Every
other network, mainnet included, is refused at connect time so a valueless demo token can never
touch real funds. It requires internet, a browser wallet and your own deployment of `MockUSDC.sol`
and `AidChainEscrow.sol` (Sepolia additionally needs Sepolia ETH for gas; a local anvil chain needs
none). The testnet token is **dUSDC**, a freely mintable valueless demo token; it is NOT USDC. In
this mode a receipt is issued
only after a transaction is mined with status = success, and an uploaded proof file is supporting
documentation — the confirmed transaction is the payment evidence. The status chip in the top bar and
the sidebar footer change as you cross between the two modes, so the two data sources cannot be
confused on screen.

**Deploying, verifying on Etherscan, and running the on-chain journey: follow `DEPLOY_SEPOLIA.md`.
What was mechanically verified before packaging, and what was not: `VERIFICATION_LOG.md`.**

Build and test the contracts with Foundry:

```bash
cd contracts && forge build && forge test -vv    # 20 passing tests
```

## Important scope and safety notes
- No contracts have been deployed to Sepolia by this package; the Sepolia fields in `deployments/sepolia.config.js` ship empty. A local test-chain deployment is recorded in `deployments/local-test.json` and can be reproduced with `.build/deploy_local.sh`.
- Solidity contracts are educational prototypes, not audited or production-ready; do not use with real tokens or funds.
- The optional testnet adapter requires internet to load ethers.js from jsDelivr. The original local demo does not.
- Local browser audit data and testnet transactions are separate data sources; the impact dashboard still shows local demo records, not on-chain aggregates.
- The demo role selector is not blockchain authentication. The contract enforces permissions by wallet address.
- Public evidence references are hashed on-chain; keep personal or sensitive beneficiary information off-chain.
- Reviewer independence is address-based only; it does not establish real-world identity or protect against collusion.
- There is no dispute resolution, fraud detection, emergency pause, or upgrade system. Refunds are donor-exit only (unreleased own contribution). These are production roadmap items.
- Do not use the event image to imply organizer endorsement.

## v4.0: donation proof and project creation

Donation demo: select project and amount, review, then enter a **fictional** reference such as `DEMO-2026-0001` and check the simulation declaration. Only then is a local demo donation recorded and a clearly marked simulated receipt offered. Duplicate references are blocked. This is **not real payment verification**.

Create project: select NGO Project Manager, open Projects & Donations, select Create project, and complete title, impact description, location, NGO name, category, target and three milestone names. Publish to add it to the donation selector, governance panel, impact views, and ledger.

## v5 presentation and popup reliability

- Scrollable donation/receipt dialogs, body scroll locking, focus return, Escape and backdrop dismissal, and a keyboard focus loop.
- Responsive mobile dialog actions and improved focus outlines.
- Payment proof is mandatory before a simulated donation is logged and a receipt is offered. The old direct-donation click handler was removed.
- Project creation resets form fields after publishing; location, organization, and impact category are searchable.
- An additional judge-ready five-minute walkthrough appears in How It Works.

**Validation:** Both inline JavaScript scripts pass `node --check`, and the dashboard was driven
end-to-end in a real browser on 2026-10-15 (local anvil chain, injected EIP-1193 wallet): every
Testnet Lab, On-chain Audit and offline-demo button was exercised, including the full on-chain
lifecycle create → mint → donate → evidence → reject → resubmit → approve → release → refund and
the audit sync/CSV export, with zero page errors. Wallet **signing popups** (MetaMask's own UI) are
the one path that run cannot prove — the browser run used a programmatic wallet. See section 5 of
`VERIFICATION_LOG.md` for the itemised results. A MetaMask-free fallback for wallet-free machines
ships as `.build/demo-wallet.js` (local chain only, contains no private keys; verified 2026-10-15 —
see section 7 of `VERIFICATION_LOG.md`).

**Important:** This remains a local demonstration. References and receipts are fictional, and the hash chain is editable browser storage, not an immutable blockchain ledger. Testnet features require wallet, RPC, and deployed contract addresses.

## v5.1 simulated payment-proof attachment

Step 2 requires selecting a local sample or redacted **PDF, PNG, or JPEG (maximum 5 MB)**, as well as entering a fictional `DEMO-` reference and confirming the demo declaration. The selected filename and byte count are recorded in the demo ledger and receipt, but the file **is not uploaded, saved in localStorage, or independently verified**. Reloading or closing the modal discards the selection. The attachment does not prove that a real payment occurred. Do not use genuine bank statements or documents containing sensitive personal information.

## v5.2 hero artwork
The dashboard hero now displays the supplied event-inspired Web3 for Social Good banner as a locally bundled WebP asset. The visible “Explore projects” area remains an actual clickable, keyboard-focusable navigation control over the banner. The rest of the donation, proof attachment, receipt, project, governance, and ledger demo is unchanged. The hero image is original illustrative artwork, not an official organizer banner.

## v5.3 donation receipt reliability patch

- The **Record proof & issue demo receipt** action now displays inline validation messages in the payment-proof step, with focus directed to missing inputs.
- Allows browsers that omit file MIME types for local `file://` documents, while still enforcing permitted filename extensions, declared MIME types (when available), and 5 MB maximum.
- Catches unexpected receipt errors and shows an actionable error instead of appearing to do nothing.
- If browser storage is blocked, the current session can continue; records may be lost on reload.
- Receipts and attachments remain fictional and are not external payment verification.

To test: open `index.html` → Projects & Donations → select project and amount → Review → Continue to payment proof → enter `DEMO-2026-0001` → attach a small sample PDF/JPG/PNG → check the simulation declaration → Record proof & issue demo receipt.

## v5.4 receipt-button fix
- Donation form displays inline, accessible errors for missing/invalid references, unsupported/missing files, files larger than 5 MB, unchecked simulation consent, and reused references.
- A selected file with an empty MIME type is accepted when its extension is an allowed PDF/JPG/PNG (some local browsers omit MIME metadata).
- The confirmation handler catches unexpected exceptions and reports them in the popup instead of appearing to do nothing.
- The confirmation button is guarded against repeat submissions while recording the demo receipt.
- Opening a new donation resets the proof step.
- This demo does not upload or verify real payment evidence.


## v5.5 image compatibility fix
Hero image converted from WebP to JPEG and HTML reference updated. Extract the entire ZIP with **Extract All** before opening `index.html` (do not open from ZIP preview or Windows Temp). Keep `assets` beside `index.html`.

## v5.6 portable image fix
The dashboard hero image is now embedded directly inside index.html as a data URI, rather than loaded from a separate assets file. The legacy CSS hero background is embedded as well. This prevents the broken-image symptom caused by missing or inaccessible relative assets when viewing an HTML file from a temporary ZIP folder. For best reliability, still use Extract All.

## v5.7 image fit
The banner uses width:100%, height:auto, and object-fit:contain. The containing hero no longer forces a 16:9 crop. The full image fits the available content width.

## v5.8 Explore Projects control
Replaced the invisible click region over the hero with a visibly labeled, keyboard-accessible Explore Projects button positioned within the banner. It retains the existing project navigation handler.

## v5.9 image click navigation
Removed the Explore Projects overlay button. The whole banner image is now a keyboard-accessible button that opens Projects & Donations. The image remains fully visible and responsive.

## v6.0 Live Sepolia smart-contract integration

**Contracts** (`contracts/src/AidChainEscrow.sol`)
- Added `rejectMilestone` — the reviewer can now send a milestone back to the NGO on-chain. The v5.x
  demo had a Reject button with no contract equivalent, so the simulated and on-chain workflows
  disagreed.
- Added `refund` plus per-donor `contributed` / `refunded` accounting and `available` / `refundable`
  views, so donors are no longer locked into a project whose milestones stall. Every release is now
  gated on `available()`, which subtracts refunds as well as payouts, so refunds cannot push the
  escrow below a committed release.
- A milestone under review can no longer be silently re-submitted, so a reviewer can never approve an
  evidence hash other than the one they were shown.
- Events are emitted before the external token transfer (checks-effects-interaction).
- 20 Foundry tests, all passing, plus a repeatable local `anvil` run (`.build/deploy_local.sh`) that
  drives the full lifecycle with distinct keys and holds 8 contract guards with their reason strings.

**Dashboard** (`index.html`)
- Testnet Lab rebuilt: `rejectMilestone` and `refund` wired up, live milestone state read from the
  contract (`milestoneStatus`), balances/gas/allowance readout, and a per-wallet refundable figure.
- On-chain receipts: donation, release and refund each produce a receipt only after the transaction
  is mined with status = success, carrying the tx hash, block, confirmations, gas used and an
  explorer link, downloadable as JSON.
- New **On-chain Audit** view: the ledger is built from contract events fetched over JSON-RPC
  (`eth_getLogs` + manual `parseLog`) with a configurable from-block, filterable by project,
  exportable to CSV, and
  worded so an empty result reads as "nothing found in this scan window", never as "no activity".
- Persistent mode chip in the top bar plus a sidebar footer that changes between Demo Mode and
  Blockchain Mode; the earlier footer permanently claimed "no real blockchain connection", which
  stopped being true the moment a wallet was connected.
- Deployed addresses auto-load from `deployments/sepolia.config.js` (now with one entry per
  supported network); manual entries are remembered in the browser and take precedence, and the
  panel states which source supplied the current values.
- Read failures are surfaced per metric ("Not readable this refresh: gas balance") instead of showing
  a stale or blank value.
- Network-aware since the browser QA run: Sepolia (11155111) and the local anvil chain (31337) are
  both supported and every label, explorer link and CSV filename follows the connected chain;
  anything else is refused at connect time. Three bugs found and fixed by that run: the mode chip
  printed a Promise instead of the wallet address, receipts printed the confirmations getter's
  source code instead of a count, and the audit sync threw on ethers v6's `queryFilter(null)`
  (now uses `getLogs` + manual parse, stable across ethers releases).

**Tooling and evidence**
- `.build/verify_code.py` — immutable-aware deployed-code verification for any RPC.
- `.build/deploy_local.sh` — deploy both contracts to a local anvil chain and drive the whole
  lifecycle (donate → evidence → reject → resubmit → approve → release → refund) with the guards
  checked as negative simulations. 49 checks, all passing.
- `.build/demo-wallet.js` — MetaMask-free EIP-1193 fallback for local demos: the dashboard talks to
  anvil (chain 31337) with four switchable dev accounts. Contains no private keys (anvil signs for
  its own unlocked accounts) and refuses anything but the local chain. Reloading the page removes
  it; not a substitute for the MetaMask path on Sepolia. Since v6.1 the Testnet Lab installs it
  automatically through the one-click demo panel, so no console snippet is needed.
- `.build/validate.py`, `.build/abi_check.py` — dashboard syntax/ID/nav checks and UI-ABI vs compiled
  ABI cross-check.
- `deployments/local-test.json` — addresses and transaction hashes from the local test deployment.
- `DEPLOY_SEPOLIA.md` — guided MetaMask → Sepolia → Remix → Etherscan verification walkthrough.
- `VERIFICATION_LOG.md` — what passed, what remains untested (notably: MetaMask's own popup flow,
  and anything on Sepolia).

## v6.1 One-click local blockchain demo

The Testnet Lab now opens with a **One-click local blockchain demo** panel that removes every
developer-tools step from the judge experience:

- On load it probes `127.0.0.1:8546` for a local anvil chain (chain id 31337) and says plainly
  whether one is running — "chain detected", "chain not found" (with the exact commands to start
  one), or "needs localhost" when the page was opened from `file://`.
- **Launch local blockchain demo** installs the built-in demo wallet with one click, connects it,
  validates the contracts configured in `deployments/sepolia.config.js`, and reveals a numbered
  walkthrough of the whole lifecycle: create project → donate → submit evidence → approve →
  release → refund → sync the audit ledger.
- The **Act as** role dropdown switches between the four demo accounts (deployer / NGO / reviewer /
  donor) and reconnects and re-validates automatically in one step — no console snippets, no manual
  Connect/Check clicks. The reviewer field is pre-filled with the reviewer account.
- A wallet that was already present is never hidden: the pre-existing `window.ethereum` is kept at
  `demoWallet.previous` and restorable with `demoWallet.restore()`.

Verified end-to-end in a browser on 2026-10-15 (section 8 of `VERIFICATION_LOG.md`): one click →
project #2 created by NGO → 300 dUSDC donated by donor → milestone 0 approved by reviewer and
released (250 dUSDC) → donor refunded 50 dUSDC → audit sync found all 17 contract events with 0
undecodable. On-chain accounting reconciled exactly (raised 300 = released 250 + refunded 50,
escrow balance 0 dUSDC) and the console showed zero errors. The separation of demo tokens from real
funds is unchanged: the demo wallet, like the dashboard, refuses any chain other than 31337 or
Sepolia, and dUSDC remains freely mintable and valueless. A public website still cannot reach a
visitor's localhost anvil; for remote judges use MetaMask + Sepolia per `DEPLOY_SEPOLIA.md`.
