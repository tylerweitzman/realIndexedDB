var assert = require('assert');
//var indexedDB = require('../..');
//var FDBOpenDBRequest = require('../../lib/FDBOpenDBRequest');
//var FDBTransaction = require('../../lib/FDBTransaction');
//var InvalidStateError = require('../../lib/errors/InvalidStateError');
var support = require('./support');
var createdb = support.createdb;

describe('W3C Transaction Behavior Tests', function () {
    // transaction-requestqueue
    it('Transactions have a request queue', function (done) {
        var db,
            keys = { txn: [], txn2: [] },
            open_rq = createdb(done)

        open_rq.onupgradeneeded = function(e) {
            var i, os;
            db = e.target.result;

            for (i = 1; i < 6; i++)
            {
                os = db.createObjectStore("os" + i, { autoIncrement: true, keyPath: "k" });
                os.add({ os: "os" + i });
                os.put({ os: "os" + i, k: i});
                os.add({ os: "os" + i });
            }

           assert.deepEqual(db.objectStoreNames, ["os1", "os2", "os3", "os4", "os5" ], "objectStores");
        }

        open_rq.onsuccess = function(e) {
            var txn = db.transaction(["os2", "os1", "os3", "os5"])
            txn.objectStore("os1").openCursor().onsuccess = reg("txn")
            txn.objectStore("os3").openCursor().onsuccess = reg("txn")
            txn.objectStore("os1").get(2).onsuccess = reg("txn")
            txn.objectStore("os2").get(3).onsuccess = reg("txn")

            var txn2 = db.transaction(["os4", "os3", "os1", "os5"])
            var os4 = txn2.objectStore("os4")

            for (var i=0; i < 3; i++) {
                os4.openCursor().onsuccess = reg("txn2")
                os4.get(5).onsuccess = reg("txn2")
                os4.get(4).onsuccess = reg("txn2")
                txn.objectStore("os2").get(1).onsuccess = reg("txn")
                txn2.objectStore("os3").get(1).onsuccess = reg("txn2")
            }

            txn2.objectStore("os1").get(2).onsuccess = reg("txn2")
            txn.objectStore("os1").openCursor(null, "prev").onsuccess = reg("txn")
            os4.openCursor(null, "prev").onsuccess = reg("txn2")

            txn.oncomplete = finish;
            txn2.oncomplete = finish;
        }


        function reg(n) {
            return function (e) {
                var v = e.target.result;
                if (v.value) v = v.value;
                keys[n].push(v.os + ": " + v.k);
            };
        }

        var finish_to_go = 2;
        function finish() {
            if (--finish_to_go)
                return;

            assert.deepEqual(keys['txn'], [
                                   "os1: 1",
                                   "os3: 1",
                                   "os1: 2",
                                   "os2: 3",
                                   "os2: 1", "os2: 1", "os2: 1",
                                   "os1: 2",
                                  ], 'transaction keys');

            assert.deepEqual(keys['txn2'], [
                                   "os4: 1", "os4: 5", "os4: 4", "os3: 1",
                                   "os4: 1", "os4: 5", "os4: 4", "os3: 1",
                                   "os4: 1", "os4: 5", "os4: 4", "os3: 1",
                                   "os1: 2",
                                   "os4: 5",
                                  ], 'transaction 2 keys');

            done();
        }
    });
});
