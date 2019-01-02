import { getAtomicValue, getConfig } from "app/constants";
import axios from "axios";
import {RippleAPI} from "ripple-lib";

export const getBalance = async ({config, address, rel, base}) => {
    const { api, node } = getConfig(config, rel, base);
    const balances = {};
    const data = await axios.get(`${api}/account_info/?node=${node}&address=${address}`);
    if (data.data.result.account_data) {
        balances[rel] = { balance: data.data.result.account_data.Balance / getAtomicValue(config, rel, base) };
    }
    return balances;
};
export const getTxs = async ({ address, rel, base, config }) => {
    const { api } = getConfig(config, rel, base);
    const txs = [];
    const data = await axios.get(`${api}/account_tx?node=test&address=${address}&limit=10`);

    if (data.data.result.transactions) {
        data.data.result.transactions.map((o) => {
            const tx = {
                from: o.tx.Account,
                hash: o.tx.hash,
                confirmations: null,
                value: Number(o.tx.Amount) / getAtomicValue(config, rel, base),
                kind: o.tx.Account.toLowerCase() == address.toLowerCase() ? "sent" : "got",
                fee: o.tx.Fee,
                // https://github.com/ripple/ripple-lib/issues/41
                timestamp: o.tx.date + 946684800,
            };
            txs.push(tx);
        });
    }
    return txs;
};
export const send = async ({
    base, from, rel, address, amount, wif, options,
}) => {
    const { api, node } = getConfig(options.config, base, base);
    let rapi;

    rapi = new RippleAPI({ server: `wss://s.altnet.rippletest.net:51233`});
    await rapi.connect();
    const payment = {
        source: {
            address: from,
            maxAmount: {
                value: amount.toString(),
                currency: rel,
            },
        },
        destination: {
            address: address,
            amount: {
                value: amount.toString(),
                currency: rel,
            },
        },
    };
    const prepared = await rapi.preparePayment(from, payment);

    rapi = new RippleAPI();
    const tx = await rapi.sign(prepared.txJSON, wif);
    const data = await axios.post(`${api}/tx_submit/`, {
        node,
        tx_blob: tx.signedTransaction,
    });
    return data.data.result.tx_json.hash;
};
