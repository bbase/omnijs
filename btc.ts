import { getAtomicValue, getConfig, toBitcoinJS } from "app/constants";
import axios from "axios";
import bitcoin from "bitcoinjs-lib";

export const getUtxos = async ({ config, rel, address }) => {
  const data = await axios.post(`${getConfig(config, rel, "BTC").api}/addrs/utxo`, {
    addrs: address,
  });
  return data.data;
};
export const broadcastTx = async ({
  from,
  rel,
  utxos,
  to,
  amount,
  wif,
  fee,
  config,
}) => {
    const network = toBitcoinJS(config[rel].network);
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
    const data = await axios.post(`${getConfig(config, rel, "BTC").api}/tx/send`, {
      rawtx,
    });
    return data.data.txid;
};

export const send = async ({
  from, rel, address, amount, wif, options,
}) => {
  const base = "BTC";
  const multiply_by = rel == "BTC" ? 1 : getAtomicValue(options.config, rel, base);
  const utxos = await getUtxos({ config: options.config, rel, address: from });
  const txid = await broadcastTx({
    utxos,
    from,
    to: address,
    amount: amount * getAtomicValue(options.config, rel, base),
    wif,
    fee: options.fees * multiply_by,
    rel,
    config: options.config,
  });
  return txid;
};

export const getTxs = async ({config, address, rel, base}) => {
  const api = getConfig(config, rel, base).api;
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
export const getBalance = async ({config, rel, base, address}) => {
  const api = getConfig(config, rel, base).api;
  const data = await axios.get(`${api}/addr/${address}`);
  const balance = data.data.balance;
  return { [rel]: { balance } };
};
