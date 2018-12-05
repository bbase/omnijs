import bip39 from 'bip39'
import { getRootNode, deriveAccount, getWallet } from './keys'
import { sendETH, sendERC20 } from './eth'

import * as btc from './btc';
import * as eth from './eth';
import * as neo from './neo';
import * as nano from './nano';
import * as vet from './vet';
import * as xrp from './xrp';

const G_IMPORT = {btc, eth, neo, nano, vet, xrp};

import {
  getAtomicValue,
  getConfig,
} from 'app/constants'

class OmniJs {
  public rel: string
  public base: string

  constructor(rel: string = '', base: string = '') {
    this.rel = rel
    this.base = base
  }
  set = (rel: string = '', base: string = '') => {
    this.rel = rel
    this.base = base
  }


  generateSeed = (_mnemonic?: string, passphrase: string = '', options?: any) => {
    const mnemonic = _mnemonic ? _mnemonic : bip39.generateMnemonic(256)
    //const seed = bip39.mnemonicToSeed(mnemonic, passphrase).slice(0,32)
    const seed = bip39.mnemonicToSeed(mnemonic, passphrase)
    
    const { wif, address, publicKey } = this.generatePKey(options.config, seed);

    return { wif, address, publicKey, mnemonic }
  }
  /*
  https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Change
  */
  generatePKey = (
    config,
    seed: Buffer,
    account: number = 0,
    change: number = 0,
    index: number = 0
  ) => {
    const { rel, base } = this;
    const rootNode = getRootNode(seed, rel, base, config)
    const key = deriveAccount(rootNode, account, change, index, rel, config)
    const { wif, address, publicKey } = getWallet(key, rel, base, config)
    
    return { wif, address, publicKey }
  }

  send = (
    from: string,
    address: string,
    amount: number,
    wif: string,
    options?: any
  ) => {
    const { rel, base } = this;
    return new Promise(async (resolve, reject) => {
      let txid;
      try{
        switch (base) {
          case 'ETH':
            //options.gasLimit *= 1000000000;
            options.gasPrice *= 1000000000;
            if (rel == base) {
              txid = await sendETH({ from, rel, address, amount, wif, options });
            } else {
              txid = await sendERC20({ from, rel, base, address, amount, wif, options });
            }
            break;
          default:
            txid = G_IMPORT[base.toLowerCase()].send({ from, rel, base, address, amount, wif, options });
          break
        }
        resolve({txid})
      }catch(e){reject(e)}
    })
  }
  getTxs = (address: string, config) => {
    const { rel, base } = this;

    let data, n_tx, txs = [];
    const api = getConfig(config, rel, base).api;
    let decimals = getAtomicValue(config, rel, base);

    return new Promise(async (resolve, reject) => {
        try{
          txs = G_IMPORT[base.toLowerCase()].getTx({ config, rel, base, address });
          resolve({txs, n_tx});
        }catch(e){ reject(e)}
    });
}
  getBalance = (address: string, config) => {
    const { rel, base } = this;

    const api = getConfig(config, rel, base).api;
    let data;
    let balances = {};
    let balance: number = 0;
    return new Promise(async (resolve, reject) => {
      try {
        balances =  G_IMPORT[base.toLowerCase()].getBalance({ config, rel, base, address });
        resolve(balances); 
  }catch(e){
    reject(e);
  }  });
}
}

export default OmniJs
