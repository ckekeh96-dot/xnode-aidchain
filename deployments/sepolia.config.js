// AidChain v6.0 — deployed Sepolia addresses.
// The Testnet Lab reads this file first; values you type into the page are remembered in this
// browser and take precedence over what is filed here.
//
// Fill these in after you deploy (see DEPLOY_SEPOLIA.md). Do not put private keys or seed
// phrases in this file — it ships inside the demo zip and judges can read it.
window.AIDCHAIN_DEPLOYMENT = {
  network: 'Ethereum Sepolia (chain id 11155111)',

  // AidChainEscrow deployment address
  escrow: '0x69A1857f7baC724637D157d9a0E527a5c76De868',

  // MockUSDC (dUSDC) deployment address — must be the token passed to the escrow constructor
  token: '0x459324ca0a4BFe081497Cf4578267d8AD22646FC',

  // Block the pair first appeared in (token 11922882, escrow 11922896), so the audit ledger
  // scans from the first possible transaction instead of only the last 5,000 blocks.
  fromBlock: 11922882,

  deployedAt: '2026-10-15',
  escrowVerifiedOn: '',      // e.g. '2026-10-20 on sepolia.etherscan.io'
  compiler: 'solc 0.8.24, optimizer enabled, runs 200',

  // Local anvil test chain (chain id 31337). These addresses exist only while a local anvil
  // node is running AND the contracts have been deployed to it with `.build/deploy_local.sh`;
  // restarting anvil and redeploying gives the same addresses back, because anvil is
  // deterministic. They are NOT valid on Sepolia and are ignored there.
  local: {
    network: 'anvil local test chain (chain id 31337)',
    escrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    fromBlock: 0,
    deployedAt: '2026-10-15',
  },
};
