import { getAtomicValue, getConfig, toBitcoinJS, txParamsType, sendType, BalancesType, ITransactionType } from "app/constants";
import axios from "axios";
import bitcoin from "bitcoinjs-lib";

export const send = async ({
  rb, from, address, amount, options,
}: sendType) => {
  const multiply_by = rb.rel == "BTC" ? 1 : getAtomicValue(options.config, rb);
  const utxos = await getUtxos({ config: options.config, rb, address: from });
  const txid = await broadcastTx({
    utxos,
    from,
    to: address,
    amount: amount * getAtomicValue(options.config, rb),
    wif: options.wif,
    fee: options.fees * multiply_by,
    rb,
    config: options.config,
  });
  return txid;
};
export const getUtxos = async ({ config, rb, address }: txParamsType) => {
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
  fee,
  config,
}) => {
    const network = toBitcoinJS(config[rb.rel].network);
    const key = bitcoin.ECPair.fromWIF(wif, network);
    const tx = new bitcoin.TransactionBuilder(network);
    let total = 0;
    for (const utx of utxos) {
      tx.addInput(utx.txid, utx.vout);
      total += utx.satoshis;
    }
    tx.addOutput(to, amount);
    const change = total - (amount + fee);
    if (change) { tx.addOutput(from, change); }

    utxos.forEach((v, i) => {
      tx.sign(i, key);
    });
    const rawtx = tx.build().toHex();
    const data = await axios.post(`${getConfig(config, rb).api}/tx/send`, {
      rawtx,
    });
    return data.data.txid;
};