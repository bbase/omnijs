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

const Web3 = require("web3");
export const getWeb3 = (rpc) => {
    return thorify(new Web3(), rpc);
}
export const getTxs = async ({ config, address, rel, base }) => {
    const api = getConfig(config, rel, base).api;
    const txs = [];
    
    const data = await axios.get(`${api}/transactions?address=${address}&count=10&offset=0`);
    data.data.transactions.map(o => {
        const tx = {
            from: o.origin,
            hash: o.id,
            value: o.totalValue / getAtomicValue(config, rel, base),
            kind: o.origin == address ? "sent" : "got",
            fee: 0,
            timestamp: o.timestamp,
        };
        txs.push(tx);
    })
    
    return txs;
}

export const send = async ({
    from, rel, address, amount, wif, options
}) => {
    const { rpc } = getConfig(options.config, rel, rel);
    const web3 = getWeb3(rpc)
    
    try{
    const chainTag = await web3.eth.getChainTag();
    const blockRef = await web3.eth.getBlockRef();

    let clauses =  [{
        to: address,
        value: (amount * getAtomicValue(options.config, rel, "VET")).toString(),
        data: '0x'
    }]
    
    const gas = Transaction.intrinsicGas(clauses)
    const gasPriceCoef = 128;
    const expiration = 720;
    let body = {
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
    }catch(e){
        console.log(e)
        throw e;
    }
}

export const sendERC20 = ({
    base, from, rel, address, amount, wif, options
}) => {
    const { rpc } = getConfig(options.config, base, base);
    const web3 = getWeb3(rpc);
    return new Promise(async (resolve, reject) => {
        const asset = options.config[base].assets[rel];

        let contract = new web3.eth.Contract(transferABI, asset.hash);
        const data = contract.methods.transfer(address, amount * (10 ** asset.decimals)).encodeABI();
        const txData = {
            gasLimit: web3.utils.toHex(options.gasLimit.toString()),
            gasPrice: web3.utils.toHex(options.gasPrice.toString()),
            to: asset.hash,
            from: from,
            data: data,
            value: web3.utils.toHex(0),
            expiration: 720,
        }
        sendSignedWeb3(wif, txData, (err, result) => {
            if (err) reject(err)
            resolve(result)
        }, web3)  
    });
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