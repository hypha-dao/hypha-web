// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './interfaces/IEnergyDistribution.sol';

/**
 * @title EnergySettlement
 * @dev Contract for settling negative balances in the Energy Distribution system using EURC tokens
 * Users can pay off their debt or pay for others using EURC stablecoin
 */
contract EnergySettlement is Ownable, ReentrancyGuard {
  // EURC token contract (Euro Coin stablecoin)
  IERC20 public immutable eurcToken;

  // Energy Distribution contract
  IEnergyDistribution public immutable energyDistribution;

  // Address where EURC payments are forwarded to
  address public paymentRecipient;

  // Events
  event DebtSettled(
    address indexed payer,
    address indexed debtor,
    uint256 eurcAmount,
    int256 previousBalance,
    int256 newBalance
  );

  event PaymentRecipientUpdated(
    address indexed oldRecipient,
    address indexed newRecipient
  );

  constructor(
    address _eurcToken,
    address _energyDistribution,
    address _paymentRecipient,
    address _owner
  ) Ownable(_owner) {
    require(_eurcToken != address(0), 'Invalid EURC token address');
    require(
      _energyDistribution != address(0),
      'Invalid Energy Distribution address'
    );
    require(
      _paymentRecipient != address(0),
      'Invalid payment recipient address'
    );

    eurcToken = IERC20(_eurcToken);
    energyDistribution = IEnergyDistribution(_energyDistribution);
    paymentRecipient = _paymentRecipient;
  }

  /**
   * @dev Settle negative balance for a specific user using EURC tokens
   * @param debtor Address of the user whose debt to settle
   * @param eurcAmount Amount of EURC tokens to use for settlement (in wei, 6 decimals for EURC)
   */
  function settleDebt(
    address debtor,
    uint256 eurcAmount
  ) external nonReentrant {
    require(debtor != address(0), 'Invalid debtor address');
    require(eurcAmount > 0, 'Amount must be greater than 0');

    // Get current balance of the debtor
    (int256 currentBalance, ) = energyDistribution.getCashCreditBalance(debtor);

    // Only allow settlement if balance is negative (debt exists)
    require(currentBalance < 0, 'No debt to settle');

    // Convert EURC amount (6 decimals) to energy system cents (2 decimals)
    // EURC has 6 decimals, energy system uses cents (2 decimals)
    // So 1 EURC (1e6) = 100 cents in energy system
    uint256 energySystemAmount = eurcAmount / 10000; // Convert from 6 decimals to 2 decimals
    require(energySystemAmount > 0, 'Amount too small for settlement');

    // Calculate how much debt can actually be settled
    uint256 debtAmount = uint256(-currentBalance); // Convert negative balance to positive debt
    uint256 settlementAmount = energySystemAmount > debtAmount
      ? debtAmount
      : energySystemAmount;
    uint256 requiredEurc = settlementAmount * 10000; // Convert back to EURC decimals

    // Transfer EURC from payer to this contract
    require(
      eurcToken.transferFrom(msg.sender, address(this), requiredEurc),
      'EURC transfer failed'
    );

    // Forward EURC to payment recipient
    require(
      eurcToken.transfer(paymentRecipient, requiredEurc),
      'EURC forward failed'
    );

    // Settle the debt in the energy distribution system
    int256 previousBalance = currentBalance;
    energyDistribution.settleDebt(debtor, int256(settlementAmount));
    (int256 newBalance, ) = energyDistribution.getCashCreditBalance(debtor);

    emit DebtSettled(
      msg.sender,
      debtor,
      requiredEurc,
      previousBalance,
      newBalance
    );
  }

  /**
   * @dev Settle own debt using EURC tokens
   * @param eurcAmount Amount of EURC tokens to use for settlement
   */
  function settleOwnDebt(uint256 eurcAmount) external nonReentrant {
    require(eurcAmount > 0, 'Amount must be greater than 0');

    // Get current balance of the caller
    (int256 currentBalance, ) = energyDistribution.getCashCreditBalance(msg.sender);

    // Only allow settlement if balance is negative (debt exists)
    require(currentBalance < 0, 'No debt to settle');

    // Convert EURC amount (6 decimals) to energy system cents (2 decimals)
    uint256 energySystemAmount = eurcAmount / 10000;
    require(energySystemAmount > 0, 'Amount too small for settlement');

    // Calculate how much debt can actually be settled
    uint256 debtAmount = uint256(-currentBalance);
    uint256 settlementAmount = energySystemAmount > debtAmount
      ? debtAmount
      : energySystemAmount;
    uint256 requiredEurc = settlementAmount * 10000;

    // Transfer EURC from caller to this contract
    require(
      eurcToken.transferFrom(msg.sender, address(this), requiredEurc),
      'EURC transfer failed'
    );

    // Forward EURC to payment recipient
    require(
      eurcToken.transfer(paymentRecipient, requiredEurc),
      'EURC forward failed'
    );

    // Settle the debt in the energy distribution system
    int256 previousBalance = currentBalance;
    energyDistribution.settleDebt(msg.sender, int256(settlementAmount));
    (int256 newBalance, ) = energyDistribution.getCashCreditBalance(msg.sender);

    emit DebtSettled(
      msg.sender,
      msg.sender,
      requiredEurc,
      previousBalance,
      newBalance
    );
  }

  /**
   * @dev Update the payment recipient address (only owner)
   * @param newRecipient New address to receive EURC payments
   */
  function setPaymentRecipient(address newRecipient) external onlyOwner {
    require(newRecipient != address(0), 'Invalid recipient address');

    address oldRecipient = paymentRecipient;
    paymentRecipient = newRecipient;

    emit PaymentRecipientUpdated(oldRecipient, newRecipient);
  }

  /**
   * @dev Get the current debt amount for a user in EURC terms
   * @param debtor Address to check debt for
   * @return eurcDebt Amount of EURC needed to settle the debt (0 if no debt)
   */
  function getDebtInEurc(
    address debtor
  ) external view returns (uint256 eurcDebt) {
    (int256 balance, ) = energyDistribution.getCashCreditBalance(debtor);

    if (balance >= 0) {
      return 0; // No debt
    }

    // Convert negative balance (cents) to EURC amount
    uint256 debtInCents = uint256(-balance);
    eurcDebt = debtInCents * 10000; // Convert from 2 decimals to 6 decimals
  }

  /**
   * @dev Emergency function to recover any stuck tokens (only owner)
   * @param token Token address to recover
   * @param amount Amount to recover
   */
  function emergencyRecover(address token, uint256 amount) external onlyOwner {
    require(token != address(0), 'Invalid token address');
    require(amount > 0, 'Amount must be greater than 0');

    IERC20(token).transfer(owner(), amount);
  }
}
