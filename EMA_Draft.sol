// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title EMADATA (EMA) — Provisional Relaunch Draft
 * @notice Arbitrum One ERC-20 draft for a future EMA relaunch.
 * @dev This is new deployment code. It does not modify the existing EMA
 *      contract at 0x61b397ade3ed9c1511abff20a3a4701a3a52ecdc.
 *
 * Preserved EMA information and provisional policy:
 * - Token name: EMADATA
 * - Token symbol: EMA
 * - Fixed initial supply: 777,000,000 EMA
 * - Decimals: 18 (OpenZeppelin ERC20 default)
 * - Transfer / buy / sell tax: 0%
 * - No rewards or reflection
 * - No later minting
 * - Holders may burn only their own tokens
 * - EIP-2612 Permit support
 * - No owner, administrator, pause, upgrade or proxy authority
 * - dApp-specific logic remains in separate protocol contracts
 *
 * Not audited. Not deployed.
 */
contract EMA_Draft is ERC20, ERC20Permit {
    uint256 public constant INITIAL_SUPPLY_UNITS = 777_000_000;
    uint256 public constant INITIAL_SUPPLY = INITIAL_SUPPLY_UNITS * 10 ** 18;

    error ZeroInitialRecipient();

    constructor(address initialRecipient)
        ERC20("EMADATA", "EMA")
        ERC20Permit("EMADATA")
    {
        if (initialRecipient == address(0)) revert ZeroInitialRecipient();

        // The fixed supply is created once at deployment. No minting route
        // exists after construction.
        _mint(initialRecipient, INITIAL_SUPPLY);
    }

    /**
     * @notice Permanently destroys EMA owned by the caller.
     * @dev No burnFrom function is provided, so nobody can burn another
     *      holder's EMA, including through an allowance.
     */
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
}
