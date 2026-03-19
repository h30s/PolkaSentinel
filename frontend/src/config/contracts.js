// Contract addresses — defaults from local deployment
export const CONTRACTS = {
  GuardianProxy: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  ProtectedVault: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  VulnerableVault: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  ReentrancyAttacker: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

// Try to load deployed addresses at runtime (works with Vite dynamic import)
async function loadDeployedAddresses() {
  try {
    const resp = await fetch('/deployed-addresses.json');
    if (resp.ok) {
      const deployed = await resp.json();
      const c = deployed.contracts || deployed;
      if (c.guardianProxy) CONTRACTS.GuardianProxy = c.guardianProxy;
      if (c.protectedVault) CONTRACTS.ProtectedVault = c.protectedVault;
      if (c.vulnerableVault) CONTRACTS.VulnerableVault = c.vulnerableVault;
      if (c.reentrancyAttacker) CONTRACTS.ReentrancyAttacker = c.reentrancyAttacker;
    }
  } catch {
    // Use default addresses
  }
}

loadDeployedAddresses();

export const ABIS = {
  GuardianProxy: [
    'function guard(bytes calldata data, uint256 value, uint256 gas) external returns (bool allowed, uint8 threat, uint8 confidence)',
    'function getStats() external view returns (uint256 totalScanned, uint256 totalBlocked)',
    'function classifyView(uint256[10] calldata features) external view returns (uint8 threat, uint8 confidence, uint32 gasUsed)',
    'function paused() external view returns (bool)',
  ],
  ProtectedVault: [
    'function deposit() external payable',
    'function withdraw(uint256 amount) external',
    'function getBalance(address account) external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)',
  ],
  VulnerableVault: [
    'function deposit() external payable',
    'function withdraw(uint256 amount) external',
    'function getBalance(address account) external view returns (uint256)',
  ],
  ReentrancyAttacker: [
    'function attack(address target) external payable',
    'function getLoot() external view returns (uint256)',
  ],
};

export const CHAIN_CONFIG = {
  chainId: '0x7A69', // 31337 for Hardhat local
  chainName: 'Hardhat Local',
  rpcUrl: 'http://127.0.0.1:8545',
  symbol: 'ETH',
  decimals: 18,
};
