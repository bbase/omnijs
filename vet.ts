import {
    getAtomicValue,
    getConfig,
    transferABI,
    BalancesType, ClauseType, sendType, TransactionType, txParamsType,
} from "app/constants";
import axios from "axios";
import {ethers} from "ethers";

import {
    cry,
    Transaction,
} from "thor-devkit";

const BN = require("bn.js");

export const getWeb3 = (rpc: string): ethers.providers.JsonRpcProvider => {
    return new ethers.providers.JsonRpcProvider(rpc);
};
export const getBalance = async ({ config, address, rb }: txParamsType): Promise<BalancesType> => {
    const { api, energy_ticker } = getConfig(config, rb);

    const data = await axios.get(`${api}/${address}`);
    const balances = {};
    const balance = ethers.utils.bigNumberify(data.data.balance).div(getAtomicValue(config, rb))
    const energy = ethers.utils.bigNumberify(data.data.energy).div(getAtomicValue(config, rb))
    balances[rb.base] = { balance: balance.toNumber() };
    balances[energy_ticker] = { balance: energy.toNumber() };
    return balances;
};

export const getTxs = async ({ config, address, rb }: txParamsType): Promise<TransactionType[]> => {
    const { api } = getConfig(config, rb);
    const txs: TransactionType[] = [];
    const asset = rb.rel == rb.base ? undefined : config[rb.base].assets[rb.rel];
    const path = rb.rel == rb.base ? "transactions" : "tokenTransfers";

    const data = await axios.get(`${api}/${path}?address=${address}&count=10&offset=0`);
    data.data[path].map((o) => {
        if (rb.base == rb.rel || (asset.hash == o.contractAddress && !o.transaction.reverted)) {
            const tx: TransactionType = {
                from: o.origin,
                hash: rb.rel == rb.base ? o.id : o.txId,
                value: (rb.rel == rb.base ? o.totalValue : Number(ethers.utils.hexlify(o.amount))) / getAtomicValue(config, rb),
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
    rb, address, amount, options,
}: sendType): Promise<string> => {
    const { api, chainTag } = getConfig(options.config, rb);

    const clauses =  [{
        to: address,
        value: (new BN(amount).mul(getAtomicValue(options.config, rb))).toString(10),
        data: "0x",
    }];
    return sendTransaction(api, chainTag, clauses, options.wif);
};
export const sendERC20 = async ({
    rb, address, amount, options,
}: sendType): Promise<string> => {
    const { rpc, api, chainTag } = getConfig(options.config, rb);
    const web3 = getWeb3(rpc);

    const asset = options.config[rb.base].assets[rb.rel];
    const decimals = getAtomicValue(options.config, rb);
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
