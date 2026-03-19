const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("ethers");

module.exports = buildModule("PolkaSentinelModule", (m) => {
  // 1. Deploy GuardianProxy (sentinelEngine = address(0) for Solidity-only mode)
  const guardian = m.contract("GuardianProxy", [ethers.ZeroAddress]);

  // 2. Deploy ProtectedVault with GuardianProxy address
  const protectedVault = m.contract("ProtectedVault", [guardian]);

  // 3. Deploy VulnerableVault (no protection)
  const vulnerableVault = m.contract("VulnerableVault");

  // 4. Deploy ReentrancyAttacker
  const attacker = m.contract("ReentrancyAttacker");

  // 5. Register ProtectedVault in GuardianProxy
  m.call(guardian, "registerProtocol", [protectedVault]);

  return { guardian, protectedVault, vulnerableVault, attacker };
});
