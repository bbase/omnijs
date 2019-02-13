import {
    getAtomicValue,
    getConfig,
    transferABI,
    ClauseType, sendType
} from "app/constants";
import axios from "axios";
import {ethers} from "ethers";

import {
    cry,
    Transaction,
} from "thor-devkit";
export {getWallet} from "./eth"
const BN = require("bn.js");

export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};

export const send = async ({
    rb, address, amount, options,
}: sendType): Promise<string> => {
    const { api, chainTag } = getConfig(config, rb);

    const clauses =  [{
        to: address,
        value: (new BN(amount).mul(getAtomicValue(config, rb))).toString(10),
        data: "0x",
    }];
    return sendTransaction(api, chainTag, clauses, options.wif);
};
export const sendERC20 = async ({
    rb, address, amount, options,
}: sendType): Promise<string> => {
    const { rpc, api, chainTag } = getConfig(config, rb);
    const web3 = getWeb3(rpc);

    const asset = config[rb.base].assets[rb.rel];
    const decimals = getAtomicValue(config, rb);
    const contract = new ethers.Contract(asset.hash, transferABI, web3);
    const data = contract.methods.transfer(address, new BN(amount).mul(decimals)).encodeABI();

    const clauses: ClauseType[] =  [{
        to: asset.hash,
        value: (0).toString(),
        data,
    }];
    return sendTransaction(api, chainTag, clauses, options.wif, 65000);
};

const sendTransaction = async (api: string, chainTag: number, clauses: ClauseType[], wif: string, gasLimit?: number): Promise<string> => {
    const data = await axios.get(`${api}/blocks/best`);
    const blockRef = data.data.id.slice(0, 18); // first 16 bytes of best block id in hex

    const gas = gasLimit || Transaction.intrinsicGas(clauses);
    const gasPriceCoef = 128;
    const expiration = 720;
    const body = {
        chainTag,
        blockRef,
        expiration,
        clauses,
        gasPriceCoef,
        gas,
        dependsOn: null,
        nonce: Number(new Date()),
    };
    const tx = new Transaction(body);
    const signingHash = cry.blake2b256(tx.encode());
    const privateKey = new Buffer(wif.substr(2), "hex");
    tx.signature = cry.secp256k1.sign(signingHash, privateKey);

    const raw = tx.encode();
    const res = await axios.post(`${api}/transactions`, { raw: "0x" + raw.toString("hex")});
    return res.data.id;
};
