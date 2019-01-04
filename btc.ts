import { getAtomicValue, getConfig, toBitcoinJS, txParamsType, sendType, BalancesType, TransactionType } from "app/constants";
import axios from "axios";
import bitcoin from "bitcoinjs-lib";


export const getBalance = async ({ config, rb, address }: txParamsType): Promise<BalancesType> => {
  const { api } = getConfig(config, rb);
  const data = await axios.get(`${api}/addr/${address}`);
  const balance = data.data.balance;
  return { [rb.rel]: { balance } };
};
export const getTxs = async ({ rb, config, address }: txParamsType): Promise<TransactionType[]> => {
  const api = getConfig(config, rb).api;
  const txs = [];
  const data = await axios.get(`${api}/txs/?address=${address}`);
  data.data.txs.map((o) => {
    const from = o.vin[0].addr;
    let value = 0;
    let kind = "got";
    const fee = o.fees;

    if (from != address) {
      kind = "got";
      o.vout.map((ox) => {
        if (ox.scriptPubKey.addresses && ox.scriptPubKey.addresses[0] == address) {
          value += ox.value;
        }
      });
    } else {
      kind = "sent";
      value = o.vout[0].value;

    }
    const tx = {
      from,
      hash: o.txid,
      confirmations: o.confirmations,
      value,
      kind,
      fee,
      timestamp: o.blocktime,
    };
    txs.push(tx);
  });
  return txs;
};
export const send = async ({
  rb, from, address, amount, options,
}: sendType) => {
  const base = "BTC";
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