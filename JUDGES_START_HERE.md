# XNode AidChain — Judge Quick Start

**Web3 for Social Good Hackathon 2026 | v5.9 demo + Sepolia wallet patch**

XNode AidChain explores transparent humanitarian giving: donors can explore projects, record **simulated** contributions, inspect a local audit history, and review milestone evidence and approvals. An optional **Ethereum Sepolia Testnet Lab** demonstrates blockchain transactions using **valueless demo dUSDC**.

> **Start here:** This archive is the **v5.9 package**, not the separately developed v6.1 local-Anvil demo. The offline showcase and on-chain Testnet Lab are distinct experiences. No real donations are processed.

## 1. Fastest judge experience — no wallet (2 minutes)

1. Download and **extract the whole ZIP** (do not preview HTML inside the ZIP).
2. Open `index.html` in a modern browser (Chrome or Edge).
3. Click the large hero banner to open **Projects & Donations**.
4. Browse projects; choose one and begin a demo donation.
5. Follow the prompts: enter a fictional reference such as `DEMO-JUDGE-001`, attach a small **sample/redacted** PDF/JPG/PNG (up to 5 MB), and check the simulation declaration.
6. Record the proof to issue a **simulated receipt**. Review the dashboard, governance/milestones, and local ledger.

**Important:** No money moves in this mode. Attachments are not uploaded or validated as payment; only file name and size are recorded in the local demo ledger. Browser storage can be cleared or reset.

## 2. Optional live Sepolia blockchain lab (5–10 minutes, wallet required)

### Requirements
- Chrome or Edge with MetaMask enabled; MetaMask unlocked and **Sepolia** selected.
- Internet access (the Testnet Lab loads ethers.js from a CDN).
- Some **Sepolia test ETH** for transaction gas. Sepolia ETH and dUSDC have no monetary value.
- Python 3 (or another static HTTP server).

### Start the site
Open a terminal **inside the folder containing `index.html`**, then run:

```bash
python -m http.server 8080
```

Open **http://localhost:8080/**, then navigate to **Testnet Lab**. If port 8080 is in use, stop the other server first or choose another port and use its matching URL. **Do not use `file://` for wallet testing.**

### Deployed Sepolia contract addresses (user-provided; not independently verified)

| Contract | Address |
|---|---|
| Demo dUSDC token | `0x459324ca0a4BFe081497Cf4578267d8AD22646FC` |
| AidChain escrow | `0x69A1857f7baC724637D157d9a0E527a5c76De868` |

Explore the addresses on [Sepolia Etherscan](https://sepolia.etherscan.io/). The interface is prefilled with these addresses; confirm them before signing.

### Connect and validate
1. In MetaMask, select **Sepolia Test Network**. Chain ID is `11155111` (hex `0xaa36a7`).
2. In **Testnet Lab**, click **Connect wallet**. If prompted to switch to Sepolia, review and approve the network switch.
3. Click **Validate contracts**. Proceed only if both contracts validate.
4. Click **Refresh balances** to see the connected wallet's test-token balance.
5. If the Lab provides mint, project, donation, evidence, review, and release controls, follow the UI instructions. Different actions require **different wallet roles**: donor, NGO, and independent reviewer. Do not expect one wallet to complete every role.
6. Confirm transactions and events using their transaction hashes on Sepolia Etherscan.

**Do not send mainnet ETH, genuine USDC, or any valuable tokens.** The application intentionally blocks mainnet signing.

## 3. Suggested five-minute judging walkthrough

| Time | What to show | What it demonstrates |
|---|---|---|
| 0:00–0:45 | Landing page and Projects & Donations | Humanitarian use case and donor experience |
| 0:45–1:45 | Simulated donation and required proof flow | Clear donor UX and explicit simulation disclosure |
| 1:45–2:30 | Demo receipt and ledger | Traceability of recorded demo activity |
| 2:30–3:30 | Milestone/evidence/reviewer views | Accountability workflow and governance concept |
| 3:30–5:00 | Testnet Lab: connect, validate, inspect Etherscan | Distinction between browser simulation and on-chain actions |

If Sepolia or MetaMask is unavailable, **show the offline walkthrough** and present Etherscan links as supplemental evidence only; do not claim a transaction was made during the demo.

## 4. Troubleshooting

**“Your wallet is on chain 1”** — The detected wallet provider is on Ethereum Mainnet. Select Sepolia in the wallet, reload, and reconnect. If MetaMask shows Sepolia but the app still sees chain 1, check for multiple installed wallet extensions/providers. Never bypass the mainnet safety gate.

**“No injected wallet found”** — Enable/unlock MetaMask in the same browser profile and access the app at `http://localhost:8080/`, not `file://`.

**Connected to Anvil / account `0xf39F…`** — You are in a local development wallet, not Sepolia. This v5.9 archive is intended to use MetaMask for the Sepolia lab; do not mix local and Sepolia addresses.

**Validate contracts fails** — Check Sepolia chain ID, exact contract addresses, available deployed bytecode, and whether the deployed contract ABI matches the frontend's expected ABI. The addresses in this archive were supplied by the project owner; successful live validation has **not** been independently established.

**Mint or donate fails** — Check Sepolia test ETH for gas, the selected wallet's permissions, token approvals, and the transaction error. A donor, NGO, and reviewer may need distinct accounts.

**Port 8080 displays the wrong version** — Stop the previous local server and run the server from this extracted package's `index.html` directory; hard-refresh the browser.

## 5. Technical structure

- `index.html`: interactive frontend, including local showcase and optional Sepolia lab.
- `contracts/src/MockUSDC.sol`: mintable, valueless test token prototype.
- `contracts/src/AidChainEscrow.sol`: prototype project escrow and milestone workflow.
- `contracts/test/AidChainEscrow.t.sol`: Foundry unit tests.
- `HACKATHON_PROPOSAL.md`: product motivation and hackathon proposal.
- `README.md`: project history and detailed version notes.

Optional developer commands from `contracts/`:

```bash
forge build
forge test -vv
```

The Solidity code is a **prototype, not audited or production-ready**. The included v5.9 contract documentation warns that refunds are not implemented in this contract version. The browser-local showcase can display refund concepts, but that must **not** be represented as on-chain refund support in this package. Browser-local impact totals are not automatically reconciled to Sepolia.

## 6. Safety, privacy and evidence limitations

- No mainnet usage, no real money, no production donations.
- Do not upload genuine bank records or sensitive beneficiary data.
- A sample attachment is **not** independently authenticated payment proof.
- Demo receipts and local audit history are simulated and editable through browser storage, not blockchain consensus.
- On-chain transaction records can be independently inspected on Sepolia, **if** the relevant transactions have been executed and verified.
- Reviewer separation is wallet-address based, not proof of real-world independence.

**Judge note:** Evaluate the offline UI and the optional testnet demonstration as two separate components. This guide does not claim that the supplied Sepolia addresses or all browser actions have passed live end-to-end QA.
