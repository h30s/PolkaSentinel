// Contract addresses — LIVE on Polkadot Hub TestNet
export const CONTRACTS = {
  GuardianProxy: '0xeEC1F62F2E03908f47Eb4d5fE7281fD25d387480',
  ProtectedVault: '0x0927a3c71cE3D3DFf2886236efA4622C2de31ECe',
  VulnerableVault: '0x02cDC030bd8917522f339F7faD40FCE2aaE990ee',
  ReentrancyAttacker: '0xb225669E1B22C1296CA291cA17Eb45BCB54d47cd',
};

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
  chainId: '0x19100F61', // 420420417 for Polkadot Hub TestNet
  chainName: 'Polkadot Hub TestNet',
  rpcUrl: 'https://services.polkadothub-rpc.com/testnet',
  symbol: 'PAS',
  decimals: 18,
};
