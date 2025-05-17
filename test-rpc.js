const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/fVu9j8AbOT9WqAAd9BxgzioxitbdBHvO');
provider.getBlockNumber().then(console.log).catch(console.error);