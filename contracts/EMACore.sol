// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title EMA CORE
/// @notice Fixed-supply EMA token. There is no administrator mint function,
///         transfer tax, external-token dependency, blacklist, pause, or upgrade hook.
/// @dev A buyback executor can acquire EMA, hold it, and call burn() to reduce
///      totalSupply. No account can burn tokens belonging to another account
///      unless the holder has explicitly granted an ERC-20 allowance.
contract EMACore is ERC20, ERC20Burnable, ERC20Permit {
    error EMACoreZeroAddress();

    uint256 public constant INITIAL_SUPPLY_UNITS = 777_000_000;
    uint256 public constant INITIAL_SUPPLY = INITIAL_SUPPLY_UNITS * 10 ** 18;

    /// @param initialHolder Address receiving the complete initial supply.
    constructor(address initialHolder)
        ERC20("EMA CORE", "EMA")
        ERC20Permit("EMA CORE")
    {
        if (initialHolder == address(0)) revert EMACoreZeroAddress();
        _mint(initialHolder, INITIAL_SUPPLY);
    }
}


