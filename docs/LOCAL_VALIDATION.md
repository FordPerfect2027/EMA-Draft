# Local validation — EMA CORE

Status: PASS locally; not deployed; unaudited.

- Confirmed name: EMA CORE
- Confirmed symbol: EMA
- Initial supply kept unchanged from the prior approved Draft: 777,000,000
- Decimals: 18
- Base source: 0628DAO/DAT @ 0aa811b9c7607d7af6129a943cca8be72974a59b
- Toolchain: Node.js v24.19.0; npm 11.9.0; Solidity 0.8.34; default EVM target Osaka
- Dependencies: pinned DATCORE package-lock, installed using npm ci --ignore-scripts
- npm run check: PASS (Solidity compilation, 25 contract tests, TypeScript type-check)
- Negative deployment checks on local hardhatOp: missing DEPLOY_APPROVAL rejected;
  missing INITIAL_HOLDER rejected before network connection or transaction.

No private key was requested or used. No Base Sepolia or Base Mainnet transaction
was submitted. Existing tokens, DATCORE, and liquidity positions were not changed.

The initial-supply constants are fixed; totalSupply can decrease through approved
burn functions. No additional minting route exists after construction.

These local checks do not constitute an independent audit or a live Base Sepolia
validation. Before a public testnet transaction, reconfirm the recipient wallet,
chain ID, transaction details, chain compatibility and explicit authorization.

