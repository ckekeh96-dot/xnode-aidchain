# XNode AidChain v6.1 — deploying to Ethereum Sepolia (guided walkthrough)

You deploy from **your own browser with Remix + MetaMask**, so your testnet private key never
leaves your wallet and never appears in a file or a chat message. Everything that could be
verified mechanically was already verified locally — see `VERIFICATION_LOG.md`.

Estimated time: 25–40 minutes, most of it waiting on faucet approval.

---

## What you will end up with

| Item | Where it goes |
|---|---|
| `MockUSDC` (symbol **dUSDC**, valueless demo token) address | `deployments/sepolia.config.js` → `token` |
| `AidChainEscrow` address | `deployments/sepolia.config.js` → `escrow` |
| Escrow deployment block number | `deployments/sepolia.config.js` → `fromBlock` |
| Verified source on Sepolia Etherscan (judges can read the Solidity) | public, linkable |

**Never** use real USDC, real funds, or your main wallet on testnet.

---

## Part 1 — MetaMask

1. Install the official MetaMask browser extension from `https://metamask.io/download/` (verify
   the store listing publisher is "MetaMask").
2. Create a **brand-new burner wallet** for this demo. Choose "Create a wallet" → "No thanks, I
   do not want to import".
3. Write the seed phrase on paper. Do **not** paste it into any file in this project, into Remix,
   into a chat, or into any website.
4. Name this account `AidChain-NGO`.

> The demo uses three roles. Because permissions are enforced by wallet address, you need at least
> two *different* addresses: the NGO address and the reviewer address. Add a second account in
> MetaMask ("Add hardware wallet / Add account" → "Create a new account") and name it `AidChain-Reviewer`.

## Part 2 — Sepolia network

MetaMask ships with Sepolia enabled. If it is missing:

1. MetaMask → network dropdown → "Add network".
2. Click "Add Sepolia test network" if offered, otherwise enter:
   - Network name: `Ethereum Sepolia`
   - RPC URL: `https://ethereum-sepolia-rpc.publicnode.com`
   - Chain ID: `11155111`
   - Symbol: `ETH`
   - Block explorer: `https://sepolia.etherscan.io`
3. Select **Ethereum Sepolia** as the active network.

## Part 3 — Test ETH for gas

1. Copy your `AidChain-NGO` address.
2. Claim test ETH from a public Sepolia faucet, for example `https://faucets.chain.link/sepolia`
   (requires the wallet to hold a small amount of mainnet ETH for the proof-of-personhood check) or
   Google Cloud's `https://cloud.google.com/get-sepolia`. If both are blocked from your network,
   claim in your own browser session — automated claiming from this machine is unreliable.
3. Confirm the balance is non-zero in MetaMask. Target roughly **0.5–1 Sepolia ETH** — you will
   send about a dozen transactions.
4. Also fund `AidChain-Reviewer` with a little ETH (send 0.2 test ETH from the NGO account) so the
   reviewer can pay gas for approve/reject transactions.

## Part 4 — Compile in Remix with the *same* settings I tested

Open `https://remix.ethereum.org` and reproduce these compiler settings, otherwise the deployed
bytecode will not match the artifacts described in `VERIFICATION_LOG.md`:

1. Left sidebar → **Solidity compiler** (second icon).
2. Compiler version: **`0.8.24`** — Remix lists it as `0.8.24+commit.e11b9ed9`, the exact build
   the tested artifacts were compiled with (type `0.8.24` in the box if it is not in the list).
3. Click the **Settings (gear)** icon in that panel.
4. Turn **Optimization: ON**, set **runs = `200`**.
5. Set **EVM version: `cancun`** explicitly. The tested artifacts were compiled with `cancun`;
   Remix's default for 0.8.24 may be `shanghai`, which changes the deployed code's fingerprint.
6. In the **File Exploration** panel, create folder `src` (not `contracts/src`) and add these two
   files from this project (open them in Explorer and paste):
   - `src/MockUSDC.sol`
   - `src/AidChainEscrow.sol`
   The source path is recorded inside the deployed code's compiler metadata — the verified
   artifacts carry `src/…`, so keep it exact for a byte-identical match in Part 9.
7. Click **Compile MockUSDC.sol**, then **Compile AidChainEscrow.sol**. Both must be green with no
   errors.

## Part 5 — Deploy MockUSDC

1. Left sidebar → **Deploy & Run Transactions** (third icon).
2. Environment: **Injected Provider - MetaMask**. Remix should now show `Network: Sepolia (11155111)`
   and your NGO address. If it shows "VM" instead, MetaMask is not connected to Remix — click the
   account in MetaMask, then "Connect" in Remix's popup.
3. Contract dropdown: **MockUSDC**.
4. Constructor Arguments: **leave empty** (the token takes no arguments).
5. Click **Transact** → approve in MetaMask → wait for the receipt.
6. Under "Deployed Contracts" in the bottom of the panel, copy the token address (looks like
   `0x1a2b…`). Paste it into a text file for the next part — this value is the escrow's only
   constructor argument.

## Part 6 — Deploy AidChainEscrow

1. Contract dropdown: switch to **AidChainEscrow**.
2. Constructor Arguments: paste the MockUSDC address, e.g. `0x1a2b3C…`.
   One argument, on one line. Do not add quotes or brackets.
3. Click **Transact** → approve in MetaMask.
4. Copy the escrow address.

Sanity check inside Remix (expand the deployed escrow contract): click **`token()`** — the address
returned must equal the MockUSDC address from Part 5. The dashboard also refuses to proceed if this
does not match.

## Part 7 — Record the deployment block

On `https://sepolia.etherscan.io`, look up your escrow address → the "Txn" tab → open the
`Contract Creation` transaction → note the **Block number**. You need it for the audit scan window.

## Part 8 — Verify the source on Sepolia Etherscan (this is what judges click)

1. In Remix, open the **Plugin Manager** (grid icon), enable **Verification & Publish**, go back to
   the plugin.
2. Select provider **Etherscan**, choose network **Sepolia** if asked.
3. Verify **MockUSDC** first, then **AidChainEscrow**. Remix submits the standard-json input plus the
   constructor argument automatically; no API key is required for Etherscan's browser-based
   verification.
4. Each shows "Verified" on `sepolia.etherscan.io/address/<addr>#code`, with the Solidity readable
   and a matching bytecode hash.

## Part 9 — Prove the live code is the code that was tested

Run this from the project folder (Foundry is already installed at `~/.foundry/bin`):

```bash
python .build/verify_code.py <ESCROW_ADDRESS> <TOKEN_ADDRESS> https://ethereum-sepolia-rpc.publicnode.com
```

It prints a verdict per contract:

- **`MATCH (exact)`** — the live code is byte-identical to the tested build, compiler metadata
  included. This is what the Part 4 settings (path `src/…`, EVM version `cancun`) produce.
- **`MATCH (core code)`** — the logic bytes are identical, but the compiler-metadata trailer
  differs (Remix source path / EVM version / optimizer details). The known logic is verified, but
  recompile with the Part 4 settings for a byte-identical match.
- **`MISMATCH`** — the logic bytes differ. **Stop and do not demo** — different code is live at
  that address than the code that passed the tests.

**Why the escrow needs special handling:** `token` is declared `immutable`, so the compiler writes
the token address into the runtime bytecode. A naive hash comparison of the artifact against the
chain will always differ for that contract. This checker fills the placeholder first, then
compares, so a real substitution of code still fails loudly.

## Part 10 — File the addresses into the dashboard

1. Open `deployments/sepolia.config.js` in Notepad (in Explorer:
   `Documents → Qoder → 2026-10-15 → 7f4ad8f8 → aidchain-v6 → deployments`).
2. Fill `escrow`, `token`, `fromBlock`, `deployedAt`.
3. Save. The Testnet Lab now prefills both addresses for anyone who opens the demo, and states where
   they came from.

## Part 11 — Run the demo journey on-chain

```bash
cd aidchain-v6
python -m http.server 8080
```

Open `http://localhost:8080` (a local server is required — the adapter loads ethers.js from a CDN),
then go to **Testnet Lab**:

1. **Connect wallet** (NGO account) → **Validate contracts** → the top bar chip flips to
   *Blockchain mode · Sepolia · 0x…*.
2. **Mint demo tokens** (e.g. 1000) → **Approve & donate** → an on-chain receipt opens only after the
   donation lands in a mined block with status = success. Save the JSON receipt.
3. Switch MetaMask to **AidChain-NGO**, create the project (reviewer = the `AidChain-Reviewer` address).
4. Submit evidence, then switch MetaMask to **AidChain-Reviewer** and **Approve** — or **Reject**,
   which returns the milestone to the NGO instead of paying it.
5. Switch back to the NGO and **Release funds**; the NGO wallet's dUSDC balance rises by the
   milestone allocation.
6. Open **On-chain Audit** → **Sync events from chain**: the ledger is built from contract events read
   from a node, not from browser storage. Export the CSV for judges.
7. Optional but strong for judging: donate from a second wallet, show **Read refundable**, and claim a
   **refund** to demonstrate donors are not locked in.

## Part 12 — Known limits to state honestly to judges

- Testnet only, unaudited, valueless demo token. No real funds.
- Reviewer independence is address-based only; it does not prove real-world identity and does not
  stop NGO/reviewer collusion.
- Refunds are first-come: when several donors refund the same project, whoever claims first is served
  first. The escrow can still never be over-withdrawn (`available()` gates every release), but a
  production design would use per-donor pro-rata or a deadline-based window.
- No dispute resolution, pause, upgrade, or oracle. No off-chain file storage; evidence is a hash of a
  public, non-sensitive reference.
- The demo's simulated payment-proof upload is not verification; in Blockchain Mode the confirmed
  transaction is the proof.
