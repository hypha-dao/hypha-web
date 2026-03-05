// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ITokenExtension
 * @dev Interface for SpaceToken extensions. Extensions are separate contracts
 *      that the token calls during transfers/mints. Each extension has its own
 *      storage and can call back to the token via extensionMint/extensionBurn.
 */
interface ITokenExtension {
  /// @dev Called by the token before the ERC20 _transfer.
  function beforeTransfer(
    address from,
    address to,
    uint256 amount
  ) external;

  /// @dev Called by the token after the ERC20 _transfer.
  function afterTransfer(
    address from,
    address to,
    uint256 amount
  ) external;

  /// @dev Called by the token before a mint.
  function beforeMint(address to, uint256 amount) external;

  /// @dev Called by the token during initialize to register itself.
  function setToken(address _token) external;
}

/**
 * @title IBalanceOfModifier
 * @dev Optional interface for extensions that modify balanceOf (e.g., decay).
 *      Only ONE extension can be the balanceOfModifier per token.
 */
interface IBalanceOfModifier {
  function adjustedBalanceOf(
    address account,
    uint256 rawBalance
  ) external view returns (uint256);
}

/**
 * @title ISpaceTokenBase
 * @dev Interface that extensions use to call back into the token.
 */
interface ISpaceTokenBase {
  function extensionMint(address to, uint256 amount) external;

  function extensionBurn(address from, uint256 amount) external;

  function rawBalanceOf(address account) external view returns (uint256);

  function executor() external view returns (address);

  function spaceId() external view returns (uint256);

  function spacesContract() external view returns (address);

  function archived() external view returns (bool);

  function balanceOf(address account) external view returns (uint256);
}
