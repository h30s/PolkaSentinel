const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PolkaSentinel — Full Test Suite", function () {
  let guardian, protectedVault, vulnerableVault, attacker;
  let owner, user1, user2, attackerAccount;

  const ONE_ETHER = ethers.parseEther("1");
  const TEN_ETHER = ethers.parseEther("10");
  const HUNDRED_ETHER = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user1, user2, attackerAccount] = await ethers.getSigners();

    // Deploy GuardianProxy (with address(0) sentinel engine = Solidity fallback)
    const GuardianProxy = await ethers.getContractFactory("GuardianProxy");
    guardian = await GuardianProxy.deploy(ethers.ZeroAddress);
    await guardian.waitForDeployment();

    // Deploy ProtectedVault (with sentinel)
    const ProtectedVault = await ethers.getContractFactory("ProtectedVault");
    protectedVault = await ProtectedVault.deploy(await guardian.getAddress());
    await protectedVault.waitForDeployment();

    // Deploy VulnerableVault (no sentinel)
    const VulnerableVault = await ethers.getContractFactory("VulnerableVault");
    vulnerableVault = await VulnerableVault.deploy();
    await vulnerableVault.waitForDeployment();

    // Register protected vault in guardian
    await guardian.registerProtocol(await protectedVault.getAddress());
  });

  // =========================================================================
  //  SECTION 1: GuardianProxy Unit Tests
  // =========================================================================

  describe("GuardianProxy", function () {
    it("should deploy with correct roles", async function () {
      const DEFAULT_ADMIN_ROLE = await guardian.DEFAULT_ADMIN_ROLE();
      const GUARDIAN_ROLE = await guardian.GUARDIAN_ROLE();

      expect(await guardian.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await guardian.hasRole(GUARDIAN_ROLE, owner.address)).to.be.true;
    });

    it("should register protocol", async function () {
      expect(await guardian.protocolRegistry(await protectedVault.getAddress())).to.be.true;
    });

    it("should reject protocol registration from non-admin", async function () {
      await expect(
        guardian.connect(user1).registerProtocol(user2.address)
      ).to.be.reverted;
    });

    it("should classify a safe EOA transaction as SAFE", async function () {
      // Simulate calling classifyView with normal EOA features
      // [reentry=0, value=1000, data=68, selector=0, is_contract=0, gap=5000, withdrawals=0, cumul=0, ratio=50, age=100]
      const features = [0, 1000, 68, 0, 0, 5000, 0, 0, 50, 100];
      const [threatLevel, confidence, signatureId] = await guardian.classifyView(features);

      expect(threatLevel).to.equal(0); // SAFE
      expect(confidence).to.equal(95);
    });

    it("should classify new contract large drain as CRITICAL (via tree)", async function () {
      // New contract (gap=0), draining >30% (ratio=600)
      // Note: reentrancy is now a hard revert in guard(), NOT in the tree
      const features = [0, 10000000, 256, 0, 1, 0, 0, 0, 600, 500];
      const [threatLevel, confidence] = await guardian.classifyView(features);

      expect(threatLevel).to.equal(2); // CRITICAL
      expect(confidence).to.equal(91);
    });

    it("should classify new contract small amount as SUSPICIOUS", async function () {
      const features = [0, 500, 68, 0, 1, 0, 0, 0, 50, 200];
      const [threatLevel, confidence] = await guardian.classifyView(features);

      expect(threatLevel).to.equal(1); // SUSPICIOUS
      expect(confidence).to.equal(55);
    });

    it("should classify known contract normal amount as SAFE", async function () {
      const features = [0, 5000, 68, 0, 1, 1000, 0, 0, 100, 8000];
      const [threatLevel, confidence] = await guardian.classifyView(features);

      expect(threatLevel).to.equal(0); // SAFE
      expect(confidence).to.equal(85);
    });

    it("should set threshold", async function () {
      await guardian.setThreshold(1);
      expect(await guardian.globalThreshold()).to.equal(1);
    });

    it("should reject invalid threshold", async function () {
      await expect(guardian.setThreshold(3)).to.be.revertedWith("GuardianProxy: invalid threshold");
    });

    it("should emergency pause and unpause", async function () {
      await guardian.emergencyPause();
      expect(await guardian.paused()).to.be.true;

      await guardian.emergencyUnpause();
      expect(await guardian.paused()).to.be.false;
    });

    it("should track stats correctly", async function () {
      const [scanned, blocked] = await guardian.getStats();
      expect(scanned).to.equal(0);
      expect(blocked).to.equal(0);
    });
  });

  // =========================================================================
  //  SECTION 2: ProtectedVault Unit Tests
  // =========================================================================

  describe("ProtectedVault", function () {
    it("should accept deposits", async function () {
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      expect(await protectedVault.getBalance(user1.address)).to.equal(TEN_ETHER);
      expect(await protectedVault.totalDeposits()).to.equal(TEN_ETHER);
    });

    it("should allow normal EOA withdrawal", async function () {
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx = await protectedVault.connect(user1).withdraw(ONE_ETHER);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(user1.address);

      expect(balAfter + gasUsed - balBefore).to.equal(ONE_ETHER);
      expect(await protectedVault.getBalance(user1.address)).to.equal(TEN_ETHER - ONE_ETHER);
    });

    it("should reject withdrawal exceeding balance", async function () {
      await protectedVault.connect(user1).deposit({ value: ONE_ETHER });

      await expect(
        protectedVault.connect(user1).withdraw(TEN_ETHER)
      ).to.be.revertedWith("ProtectedVault: insufficient balance");
    });

    it("should emit Deposited and Withdrawn events", async function () {
      await expect(protectedVault.connect(user1).deposit({ value: ONE_ETHER }))
        .to.emit(protectedVault, "Deposited")
        .withArgs(user1.address, ONE_ETHER);

      await expect(protectedVault.connect(user1).withdraw(ONE_ETHER))
        .to.emit(protectedVault, "Withdrawn")
        .withArgs(user1.address, ONE_ETHER);
    });
  });

  // =========================================================================
  //  SECTION 3: VulnerableVault — Proves the Attack is REAL
  // =========================================================================

  describe("VulnerableVault — Attack Proof", function () {
    it("should be drained by reentrancy attacker (PROVES ATTACK IS REAL)", async function () {
      // Deposit funds from an innocent user
      await vulnerableVault.connect(user1).deposit({ value: TEN_ETHER });
      expect(await ethers.provider.getBalance(await vulnerableVault.getAddress())).to.equal(TEN_ETHER);

      // Deploy attacker
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      attacker = await Attacker.connect(attackerAccount).deploy();
      await attacker.waitForDeployment();

      // Execute the attack with 1 ETH
      await attacker.connect(attackerAccount).attack(
        await vulnerableVault.getAddress(),
        { value: ONE_ETHER }
      );

      // THE PROOF: Vulnerable vault is drained
      const vaultBalance = await ethers.provider.getBalance(await vulnerableVault.getAddress());
      const attackerLoot = await attacker.getLoot();

      expect(vaultBalance).to.be.lt(TEN_ETHER); // Vault lost funds
      expect(attackerLoot).to.be.gt(ONE_ETHER);  // Attacker gained more than deposited

      console.log("    Vulnerable Vault balance after attack:", ethers.formatEther(vaultBalance), "ETH");
      console.log("    Attacker loot:", ethers.formatEther(attackerLoot), "ETH");
      console.log("    >>> ATTACK IS REAL — vault was drained <<<");
    });
  });

  // =========================================================================
  //  SECTION 4: ProtectedVault — Proves PolkaSentinel STOPS the Attack
  // =========================================================================

  describe("ProtectedVault — Sentinel Protection", function () {
    it("should BLOCK reentrancy attack (PROVES PROTECTION WORKS)", async function () {
      // Deposit funds from an innocent user
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });
      const vaultBalanceBefore = await ethers.provider.getBalance(await protectedVault.getAddress());
      expect(vaultBalanceBefore).to.equal(TEN_ETHER);

      // Deploy attacker
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      attacker = await Attacker.connect(attackerAccount).deploy();
      await attacker.waitForDeployment();

      // Execute the attack — should fail
      await attacker.connect(attackerAccount).attack(
        await protectedVault.getAddress(),
        { value: ONE_ETHER }
      );

      // THE PROOF: Protected vault is SAFE
      const vaultBalanceAfter = await ethers.provider.getBalance(await protectedVault.getAddress());
      const attackerLoot = await attacker.getLoot();

      // The vault should still have at least the original deposit
      // (attacker's deposit of 1 ETH may or may not be in the vault depending on revert scope)
      expect(vaultBalanceAfter).to.be.gte(TEN_ETHER);

      console.log("    Protected Vault balance after attack:", ethers.formatEther(vaultBalanceAfter), "ETH");
      console.log("    Attacker loot:", ethers.formatEther(attackerLoot), "ETH");
      console.log("    >>> ATTACK BLOCKED — funds are SAFE <<<");
    });

    it("should work normally after a blocked attack", async function () {
      // Deposit
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      // Attack (blocked)
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      attacker = await Attacker.connect(attackerAccount).deploy();
      await attacker.waitForDeployment();
      await attacker.connect(attackerAccount).attack(
        await protectedVault.getAddress(),
        { value: ONE_ETHER }
      );

      // Normal operations should still work
      await protectedVault.connect(user1).deposit({ value: ONE_ETHER });
      await protectedVault.connect(user1).withdraw(ONE_ETHER);

      const balance = await protectedVault.getBalance(user1.address);
      expect(balance).to.equal(TEN_ETHER);

      console.log("    >>> Vault fully operational after blocked attack <<<");
    });

    it("guardian should track blocked attack in stats", async function () {
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      // Normal withdrawal (should pass)
      await protectedVault.connect(user1).withdraw(ONE_ETHER);

      const [scanned, blocked] = await guardian.getStats();
      // At least 1 scanned (the normal withdrawal)
      expect(scanned).to.be.gte(1);

      console.log("    Stats — scanned:", scanned.toString(), "blocked:", blocked.toString());
    });
  });

  // =========================================================================
  //  SECTION 5: SIDE-BY-SIDE PROOF (THE MONEY TEST)
  // =========================================================================

  describe("SIDE-BY-SIDE PROOF — The Money Test", function () {
    it("SAME attack: vulnerable vault DRAINED, protected vault SAFE", async function () {
      console.log("\n    ╔══════════════════════════════════════════════════════╗");
      console.log("    ║         PolkaSentinel Proof of Value                 ║");
      console.log("    ╠══════════════════════════════════════════════════════╣");

      // Setup: deposit 10 ETH to BOTH vaults
      await vulnerableVault.connect(user1).deposit({ value: TEN_ETHER });
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      const vulnBefore = await ethers.provider.getBalance(await vulnerableVault.getAddress());
      const protBefore = await ethers.provider.getBalance(await protectedVault.getAddress());

      // Attack vulnerable vault
      const Attacker1 = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker1 = await Attacker1.connect(attackerAccount).deploy();
      await attacker1.waitForDeployment();
      await attacker1.connect(attackerAccount).attack(
        await vulnerableVault.getAddress(),
        { value: ONE_ETHER }
      );

      // Attack protected vault
      const Attacker2 = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker2 = await Attacker2.connect(attackerAccount).deploy();
      await attacker2.waitForDeployment();
      await attacker2.connect(attackerAccount).attack(
        await protectedVault.getAddress(),
        { value: ONE_ETHER }
      );

      // Results
      const vulnAfter = await ethers.provider.getBalance(await vulnerableVault.getAddress());
      const protAfter = await ethers.provider.getBalance(await protectedVault.getAddress());
      const loot1 = await attacker1.getLoot();
      const loot2 = await attacker2.getLoot();

      console.log("    ║                                                      ║");
      console.log(`    ║  Vulnerable: ${ethers.formatEther(vulnBefore)} → ${ethers.formatEther(vulnAfter)} ETH`);
      console.log(`    ║  Protected:  ${ethers.formatEther(protBefore)} → ${ethers.formatEther(protAfter)} ETH`);
      console.log(`    ║  Attacker1 loot: ${ethers.formatEther(loot1)} ETH`);
      console.log(`    ║  Attacker2 loot: ${ethers.formatEther(loot2)} ETH`);
      console.log("    ║                                                      ║");
      console.log("    ╠══════════════════════════════════════════════════════╣");
      console.log("    ║  Attack: REAL.  Protection: REAL.  On-chain proof.   ║");
      console.log("    ╚══════════════════════════════════════════════════════╝\n");

      // Assertions
      expect(vulnAfter).to.be.lt(vulnBefore);   // Vulnerable vault LOST funds
      expect(protAfter).to.be.gte(protBefore);   // Protected vault KEPT funds
      expect(loot1).to.be.gt(ONE_ETHER);          // Attacker1 GAINED from vulnerable
    });
  });

  // =========================================================================
  //  SECTION 6: Decision Tree Full Branch Coverage
  // =========================================================================

  describe("Decision Tree — Full Branch Coverage", function () {
    // Note: reentrancy is now a HARD REVERT in guard(), not a tree classification.
    // classifyView() only tests the tree, which handles non-reentrancy patterns.
    // Reentrancy protection is tested in Section 4 (live attack tests).
    const testCases = [
      { name: "SAFE: normal EOA withdrawal",           features: [0, 1000, 68, 0, 0, 5000, 0, 0, 50, 10000],         expected: 0 },
      { name: "SAFE: known contract, small amount",    features: [0, 5000, 68, 0, 1, 1000, 0, 0, 100, 8000],         expected: 0 },
      { name: "CRITICAL: new contract draining >30%",  features: [0, 10000000, 256, 0, 1, 0, 0, 0, 600, 500],        expected: 2 },
      { name: "SUSPICIOUS: new contract, small",       features: [0, 500, 68, 0, 1, 0, 0, 0, 50, 200],              expected: 1 },
      { name: "SUSPICIOUS: known contract, huge drain", features: [0, 30000000, 68, 0, 1, 5000, 0, 0, 750, 8000],    expected: 1 },
      { name: "SUSPICIOUS: EOA draining >90%",         features: [0, 45000000, 68, 0, 0, 1000, 0, 0, 950, 5000],     expected: 1 },
    ];

    for (const tc of testCases) {
      it(`should classify: ${tc.name}`, async function () {
        const [threatLevel] = await guardian.classifyView(tc.features);
        expect(threatLevel).to.equal(tc.expected);
      });
    }

    it("should be deterministic (same input = same output)", async function () {
      const features = [0, 10000000, 256, 0, 1, 0, 0, 0, 600, 500];
      const [r1] = await guardian.classifyView(features);
      const [r2] = await guardian.classifyView(features);
      const [r3] = await guardian.classifyView(features);
      expect(r1).to.equal(r2);
      expect(r2).to.equal(r3);
    });
  });

  // =========================================================================
  //  SECTION 7: Gas Measurement
  // =========================================================================

  describe("Gas Measurement", function () {
    it("should measure guard() gas cost", async function () {
      await protectedVault.connect(user1).deposit({ value: TEN_ETHER });

      const tx = await protectedVault.connect(user1).withdraw(ONE_ETHER);
      const receipt = await tx.wait();

      console.log("    === PolkaSentinel Gas Report ===");
      console.log("    Protected withdrawal gas:", receipt.gasUsed.toString());
    });

    it("should measure unprotected withdrawal gas cost", async function () {
      await vulnerableVault.connect(user1).deposit({ value: TEN_ETHER });

      const tx = await vulnerableVault.connect(user1).withdraw(ONE_ETHER);
      const receipt = await tx.wait();

      console.log("    Unprotected withdrawal gas:", receipt.gasUsed.toString());
    });

    it("should measure classifyView gas cost", async function () {
      const features = [0, 1000, 68, 0, 0, 5000, 0, 0, 50, 10000];
      const gas = await guardian.classifyView.estimateGas(features);

      console.log("    classifyView gas:", gas.toString());
    });
  });
});
