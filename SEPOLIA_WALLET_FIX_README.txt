XNode AidChain v5.9 wallet patch

This ZIP contains the uploaded v5.9 project, not v6.1.

Changes:
- Prefilled user-supplied Sepolia escrow and dUSDC contract addresses.
- Wallet connection requests Sepolia (chain 11155111) through wallet_switchEthereumChain.
- Prefers MetaMask when window.ethereum.providers contains multiple providers.
- Clears stale contract/wallet objects when chain or account changes.
- Refuses to sign transactions unless provider is on Sepolia.

Run: unzip, serve the folder containing index.html with a local HTTP server (for example python -m http.server 8080), open http://localhost:8080/, select Testnet Lab, Connect wallet, Validate contracts.

Not verified against the live Sepolia contracts or in a browser. The existing contract ABI may differ from the deployed version. Never enter private keys into the app.
