import {
    etherscan_api_key,
    getAtomicValue,
    getConfig,
    transferABI,

} from "app/constants";
import axios from "axios";
import {ethers} from "ethers";
import { BalancesType, ethTransactionType, sendType, TransactionType, txParamsType } from "./interfaces";

const BN = require("bn.js");

export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};
export const send = async ({
    from, rel, address, amount, wif, options,
}: sendType): Promise<string> => {
    const { rpc } = getConfig(options.config, rel, rel);
    const web3 = getWeb3(rpc);
    const txCount = await web3.getTransactionCount(from);
    const transaction: ethTransactionType = {
        nonce: ethers.utils.hexlify(txCount.toString()),
        gasLimit: ethers.utils.hexlify(options.gasLimit.toString()),
        gasPrice: ethers.utils.hexlify(options.gasPrice.toString()),
        to: address,
        from,
        value: ethers.utils.hexlify((new BN(amount).mul(getAtomicValue(options.config, rel, rel))).toString(10)),
    };
    return sendSignedWeb3(wif, transaction, web3);
};

export const sendERC20 = async ({
    base, from, rel, address, amount, wif, options,
}: sendType): Promise<string>  => {
    const { rpc } = getConfig(options.config, base, base);
    const web3 = getWeb3(rpc);
    const asset = options.config[base].assets[rel];
    const decimals = getAtomicValue(options.config, rel, base);
    const contract = new ethers.Contract(asset.hash, transferABI, web3);
    const data = contract.transfer(address, new BN(amount).mul(decimals)).encodeABI();

    const txCount = await web3.getTransactionCount(from);
    const transaction: ethTransactionType = {
        nonce: ethers.utils.hexlify(txCount.toString()),
        gasLimit: ethers.utils.hexlify(options.gasLimit.toString()),
        gasPrice: ethers.utils.hexlify(options.gasPrice.toString()),
        to: asset.hash,
        from,
        data,
        value: ethers.utils.hexlify(0),
    };
    return sendSignedWeb3(wif, transaction, web3);
};

export const sendSignedWeb3 = async (wif: string, transaction: ethTransactionType, web3: ethers.providers.JsonRpcProvider): Promise<string> => {
    const wallet = new ethers.Wallet(wif);
    const signedTransaction: string = await wallet.sign(transaction);
    const tx = await web3.sendTransaction(signedTransaction);
    return tx.hash;
};

export const getTxs = async ({ address, rel, base, config }: txParamsType): Promise<TransactionType[]> => {
    const { api } = getConfig(config, base, base);
    const txs = [];

    let isErc20 = false;
    if (rel != base) { isErc20 = true; }

    const data = await axios.get(`${api}/?module=account&action=${isErc20 ? "tokentx" : "txlist" }&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${etherscan_api_key}`);
    const decimals = getAtomicValue(config, base, base);

    data.data.result.map((o) => {
        const tx: TransactionType = {
            from: o.from,
            hash: o.hash,
            confirmations: o.confirmations,
            value: isErc20 ? o.value / 10 ** o.tokenDecimal : o.value / decimals,
            kind: o.from.toLowerCase() == address.toLowerCase() ? "sent" : "got",
            fee: (o.gas * o.gasPrice) / decimals,
            timestamp: o.timeStamp,
            asset: config[base].assets[o.tokenSymbol] ? config[base].assets[o.tokenSymbol] : null,
        };

        txs.push(tx);
    });
    return txs;
};

export const getBalance = async ({ config, address, rel, base }: txParamsType): Promise<BalancesType> => {
    const { rpc, api_tokens } = getConfig(config, rel, base);
    const web3 = getWeb3(rpc);

    const balances = {};
    const tokens = [];
    for (const x in config[base].assets) {
        tokens.push(config[base].assets[x].hash);
    }
    const data0 = await axios.post(`${api_tokens}`, {address, tokens});
    let i = 0;
    for (const x in config[base].assets) {
        const c = config[base].assets[x];
        const v = data0.data[i][c.hash];
        balances[x] = { balance: v / getAtomicValue(config, x, base) };
        i++;
    }
    const b: any = await web3.getBalance(address);
    balances[base] = { balance: b / getAtomicValue(config, rel, base) };
    return balances;
};
