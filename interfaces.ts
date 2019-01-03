export interface sendType {
    base?: string;
    from: string;
    rel: string;
    address: string;
    amount: number;
    wif: string;
    options: any;
}
export interface ethTransactionType {
    nonce: string;
    gasLimit: string;
    gasPrice: string;
    to: string;
    from: string;
    data?: string;
    value: string;
}
export interface txParamsType {
    address: string;
    rel: string;
    base: string;
    config: any;
}
export interface TransactionType {
    from: string;
    hash: string;
    confirmations: number;
    value: number;
    kind: string;
    fee: number;
    timestamp: number;
    asset: any;
}
export interface BalanceType {
    balance: number;
    pending?: number;
}
export interface BalancesType {
    [key: string]: BalanceType;
}
export interface ClauseType {
    to: string;
    value: string;
    data: string;
}
export interface WalletType {
    wif: string;
    address: string;
    publicKey: string;
}