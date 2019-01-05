import bip39 from "bip39";
import { getChildNode, getRootNode, getWallet } from "./keys";

import * as btc from "./btc";
import * as eth from "./eth";
import * as nano from "./nano";
import * as neo from "./neo";
import * as vet from "./vet";
import * as xrp from "./xrp";

import {
  getAtomicValue,
  getConfig,
  
  sendOptionsType,
  RB,
  C,
} from "app/constants";

const G_IMPORT = {btc, eth, neo, nano, vet, xrp};

export const generateSeed = (_mnemonic?: string, passphrase: string = "", options?: any) => {
  const mnemonic = _mnemonic ? _mnemonic : bip39.generateMnemonic(256);
  const seed = bip39.mnemonicToSeed(mnemonic, passphrase);

  const { wif, address, publicKey } = generatePKey({ rel: options.rel, base: options.base}, options.config, seed);

  return { wif, address, publicKey, mnemonic };
};
  /*
  https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Change
  */
export const generatePKey = (
    rb: RB,
    config: C,
    seed: Buffer,
    account: number = 0,
    change: number = 0,
    index: number = 0,
  ) => {
    const rootNode = getRootNode(seed, rb, config);
    const childNode = getChildNode(rootNode, account, change, index, rb, config);
    const { wif, address, publicKey } = getWallet(childNode, rb, config);

    return { wif, address, publicKey };
  };

export const send = async (
    rb: RB,
    from: string,
    address: string,
    amount: number,
    options?: sendOptionsType,
  ): Promise<string> => {
      let txid;
      switch (rb.base) {
        case "ETH":
        case "VET":
          // options.gasLimit *= 1000000000;
          options.gasPrice *= 1000000000;
          if (rb.rel == rb.base) {
            txid = await G_IMPORT[rb.base.toLowerCase()].send({ rb, from, address, amount, options });
          } else {
            txid = await G_IMPORT[rb.base.toLowerCase()].sendERC20({ rb, from, address, amount, options });
          }
          break;
        default:
          txid = await G_IMPORT[rb.base.toLowerCase()].send({ rb, from, address, amount, options });
          break;
      }
      return txid;
  };
export const getTxs = async (
    rb: RB,
    address: string,
    config,
  ) => {
    let txs = [];
    txs = await G_IMPORT[rb.base.toLowerCase()].getTxs({ rb, config, address });
    return {txs};
  };
export const getBalance = async (
    rb: RB,
    address: string,
    config,
  ) => {
    const balances = await G_IMPORT[rb.base.toLowerCase()].getBalance({ rb, config,address });
    return balances;
  };
