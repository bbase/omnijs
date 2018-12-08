import bip39 from 'bip39'
import { getRootNode, deriveAccount, getWallet } from './keys'

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

  send = async (
    from: string,
    address: string,
    amount: number,
    wif: string,
    options?: any
  ) => {
    const { rel, base } = this;
      let txid;
      switch (base) {
        case 'ETH':
        case 'VET':
          //options.gasLimit *= 1000000000;
          options.gasPrice *= 1000000000;
          if (rel == base) {
            txid = await G_IMPORT[base.toLowerCase()].send({ from, rel, address, amount, wif, options });
          } else {
            txid = await G_IMPORT[base.toLowerCase()].sendERC20({ from, rel, base, address, amount, wif, options });
          }
          break;
        default:
          txid = await G_IMPORT[base.toLowerCase()].send({ from, rel, base, address, amount, wif, options });
        break
      }
      return {txid}
  }
  getTxs = async (address: string, config) => {
    const { rel, base } = this;

    let data, n_tx, txs = [];
    const api = getConfig(config, rel, base).api;
    let decimals = getAtomicValue(config, rel, base);
    txs = await G_IMPORT[base.toLowerCase()].getTxs({ config, rel, base, address });
    return {txs, n_tx};
  }
  getBalance = async (address: string, config) => {
    const { rel, base } = this;

    const api = getConfig(config, rel, base).api;
    let data;
    let balances = {};
    let balance: number = 0;
    balances =  await G_IMPORT[base.toLowerCase()].getBalance({ config, rel, base, address });
    return balances;
  }
}

export default OmniJs
