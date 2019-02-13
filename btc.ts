import { getAtomicValue, getConfig, toBitcoinJS, txParamsType, sendType, BalancesType, ITransactionType } from "app/constants";
import axios from "axios";
import bitcoin from "bitcoinjs-lib";
import {config} from "app/constants";
const bufferToHex = (buffer) => {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
const segwitSupported = ["BTCX"];

export const getWallet = ({rb, childNode}) => {
  const network = toBitcoinJS(config[rb.rel].network);
  
  const { address } = segwitSupported.indexOf(rb.rel) != -1 ? bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey: childNode.publicKey })
  }) : bitcoin.payments.p2pkh({
    pubkey: childNode.publicKey,
    network,
  }) ;
  const firstKeyECPair = bitcoin.ECPair.fromPrivateKey(childNode.privateKey, {
    network,
  });  
  const wif = firstKeyECPair.toWIF();
  const publicKey = bufferToHex(childNode.publicKey);
  
  return {wif, address, publicKey};
}
export const send = async ({
  rb, from, address, amount, options,
}: sendType) => {
  const multiply_by = rb.rel == "BTC" ? 1 : getAtomicValue(config, rb);
  const utxos = await getUtxos({ rb, address: from });
  const txid = await broadcastTx({
    utxos,
    from,
    to: address,
    amount: amount * getAtomicValue(config, rb),
    wif: options.wif,
    publicKey: options.publicKey,
    fee: options.fees * multiply_by,
    rb,
  });
  return txid;
};
export const getUtxos = async ({ rb, address }: txParamsType) => {
  const data = await axios.post(`${getConfig(config, rb).api}/addrs/utxo`, {
    addrs: address,
  });
  return data.data;
};
export const broadcastTx = async ({
  from,
  rb,
  utxos,
  to,
  amount,
  wif,
  publicKey,
  fee,
}) => {
    const network = toBitcoinJS(config[rb.rel].network);
    const key = bitcoin.ECPair.fromWIF(wif, network);

    let p2sh;
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(publicKey, "hex"), network})
    p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network })

    const tx = new bitcoin.TransactionBuilder(network);
    let total = 0;
    let v = 0;
    for (const utx of utxos) {
      tx.addInput(utx.txid, utx.vout);
      total += utx.satoshis;
      v += utx.value
    }
    tx.addOutput(to, amount);
    const change = total - (amount + fee);
    if (change) { tx.addOutput(from, change); }

    utxos.forEach((v, i) => {
      if (segwitSupported.indexOf(rb.rel) != -1){
        //vin, keyPair, redeemScript, hashType, witnessValue, witnessScript
        tx.sign(i, key, p2sh.redeem.output, null, v);
      }else{
        tx.sign(i, key);
      }
    });
    const rawtx = tx.build().toHex();
    const data = await axios.post(`${getConfig(config, rb).api}/tx/send`, {
      rawtx,
    });
    return data.data.txid;
};