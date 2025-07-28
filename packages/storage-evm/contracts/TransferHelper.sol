// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IERC20 {
  function transfer(address recipient, uint256 amount) external returns (bool);
}

contract TransferHelper {
  event TransferExecuted(
    address indexed token,
    address indexed to,
    uint256 amount
  );

  function transferToken(address token, address to, uint256 amount) external {
    require(token.code.length > 0, 'Invalid token address');
    require(IERC20(token).transfer(to, amount), 'Transfer failed');
    emit TransferExecuted(token, to, amount);
  }
}
