import { 
    getAtomicValue, getConfig,
    sendType
 } from "app/constants";
import axios from "axios";
import * as rsign from 'ripple-sign-keypairs';
import rplk from "ripple-keypairs";

export const getWallet = ({ childNode }) => {
    const wif = childNode.privateKey.toString(`hex`);
    const publicKey = childNode.publicKey.toString(`hex`);
    const address = rplk.deriveAddress(publicKey);
    
    return {wif, publicKey, address};
}
export const send = async ({
    rb, from, address, amount, options,
}: sendType): Promise<string> => {
    const { api, node } = getConfig(config, rb);
    
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
        Amount: amount * getAtomicValue(config, rb),
    }
    const signedTransaction = rsign(txJSON, { privateKey: options.wif, publicKey: options.publicKey })
    const data = await axios.post(`${api}/tx_submit/`, {
        node,
        tx_blob: signedTransaction,
    });
    return data.data.result.tx_json.hash;
};