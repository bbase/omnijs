import {
    getAtomicValue,
    getConfig,
    transferABI,
} from "app/constants";
import axios from "axios";
import {ethers} from "ethers";
import {
    abi,
    cry,
    RLP,
    Transaction,
} from "thor-devkit";
import { BalancesType, ClauseType, sendType, TransactionType, txParamsType } from "./interfaces";

const BN = require("bn.js");

export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};
export const getTxs = async ({ config, address, rel, base }: txParamsType): Promise<TransactionType[]> => {
    const {api} = getConfig(config, rel, base);
    const txs = [];
    const asset = rel == base ? undefined : config[base].assets[rel];
    const path = rel == base ? "transactions" : "tokenTransfers";

    const data = await axios.get(`${api}/${path}?address=${address}&count=10&offset=0`);
    data.data[path].map((o) => {
        if (base == rel || (asset.hash == o.contractAddress && !o.transaction.reverted)) {
            const tx = {
                from: o.origin,
                hash: rel == base ? o.id : o.txId,
                value: (rel == base ? o.totalValue : Number(ethers.utils.hexlify(o.amount))) / getAtomicValue(config, rel, base),
                kind: o.origin == address ? "sent" : "got",
                fee: 0,
                timestamp: o.timestamp,
            };
            txs.push(tx);
        }
    });

    return txs;
};

export const send = async ({
    rel, base, address, amount, wif, options,
}: sendType): Promise<string> => {
    const { rpc, api } = getConfig(options.config, rel, base);
    const web3 = getWeb3(rpc);

    const clauses =  [{
        to: address,
        value: (new BN(amount).mul(getAtomicValue(options.config, rel, base))).toString(10),
        data: "0x",
    }];
    return sendTransaction(api, clauses, wif);
};
export const sendERC20 = async ({
    base, rel, address, amount, wif, options,
}: sendType): Promise<string> => {
    const { rpc, api } = getConfig(options.config, base, base);
    const web3 = getWeb3(rpc);

    const asset = options.config[base].assets[rel];
    const decimals = getAtomicValue(options.config, rel, base);
    const contract = new ethers.Contract(asset.hash, transferABI, web3);
    const data = contract.methods.transfer(address, new BN(amount).mul(decimals)).encodeABI();

    const clauses: ClauseType[] =  [{
        to: asset.hash,
        value: (0).toString(),
        data,
    }];
    return sendTransaction(api, clauses, wif, 65000);
};

const sendTransaction = async (api: string, clauses: ClauseType[], wif: string, gasLimit?: number): Promise<string> => {
    // const chainTag = await web3.eth.getChainTag();
    // const blockRef = await web3.eth.getBlockRef();

    const gas = gasLimit || Transaction.intrinsicGas(clauses);
    const gasPriceCoef = 128;
    const expiration = 720;
    const body = {
        // chainTag,
        // blockRef,
        expiration,
        clauses,
        gasPriceCoef,
        gas,
        dependsOn: null,
        nonce: Number(new Date()),
    };
    // @ts-ignore
    const tx = new Transaction(body);
    const signingHash = cry.blake2b256(tx.encode());
    const privateKey = new Buffer(wif.substr(2), "hex");
    tx.signature = cry.secp256k1.sign(signingHash, privateKey);

    const raw = tx.encode();
    const res = await axios.post(`${api}/transactions`, { raw: "0x" + raw.toString("hex")});
    return res.data.id;
};
export const getBalance = async ({ config, address, rel, base }: txParamsType): Promise<BalancesType> => {
    const { rpc } = getConfig(config, rel, base);
    const web3 = getWeb3(rpc);

    const b: any = await web3.getBalance(address);
    const e = 0;
    // const e = await web3.getEnergy(address);
    const balances = {};

    balances[base] = { balance: b / getAtomicValue(config, rel, base) };
    balances.VTHO = { balance: e / getAtomicValue(config, "VTHO", base) };
    return balances;
};
