import { rpc, sc, u, wallet } from "@cityofzion/neon-core";
import * as api from "@cityofzion/neon-api";
import {
    getConfig, txParamsType, BalancesType, TransactionType, sendType,
} from "app/constants";
import axios from "axios";


export const getBalance = async ({ rb, config, address }: txParamsType): Promise<BalancesType> => {
    const api = getConfig(config, rb).api;
    const balances = {};

    const data = await axios.get(`${api}/get_balance/${address}`);
    data.data.balance.map((o) => {
        balances[o.asset] = { balance: o.amount, isNeo: true };
    });
    return balances;
};

export const getTxs = async ({ config, address, rb }: txParamsType): Promise<TransactionType[]> => {
    const { api } = getConfig(config, rb);
    const txs: TransactionType[] = [];
    const data = await axios.get(`${api}/get_address_abstracts/${address}/0`);

    data.data.entries.map((o) => {
        const tx: TransactionType = {
            from: o.address_from,
            hash: o.txid,
            confirmations: null,
            value: o.amount,
            kind: o.address_from.toLowerCase() == address.toLowerCase() ? "sent" : "got",
            fee: 0,
            timestamp: o.time,
            asset: config[rb.base].assets[o.asset] ? config[rb.base].assets[o.asset] : null,
        };
        txs.push(tx);
    });
    return txs;
};

export const send = async ({
    rb, from, address, amount, options,
}: sendType): Promise<string> => {
    const { api } = getConfig(options.config, rb);
    const balance = (await axios.get(`${api}/get_balance/${address}`)).data;
    const result = await sendTransaction([{ amount: amount.toString(), address, symbol: rb.rel }],
        {
            balances: balance,
            wif: options.wif,
            address: from,
            publicKey: options.publicKey,
            fees: options.fees,
            base: rb.base,
        });
    return result.txid;
};

// @ts-ignore
Array.prototype.flatMap = function(lambda) {
    return Array.prototype.concat.apply([], this.map(lambda));
};

type NetworkType = string;
type SymbolType = string;

interface SendEntryType {
    amount: string;
    address: string;
    symbol: SymbolType;
}
interface TokenBalanceType {
    symbol: SymbolType;
    balance: string;
    scriptHash: string;
    totalSupply: number;
    decimals: number;
    name: string;
}

const isToken = (symbol: SymbolType) => !["NEO", "GAS"].includes(symbol);

const extractTokens = (sendEntries: SendEntryType[]) => {
    return sendEntries.filter(({ symbol }) => isToken(symbol));
};

const extractAssets = (sendEntries: SendEntryType[]) => {
    return sendEntries.filter(({ symbol }) => !isToken(symbol));
};

const buildIntents = (sendEntries: SendEntryType[]) => {
    const assetEntries = extractAssets(sendEntries);
    // @ts-ignore
    return assetEntries.flatMap(({ address, amount, symbol }) =>
        api.makeIntent(
            {
                [symbol]: amount,
            },
            address,
        ),
    );
};

const buildTransferScript = (
    net: NetworkType,
    sendEntries: SendEntryType[],
    fromAddress: string,
    tokensBalanceMap: {
        [key: string]: TokenBalanceType,
    },
) => {
    const tokenEntries = extractTokens(sendEntries);
    const fromAcct = new wallet.Account(fromAddress);
    const scriptBuilder = new sc.ScriptBuilder();

    tokenEntries.forEach(({ address, amount, symbol }) => {
        const toAcct = new wallet.Account(address);
        const { scriptHash, decimals } = tokensBalanceMap[symbol];
        const args = [
            u.reverseHex(fromAcct.scriptHash),
            u.reverseHex(toAcct.scriptHash),
            sc.ContractParam.byteArray(amount, "fixed8", decimals),
        ];

        scriptBuilder.emitAppCall(scriptHash, "transfer", args);
    });

    return scriptBuilder.str;
};

const makeRequest = (sendEntries: SendEntryType[], config: any) => {
    const script = buildTransferScript(
        config.net,
        sendEntries,
        config.address,
        config.tokensBalanceMap,
    );
    const intents = buildIntents(sendEntries);
    if (script === "") {
        return api.sendAsset({ ...config, intents });
    } else {
        return api.doInvoke({
            ...config,
            intents,
            script,
            gas: 0,
        });
    }
};

export const sendTransaction = async (sendEntries: SendEntryType[], opts) => {
    const wif = opts.wif;
    const fromAddress = opts.address;
    const publicKey = opts.publicKey;

    const url = `${opts.config[opts.base].explorer}/api/main_net`
    const net = new rpc.Network({
        name: "Net",
        extra: {
            neoscan: url,
        },
    });
    
    //Neon.add.network(net);
    const netNeoscan = new api.neoscan.instance(url);
    const { response } = await makeRequest(sendEntries, {
        net,
        tokensBalanceMap: opts.balances,
        address: fromAddress,
        publicKey,
        fees: opts.fees,
        account: new wallet.Account(wif),
        privateKey: new wallet.Account(wif).privateKey,
        signingFunction: null,
        api: netNeoscan,
    });
    if (!response.result) {
        throw new Error("Failed");
    }
    return response;
};
