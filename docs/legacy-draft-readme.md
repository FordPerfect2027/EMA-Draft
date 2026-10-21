# EMADATA (EMA) — Provisional Relaunch Draft

**Status:** Draft / Not Audited / Not Deployed  
**Intended Network:** Arbitrum One  
**Maintainer:** 0628DAO

This repository contains the provisional public materials for a future EMADATA (EMA) relaunch, including an ERC-20 smart contract draft and a separated dApp architecture. EMA is being designed as the foundational token for the 0628BET Prediction Layer within the 0628DAO ecosystem.

The repository is public to make the pre-deployment design and validation process transparent. No new official EMA contract has been deployed from this repository. All code currently published here is an unaudited draft.

## Current Provisional Specifications

| Item | Specification |
|---|---|
| Token Name | EMADATA |
| Symbol | EMA |
| Network | Arbitrum One |
| Standard | ERC-20 |
| Initial Supply | 777,000,000 EMA |
| Decimals | 18 |
| Transfer / Buy / Sell Tax | 0% |
| Rewards / Reflection | None |
| Additional Minting | None |
| Burn | Self-burn by the token holder only |
| Permit | EIP-2612 |
| Owner / Admin / Pause / Upgrade / Proxy | None |

## Relationship to the Existing EMA Contract

Existing EMA reference contract:

`0x61b397ade3ed9c1511abff20a3a4701a3a52ecdc`

The code in this repository does not modify the existing contract. Any future deployment from this draft will receive a different contract address. Migration and distribution criteria for existing EMA holders have not yet been finalized.

## Position within 0628DAO

0628DAO is not a token name. It is a governance concept that combines multiple specialized intelligences with final human responsibility. EMA is one of the systems governed under that concept; EMA is not 0628DAO itself.

This repository contains only the new EMA base-token draft and its dApp integration principles. The 0628BET application, prediction-market logic, frontend, and governance execution mechanisms will be designed, tested, and published as separate contracts and development stages.

## Design Principles

- Keep the base token implementation small and standards-based
- Place dApp-specific functions in separate protocol contracts
- Connect through `IERC20` and `IERC20Permit`
- Use OpenZeppelin `SafeERC20` for token transfers
- Do not embed taxes, reflection, automatic distribution, or DEX-pair detection in the base token
- Do not provide any post-deployment minting path

## Repository Contents

- `EMA_Draft.sol` — Provisional ERC-20 smart contract
- `EMA_dApp_Architecture_UTF8_BOM.txt` — dApp integration principles and pre-deployment considerations

## Items to Complete Before Deployment

- Confirm the wallet receiving the initial supply
- Define migration and distribution criteria for existing EMA holders
- Decide whether any fixed restrictions belong in the base token or the dApp layer
- Determine whether `ERC20Votes` is required
- Test on Arbitrum Sepolia
- Complete an independent security audit
- Publish the official deployment address

## Important Notices

- The code is unaudited and undeployed.
- The reference address belongs to the existing EMA contract and is not the deployment address of this draft.
- This repository is not an offer to sell tokens, an investment solicitation, or a promise of profit or price appreciation.
- Before connecting a wallet or transferring tokens, verify the network and contract address through future official announcements.
- Specifications may change following testing, auditing, or legal review.

© 0628DAO. Development record for technical review.

