const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         PolkaSentinel — Deployment Script            ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Network:  ${network}`);
  console.log(`║  Deployer: ${deployer.address}`);
  console.log(`║  Balance:  ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 1. Deploy GuardianProxy (Solidity fallback mode — sentinelEngine = address(0))
  console.log("1/5 Deploying GuardianProxy...");
  const GuardianProxy = await hre.ethers.getContractFactory("GuardianProxy");
  const guardian = await GuardianProxy.deploy(hre.ethers.ZeroAddress);
  await guardian.waitForDeployment();
  const guardianAddr = await guardian.getAddress();
  console.log(`    ✅ GuardianProxy: ${guardianAddr}`);

  // 2. Deploy ProtectedVault
  console.log("2/5 Deploying ProtectedVault...");
  const ProtectedVault = await hre.ethers.getContractFactory("ProtectedVault");
  const protectedVault = await ProtectedVault.deploy(guardianAddr);
  await protectedVault.waitForDeployment();
  const protectedAddr = await protectedVault.getAddress();
  console.log(`    ✅ ProtectedVault: ${protectedAddr}`);

  // 3. Deploy VulnerableVault
  console.log("3/5 Deploying VulnerableVault...");
  const VulnerableVault = await hre.ethers.getContractFactory("VulnerableVault");
  const vulnerableVault = await VulnerableVault.deploy();
  await vulnerableVault.waitForDeployment();
  const vulnerableAddr = await vulnerableVault.getAddress();
  console.log(`    ✅ VulnerableVault: ${vulnerableAddr}`);

  // 4. Deploy ReentrancyAttacker
  console.log("4/5 Deploying ReentrancyAttacker...");
  const ReentrancyAttacker = await hre.ethers.getContractFactory("ReentrancyAttacker");
  const attacker = await ReentrancyAttacker.deploy();
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  console.log(`    ✅ ReentrancyAttacker: ${attackerAddr}`);

  // 5. Register ProtectedVault in GuardianProxy
  console.log("5/5 Registering ProtectedVault in GuardianProxy...");
  const tx = await guardian.registerProtocol(protectedAddr);
  await tx.wait();
  console.log("    ✅ Protocol registered\n");

  // Save deployment addresses
  const deployment = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      guardianProxy: guardianAddr,
      protectedVault: protectedAddr,
      vulnerableVault: vulnerableAddr,
      reentrancyAttacker: attackerAddr,
    },
  };

  const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         Deployment Complete                          ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  GuardianProxy:      ${guardianAddr}`);
  console.log(`║  ProtectedVault:     ${protectedAddr}`);
  console.log(`║  VulnerableVault:    ${vulnerableAddr}`);
  console.log(`║  ReentrancyAttacker: ${attackerAddr}`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Saved to: deployed-addresses.json`);
  console.log("╚══════════════════════════════════════════════════════╝");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
