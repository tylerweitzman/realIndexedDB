import FDBCursor from "./FDBCursor";
import FDBCursorWithValue from "./FDBCursorWithValue";
import FDBKeyRange from "./FDBKeyRange";
import FDBObjectStore from "./FDBObjectStore";
import FDBRequest from "./FDBRequest";
const {InvalidStateError, TransactionInactiveError} = require("./lib/errors");
import Index from "./lib/Index";
import structuredClone from "./lib/structuredClone";
import {FDBCursorDirection, Key, KeyPath} from "./lib/types";
import validateKey from "./lib/validateKey";

const confirmActiveTransaction = (index: FDBIndex) => {
    if (!index.objectStore.transaction._active) {
        throw new TransactionInactiveError();
    }

    if (index._rawIndex.deleted || index.objectStore._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#idl-def-IDBIndex
class FDBIndex {
    public _rawIndex: Index;
    public name: string;
    public objectStore: FDBObjectStore;
    public keyPath: KeyPath;
    public multiEntry: boolean;
    public unique: boolean;

    constructor(objectStore: FDBObjectStore, rawIndex: Index) {
        this._rawIndex = rawIndex;

        this.name = rawIndex.name;
        this.objectStore = objectStore;
        this.keyPath = rawIndex.keyPath;
        this.multiEntry = rawIndex.multiEntry;
        this.unique = rawIndex.unique;
    }

    // tslint:disable-next-line max-line-length
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openCursor-IDBRequest-any-range-IDBCursorDirection-direction
    public openCursor(range: FDBKeyRange | Key | null | void, direction: FDBCursorDirection) {
        confirmActiveTransaction(this);

        if (range === null) { range = undefined; }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(structuredClone(validateKey(range)));
        }

        const request = new FDBRequest();
        request.source = this;
        request.transaction = this.objectStore.transaction;

        const cursor = new FDBCursorWithValue(this, range, direction, request);

        return this.objectStore.transaction._execRequestAsync({
            operation: cursor._iterate.bind(cursor),
            request,
            source: this,
        });
    }

    // tslint:disable-next-line max-line-length
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openKeyCursor-IDBRequest-any-range-IDBCursorDirection-direction
    public openKeyCursor(range: FDBKeyRange | Key | null | void, direction: FDBCursorDirection) {
        confirmActiveTransaction(this);

        if (range === null) { range = undefined; }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(structuredClone(validateKey(range)));
        }

        const request = new FDBRequest();
        request.source = this;
        request.transaction = this.objectStore.transaction;

        const cursor = new FDBCursor(this, range, direction, request);

        return this.objectStore.transaction._execRequestAsync({
            operation: cursor._iterate.bind(cursor),
            request,
            source: this,
        });
    }

    public get(key: FDBKeyRange | Key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.objectStore.transaction._execRequestAsync({
            operation: this._rawIndex.getValue.bind(this._rawIndex, key),
            source: this,
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-getKey-IDBRequest-any-key
    public getKey(key: FDBKeyRange | Key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.objectStore.transaction._execRequestAsync({
            operation: this._rawIndex.getKey.bind(this._rawIndex, key),
            source: this,
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-count-IDBRequest-any-key
    public count(key: FDBKeyRange | Key | null | void) {
        confirmActiveTransaction(this);

        if (key === null) { key = undefined; }
        if (key !== undefined && !(key instanceof FDBKeyRange)) {
            key = FDBKeyRange.only(structuredClone(validateKey(key)));
        }

        return this.objectStore.transaction._execRequestAsync({
            operation: () => {
                let count = 0;

                const cursor = new FDBCursor(this, key);
                while (cursor._iterate() !== null) {
                    count += 1;
                }

                return count;
            },
            source: this,
        });
    }

    public toString() {
        return "[object IDBIndex]";
    }
}

export default FDBIndex;