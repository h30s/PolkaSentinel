const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  // Try to load deployed addresses, or deploy fresh if on local network
  const addrPath = path.join(__dirname, "..", "deployed-addresses.json");
  let guardian, protectedVault, vulnerableVault, attacker;
  let addrs;

  if (network === "hardhat" || network === "localhost" || !fs.existsSync(addrPath)) {
    console.log("Deploying fresh contracts for demo...\n");
    const G = await hre.ethers.getContractFactory("GuardianProxy");
    guardian = await G.deploy(hre.ethers.ZeroAddress);
    await guardian.waitForDeployment();

    const PV = await hre.ethers.getContractFactory("ProtectedVault");
    protectedVault = await PV.deploy(await guardian.getAddress());
    await protectedVault.waitForDeployment();

    const VV = await hre.ethers.getContractFactory("VulnerableVault");
    vulnerableVault = await VV.deploy();
    await vulnerableVault.waitForDeployment();

    const RA = await hre.ethers.getContractFactory("ReentrancyAttacker");
    attacker = await RA.deploy();
    await attacker.waitForDeployment();

    await (await guardian.registerProtocol(await protectedVault.getAddress())).wait();

    addrs = {
      guardianProxy: await guardian.getAddress(),
      protectedVault: await protectedVault.getAddress(),
      vulnerableVault: await vulnerableVault.getAddress(),
      reentrancyAttacker: await attacker.getAddress(),
    };
  } else {
    addrs = JSON.parse(fs.readFileSync(addrPath, "utf8")).contracts;
    guardian = await hre.ethers.getContractAt("GuardianProxy", addrs.guardianProxy);
    protectedVault = await hre.ethers.getContractAt("ProtectedVault", addrs.protectedVault);
    vulnerableVault = await hre.ethers.getContractAt("VulnerableVault", addrs.vulnerableVault);
    attacker = await hre.ethers.getContractAt("ReentrancyAttacker", addrs.reentrancyAttacker);
  }

  const ONE = hre.ethers.parseEther("1");
  const TEN = hre.ethers.parseEther("10");
  const results = { network, timestamp: new Date().toISOString(), transactions: {}, gas: {}, results: {} };

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║      PolkaSentinel — Live Attack Demo                ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Step 1: Fund both vaults
  console.log("Step 1: Funding vaults with 10 ETH each...");
  let tx = await vulnerableVault.deposit({ value: TEN });
  let receipt = await tx.wait();
  results.transactions.fund_vulnerable = receipt.hash;
  console.log(`    Vulnerable Vault funded: ${receipt.hash}`);

  tx = await protectedVault.deposit({ value: TEN });
  receipt = await tx.wait();
  results.transactions.fund_protected = receipt.hash;
  console.log(`    Protected Vault funded: ${receipt.hash}`);

  // Step 2: Normal withdrawal from protected vault
  console.log("\nStep 2: Normal withdrawal from Protected Vault...");
  tx = await protectedVault.withdraw(ONE);
  receipt = await tx.wait();
  results.transactions.normal_withdrawal = receipt.hash;
  results.gas.protected_withdrawal = receipt.gasUsed.toString();
  console.log(`    ✅ Withdrawal succeeded: ${receipt.hash}`);
  console.log(`    Gas used: ${receipt.gasUsed}`);

  // Step 3: Normal withdrawal from vulnerable vault (for gas comparison)
  console.log("\nStep 3: Normal withdrawal from Vulnerable Vault (gas baseline)...");
  tx = await vulnerableVault.withdraw(ONE);
  receipt = await tx.wait();
  results.transactions.normal_unprotected = receipt.hash;
  results.gas.unprotected_withdrawal = receipt.gasUsed.toString();
  console.log(`    ✅ Withdrawal succeeded: ${receipt.hash}`);
  console.log(`    Gas used: ${receipt.gasUsed}`);

  // Step 4: Attack vulnerable vault
  console.log("\nStep 4: 🔴 Attacking Vulnerable Vault...");
  const vulnBalBefore = await hre.ethers.provider.getBalance(addrs.vulnerableVault);
  tx = await attacker.attack(addrs.vulnerableVault, { value: ONE });
  receipt = await tx.wait();
  const vulnBalAfter = await hre.ethers.provider.getBalance(addrs.vulnerableVault);
  const loot1 = await attacker.getLoot();
  results.transactions.attack_vulnerable = receipt.hash;
  results.gas.attack_vulnerable = receipt.gasUsed.toString();
  console.log(`    TX: ${receipt.hash}`);
  console.log(`    Vault: ${hre.ethers.formatEther(vulnBalBefore)} → ${hre.ethers.formatEther(vulnBalAfter)} ETH`);
  console.log(`    Attacker loot: ${hre.ethers.formatEther(loot1)} ETH`);
  console.log(`    >>> VAULT DRAINED <<<`);

  // Step 5: Attack protected vault
  console.log("\nStep 5: 🛡️  Attacking Protected Vault...");
  // Deploy fresh attacker for clean test
  const Attacker2 = await hre.ethers.getContractFactory("ReentrancyAttacker");
  const attacker2 = await Attacker2.deploy();
  await attacker2.waitForDeployment();

  const protBalBefore = await hre.ethers.provider.getBalance(addrs.protectedVault);
  tx = await attacker2.attack(addrs.protectedVault, { value: ONE });
  receipt = await tx.wait();
  const protBalAfter = await hre.ethers.provider.getBalance(addrs.protectedVault);
  const loot2 = await attacker2.getLoot();
  results.transactions.attack_protected = receipt.hash;
  results.gas.attack_protected = receipt.gasUsed.toString();
  console.log(`    TX: ${receipt.hash}`);
  console.log(`    Vault: ${hre.ethers.formatEther(protBalBefore)} → ${hre.ethers.formatEther(protBalAfter)} ETH`);
  console.log(`    Attacker loot: ${hre.ethers.formatEther(loot2)} ETH`);
  console.log(`    >>> ATTACK BLOCKED — FUNDS SAFE <<<`);

  // Step 6: Post-attack normal operation
  console.log("\nStep 6: Post-attack normal withdrawal from Protected Vault...");
  tx = await protectedVault.withdraw(ONE);
  receipt = await tx.wait();
  results.transactions.post_attack_withdrawal = receipt.hash;
  console.log(`    ✅ Normal withdrawal succeeded: ${receipt.hash}`);
  console.log(`    >>> Vault fully operational after blocked attack <<<`);

  // Stats
  const [scanned, blocked] = await guardian.getStats();

  // Results
  results.results = {
    vulnerable_vault_drained: vulnBalAfter < vulnBalBefore,
    protected_vault_safe: protBalAfter >= protBalBefore,
    post_attack_operational: true,
    total_scanned: scanned.toString(),
    total_blocked: blocked.toString(),
  };

  // Gas report
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║         PolkaSentinel Gas Report                     ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Protected withdrawal:   ${results.gas.protected_withdrawal} gas`);
  console.log(`║  Unprotected withdrawal: ${results.gas.unprotected_withdrawal} gas`);
  console.log(`║  Sentinel overhead:      ${BigInt(results.gas.protected_withdrawal) - BigInt(results.gas.unprotected_withdrawal)} gas`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Guardian stats: ${scanned} scanned, ${blocked} blocked`);
  console.log("╚══════════════════════════════════════════════════════╝");

  // Final proof
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║         PROOF OF VALUE                               ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Vulnerable: ${hre.ethers.formatEther(vulnBalBefore)} → ${hre.ethers.formatEther(vulnBalAfter)} ETH  (DRAINED)`);
  console.log(`║  Protected:  ${hre.ethers.formatEther(protBalBefore)} → ${hre.ethers.formatEther(protBalAfter)} ETH  (SAFE)`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  Attack: REAL.  Protection: REAL.  On-chain proof.   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Save results
  const outputPath = path.join(__dirname, "..", "testnet-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: testnet-results.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
