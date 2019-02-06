import {
    etherscan_api_key,
    getAtomicValue,
    getConfig,
    transferABI,
    BalancesType, ethTransactionType, sendType, ITransactionType, txParamsType,
} from "app/constants";
import axios from "axios";
import {ethers} from "ethers";

const BN = require("bn.js");

export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};
export const send = async ({
    rb , from, address, amount, options,
}: sendType): Promise<string> => {
    const { rpc } = getConfig(options.config, rb);
    const web3 = getWeb3(rpc);
    const txCount = await web3.getTransactionCount(from);
    const transaction: ethTransactionType = {
        nonce: ethers.utils.hexlify(txCount.toString()),
        gasLimit: ethers.utils.hexlify(options.gasLimit.toString()),
        gasPrice: ethers.utils.hexlify(options.gasPrice.toString()),
        to: address,
        from,
        value: ethers.utils.hexlify((new BN(amount).mul(getAtomicValue(options.config, rb))).toString(10)),
    };
    return sendSignedWeb3(options.wif, transaction, web3);
};

export const sendERC20 = async ({
    rb, from, address, amount, options,
}: sendType): Promise<string>  => {
    const { rpc } = getConfig(options.config, rb);
    const web3 = getWeb3(rpc);
    const asset = options.config[rb.base].assets[rb.rel];
    const decimals = getAtomicValue(options.config, rb);
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
    return sendSignedWeb3(options.wif, transaction, web3);
};

export const sendSignedWeb3 = async (wif: string, transaction: ethTransactionType, web3: ethers.providers.JsonRpcProvider): Promise<string> => {
    const wallet = new ethers.Wallet(wif);
    const signedTransaction: string = await wallet.sign(transaction);
    const tx = await web3.sendTransaction(signedTransaction);
    return tx.hash;
};
