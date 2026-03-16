import Dexie, { type EntityTable } from 'dexie';

export type TransactionType = 'Debit' | 'Credit' | 'Transfer';
export type TransactionSource = string;

export interface Transaction {
    id?: number;
    title: string;
    amount: number;
    type: TransactionType;
    source: TransactionSource;
    toSource?: TransactionSource;
    category?: 'Need' | 'Want' | 'Other';
    timestamp: string; // Stored as ISO string
}

export interface Account {
    id?: number;
    name: TransactionSource;
    initialBalance: number;
}

const db = new Dexie('PocketLedgerDB') as Dexie & {
    transactions: EntityTable<
        Transaction,
        'id'
    >;
    accounts: EntityTable<
        Account,
        'id'
    >;
};

// Define schema
db.version(1).stores({
    transactions: '++id, title, amount, type, source, timestamp'
});

db.version(2).stores({
    transactions: '++id, title, amount, type, source, timestamp',
    accounts: '++id, &name, initialBalance'
});

db.version(3).stores({
    transactions: '++id, title, amount, type, source, toSource, timestamp',
    accounts: '++id, &name, initialBalance'
});

export { db };
