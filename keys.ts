import { wallet as NeoWallet } from "@cityofzion/neon-core";
import bip32 from "bip32";
import bitcoin from "bitcoinjs-lib";
import bitcoinSecp256r1 from "bitcoinjs-lib-secp256r1";
import { ethers } from "ethers";
import * as nanocurrency from "nanocurrency";
import rplk from "ripple-keypairs";
import { toBitcoinJS, WalletType, C, RB } from "app/constants";

const bufferToHex = (buffer) => {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
export const getRootNode = (seed: any, rb: RB, config: C) => {
  let rootNode;
  switch (rb.base) {
    case "BTC":
      const network = toBitcoinJS(config[rb.rel].network);
      rootNode = bip32.fromSeed(seed, network);
      break;
    case "NEO":
      rootNode = bitcoinSecp256r1.HDNode.fromSeedBuffer(
        seed,
        bitcoinSecp256r1.bitcoin,
      );
    break;
      // case 'XRP':
      // case 'XMR':
    case "NANO":
      return seed.slice(0, 32).toString("hex");
    default:
      // eth and rest of its shitcoins
      rootNode = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
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
  config: C,
) => {
  const networkCode = config[rb.rel].code;
  const bip44path = `m/44'/${networkCode}'/${account}'/${change}/${index}`;
  return typeof rootNode == "object" ? rootNode.derivePath(bip44path) : rootNode;
};

export const getWallet = (childNode: any, rb: RB, config: C): WalletType => {
  let wif: string, address: string, publicKey: string;

  switch (rb.base) {
    case "BTC":
      const network = toBitcoinJS(config[rb.rel].network);
      const derivedWallet = bitcoin.payments.p2pkh({
        pubkey: childNode.publicKey,
        network,
      });
      const firstKeyECPair = bitcoin.ECPair.fromPrivateKey(childNode.privateKey, {
        network,
      });

      wif = firstKeyECPair.toWIF();
      address = derivedWallet.address;
      publicKey = bufferToHex(childNode.publicKey);
      break;
    case "NEO":
      wif = childNode.keyPair.toWIF();
      const account = new NeoWallet.Account(wif);
      address = account.address;
      publicKey = account.publicKey;
      break;
    case "NANO":
      wif = nanocurrency.deriveSecretKey(childNode, 0);
      publicKey = nanocurrency.derivePublicKey(wif);
      address = nanocurrency.deriveAddress(publicKey);
      break;
    case "XRP":
      wif = childNode.privateKey.toString(`hex`);
      publicKey = childNode.publicKey.toString(`hex`);
      address = rplk.deriveAddress(publicKey);
      break;
    case "XMR":
    /*
      const monero_utils = require('mymonero-core-js/monero_utils/monero_cryptonote_utils_instance')
      const walletUtils = require('mymonero-core-js/monero_utils/monero_wallet_utils')
      const k = monero_utils.create_address(key);
      console.log(k)
      console.log(walletUtils.NewlyCreatedWallet('english'))
      require("./monero_utils/monero_utils")({}).then(function (monero_utils) {
        const mymonero = require("mymonero-core-js");
        var nettype = mymonero.nettype_utils.network_type.STAGENET;
        var decoded = monero_utils.address_and_keys_from_seed(key, nettype);
        console.log(decoded)
      });
      */
    break;
    case "ETH":
    case "VET":
      // eth and rest of its shitcoins
      // var privKeyBuffer = key.__d.toBuffer(32)
      const privKeyBuffer = childNode.__d;
      const privkey: string = privKeyBuffer.toString("hex");
      const wallet = new ethers.Wallet("0x" + privkey);
      address = wallet.address;
      wif = wallet.privateKey;
      publicKey = ethers.utils.computePublicKey(wallet.privateKey);
    break;
  }
  return { wif, address, publicKey };
};
