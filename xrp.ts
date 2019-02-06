import { 
    getAtomicValue, getConfig,
    sendType
 } from "app/constants";
import axios from "axios";
import * as rsign from 'ripple-sign-keypairs';

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
        ITransactionType: "Payment",
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