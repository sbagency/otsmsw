const { ethers } = require("ethers");
const fs = require('fs');

//const network = 'ropsten'

const provider = new ethers.providers.JsonRpcProvider();

// etherscan
//const provider = new ethers.providers.EtherscanProvider(network);

// infura
//const provider = new ethers.providers.InfuraProvider(network);

// alchemy
//const provider = new ethers.providers.AlchemyProvider(network);

exports.provider = provider;

exports.network = 'localhost';

exports.scrypt = {  
    N: 64 // power of 2 (default: 131072)
}  
