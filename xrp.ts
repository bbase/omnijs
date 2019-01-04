import { 
    getAtomicValue, getConfig,
    sendType, txParamsType, BalancesType, TransactionType
 } from "app/constants";
import axios from "axios";
import * as rsign from 'ripple-sign-keypairs';

export const getBalance = async ({ config, address, rb }: txParamsType): Promise<BalancesType> => {
    const { api, node } = getConfig(config, rb);
    const balances = {};
    const data = await axios.get(`${api}/account_info/?node=${node}&address=${address}`);
    if (data.data.result.account_data) {
        balances[rb.rel] = { balance: data.data.result.account_data.Balance / getAtomicValue(config, rb) };
    }
    return balances;
};
export const getTxs = async ({ address, rb, config }: txParamsType): Promise<TransactionType[]> => {
    const { api } = getConfig(config, rb);
    const txs: TransactionType[] = [];
    const data = await axios.get(`${api}/account_tx?node=test&address=${address}&limit=10`);

    if (data.data.result.transactions) {
        data.data.result.transactions.map((o) => {
            const tx: TransactionType = {
                from: o.tx.Account,
                hash: o.tx.hash,
                confirmations: null,
                value: Number(o.tx.Amount) / getAtomicValue(config, rb),
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
    rb, from, address, amount, options,
}: sendType): Promise<string> => {
    const { api, node } = getConfig(options.config, rb);
    
    const account_info = await axios.post(`${api}`, {"jsonrpc":"2.0","method":"account_info","params":[{
        "account": from,
        "strict": true,
        "ledger_index": "current",
        "queue": true
        }], "id": 1});
    const seq = account_info.data.result.account_data ? account_info.data.result.account_data.Sequence : 1
    const txJSON = {
        Account: from,
        Destination: address,
        TransactionType: "Payment",
        Fee: 12,
        Sequence: seq,
        Flags: 2147483648,
        Amount: amount * getAtomicValue(options.config, rb),
    }
    const signedTransaction = rsign(txJSON, { privateKey: options.wif, publicKey: options.publicKey })
    const data = await axios.post(`${api}/tx_submit/`, {
        node,
        tx_blob: signedTransaction,
    });
    return data.data.result.tx_json.hash;
};