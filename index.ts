import bip39 from 'bip39'
import { getRootNode, getChildNode, getWallet } from './keys'

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


export const generateSeed = (_mnemonic?: string, passphrase: string = '', options?: any) => {
  const mnemonic = _mnemonic ? _mnemonic : bip39.generateMnemonic(256)
  const seed = bip39.mnemonicToSeed(mnemonic, passphrase)
    
  const { wif, address, publicKey } = generatePKey(options.rel, options.base, options.config, seed);

  return { wif, address, publicKey, mnemonic }
}
  /*
  https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Change
  */
export const generatePKey = (
    rel,
    base,
    config,
    seed: Buffer,
    account: number = 0,
    change: number = 0,
    index: number = 0
  ) => {
    const rootNode = getRootNode(seed, rel, base, config)
    const childNode = getChildNode(rootNode, account, change, index, rel, config)
    const { wif, address, publicKey } = getWallet(childNode, rel, base, config)
    
    return { wif, address, publicKey }
  }

export const send = async (
    rel,
    base,    
    from: string,
    address: string,
    amount: number,
    wif: string,
    options?: any
  ) => {
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
export const getTxs = async (
    rel,
    base,
    address: string,
    config
  ) => {

    let data, n_tx, txs = [];
    const api = getConfig(config, rel, base).api;
    let decimals = getAtomicValue(config, rel, base);
    txs = await G_IMPORT[base.toLowerCase()].getTxs({ config, rel, base, address });
    return {txs, n_tx};
  }
export const getBalance = async (
    rel,
    base,    
    address: string,
    config
  ) => {

    const api = getConfig(config, rel, base).api;
    let data;
    let balances = {};
    let balance: number = 0;
    balances =  await G_IMPORT[base.toLowerCase()].getBalance({ config, rel, base, address });
    return balances;
  }

