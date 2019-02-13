import bip39 from "bip39";

import * as btc from "./btc";
import * as eth from "./eth";
import * as nano from "./nano";
import * as neo from "./neo";
import * as vet from "./vet";
import * as xrp from "./xrp";
import * as eos from "./eos";

import {
  sendOptionsType,
  RB,
  C,
  config,
} from "app/constants";


const HDKey = require('hdkey')
const HDKeyr = require('@ont-community/hdkey-secp256r1')

const G_IMPORT = {btc, eth, neo, nano, vet, xrp, eos};

export const generateSeed = (_mnemonic?: string, passphrase: string = "", options?: any) => {
  const mnemonic = _mnemonic ? _mnemonic : bip39.generateMnemonic(256);
  const seed = bip39.mnemonicToSeed(mnemonic, passphrase);
  return { seed, mnemonic };
};


  /*
  https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Change
  */
export const generatePKey = (
    rb: RB,
    seed: Buffer,
    account: number = 0,
    change: number = 0,
    index: number = 0,
  ) => {
    const rootNode = getRootNode(seed, rb);
    const childNode = getChildNode(rootNode, account, change, index, rb);
    const { wif, address, publicKey } = G_IMPORT[rb.base.toLowerCase()].getWallet({ childNode, rb });

    return { wif, address, publicKey };
  };

export const getRootNode = (seed: any, rb: RB) => {
  let rootNode;
  switch (rb.base) {
    case "NEO":
      rootNode = HDKeyr.fromMasterSeed(seed)
      break;
    case "NANO":
      rootNode = seed.slice(0, 32).toString("hex");
      break;
    default:
      rootNode = HDKey.fromMasterSeed(seed)
    break;
  }
  return rootNode;
};
export const getChildNode = (
  rootNode: any,
  account: number,
  change: number,
  index: number,
  rb: RB,
) => {
  const networkCode = config[rb.rel].code;
  const bip44path = `m/44'/${networkCode}'/${account}'/${change}/${index}`;
  return typeof rootNode == "object" ? rootNode.derive(bip44path) : rootNode;
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

