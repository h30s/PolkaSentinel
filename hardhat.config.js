require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    polkadotHub: {
      url: process.env.POLKADOT_HUB_RPC || "https://testnet-passet-hub-eth-rpc.polkadot.io",
      chainId: parseInt(process.env.POLKADOT_HUB_CHAIN_ID || "420420421"),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
