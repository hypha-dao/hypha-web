// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IERC20 {
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool);
}

contract TransferHelper {
  event TransferExecuted(
    address indexed token,
    address indexed to,
    uint256 amount
  );

  function transferToken(address token, address to, uint256 amount) external {
    require(token.code.length > 0, 'Invalid token address');
    require(
      IERC20(token).transferFrom(msg.sender, to, amount),
      'Transfer failed'
    );
    emit TransferExecuted(token, to, amount);
  }
}
