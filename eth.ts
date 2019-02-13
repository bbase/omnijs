import {
    getAtomicValue,
    getConfig,
    transferABI,
    ethTransactionType, sendType,
} from "app/constants";
import {ethers} from "ethers";
import { computeAddress } from "ethers/utils";
const BN = require("bn.js");

export const getWallet = ({childNode}) => {
    const wif = "0x" + childNode.privateKey.toString("hex");
    const publicKey = "0x" + childNode.publicKey.toString("hex");
    const address = computeAddress(wif);          

    return {wif, publicKey, address}
}
export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};
export const send = async ({
    rb , from, address, amount, options,
}: sendType): Promise<string> => {
    const { rpc } = getConfig(config, rb);
    const web3 = getWeb3(rpc);
    const txCount = await web3.getTransactionCount(from);
    const transaction: ethTransactionType = {
        nonce: ethers.utils.hexlify(txCount.toString()),
        gasLimit: ethers.utils.hexlify(options.gasLimit.toString()),
        gasPrice: ethers.utils.hexlify(options.gasPrice.toString()),
        to: address,
        from,
        value: ethers.utils.hexlify((new BN(amount).mul(getAtomicValue(config, rb))).toString(10)),
    };
    return sendSignedWeb3(options.wif, transaction, web3);
};

export const sendERC20 = async ({
    rb, from, address, amount, options,
}: sendType): Promise<string>  => {
    const { rpc } = getConfig(config, rb);
    const web3 = getWeb3(rpc);
    const asset = config[rb.base].assets[rb.rel];
    const decimals = getAtomicValue(config, rb);
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
