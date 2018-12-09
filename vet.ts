import axios from 'axios';
import {
    getConfig,
    getAtomicValue,
    transferABI,
} from 'app/constants';
import { thorify } from "thorify";
import { sendSignedWeb3 } from './eth';
import {
    cry,
    abi,
    RLP,
    Transaction
} from 'thor-devkit'
import BigNumber from 'bignumber.js'
import web3Utils from 'web3-utils';

const Web3 = require("web3");
export const getWeb3 = (rpc) => {
    return thorify(new Web3(), rpc);
}
export const getTxs = async ({ config, address, rel, base }) => {
    const {api} = getConfig(config, rel, base);
    const txs = [];
    const asset = rel == base ? undefined : config[base].assets[rel];
    const path = rel == base ? 'transactions' : 'tokenTransfers';
    
    const data = await axios.get(`${api}/${path}?address=${address}&count=10&offset=0`);
    data.data[path].map(o => {
        if(base == rel || (asset.hash == o.contractAddress && !o.transaction.reverted) ){
            const tx = {
                from: o.origin,
                hash: rel == base ? o.id : o.txId,
                value: (rel == base ? o.totalValue : Number(web3Utils.hexToNumberString(o.amount)) ) / getAtomicValue(config, rel, base),
                kind: o.origin == address ? "sent" : "got",
                fee: 0,
                timestamp: o.timestamp,
            };
            txs.push(tx);
        }
    })
    
    return txs;
}

export const send = async ({
    from, rel, base, address, amount, wif, options
}) => {
    const { rpc } = getConfig(options.config, rel, rel);
    const web3 = getWeb3(rpc)    

    let clauses =  [{
        to: address,
        value: (new BigNumber(amount).times(getAtomicValue(options.config, rel, base))).toString(10),
        data: '0x'
    }]
    return await sendTransaction({clauses, web3, wif, gasLimit: null });
}
export const sendERC20 = async ({
    base, from, rel, address, amount, wif, options
}) => {
    const { rpc } = getConfig(options.config, base, base);
    const web3 = getWeb3(rpc);

    const asset = options.config[base].assets[rel];
    const decimals = getAtomicValue(options.config, rel, base);
    const contract = new web3.eth.Contract(transferABI, asset.hash);
    const data = contract.methods.transfer(address, new BigNumber(amount).times(decimals) ).encodeABI();

    let clauses =  [{
        to: asset.hash,
        value: (0).toString(),
        data,
    }]
    return await sendTransaction({clauses, web3, wif, gasLimit: 65000 });
}

const sendTransaction = async ({clauses, web3, wif, gasLimit }) => {
    const chainTag = await web3.eth.getChainTag();
    const blockRef = await web3.eth.getBlockRef();

    const gas = gasLimit || Transaction.intrinsicGas(clauses)
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
    }
    let tx = new Transaction(body)
    let signingHash = cry.blake2b256(tx.encode())
    const privateKey = new Buffer(wif.substr(2), 'hex')
    tx.signature = cry.secp256k1.sign(signingHash, privateKey)

    let raw = tx.encode()
    const res = await web3.eth.sendSignedTransaction('0x' + raw.toString('hex'))
    return res.transactionHash    
}
export const getBalance = async ({ config, address, rel, base }) => {
    const { rpc } = getConfig(config, rel, base);
    const web3 = getWeb3(rpc);
    
    const b = await web3.eth.getBalance(address);
    const e = await web3.eth.getEnergy(address);
    let balances = {};
    
    balances[base] = { balance: b / getAtomicValue(config, rel, base) };
    balances["VTHO"] = { balance: e / getAtomicValue(config, "VTHO", base) };
    return balances;
}