const path = require('path'),
    fs = require('fs-extra'),
    { settings } = require('./settings'),
    { dialogs } = require('./dialogs');
/**
     * database
     */
var database = (function database() {
    var sqlite3 = require('sqlite3').verbose();
    var db = null;

    /**
     * connect database
     */
    function dbConnect() {
        //check if to switch to user db
        var db_url = settings.defaultDbPath;
        //file
        var file = settings.userDbPath;
        //path exists
        const exists = fs.pathExistsSync(file);
        if (exists) db_url = file;
        //connect db
        db = new sqlite3.Database(db_url, (err) => {
            if (err) {
                console.error(err.message);
                return false;
            }
            //console.log('Connected to the database successfully');
            return true;
        });
    }

    /**
     * fetch all parts from the database
     * @param {String} sql 
     */
    function dbFetchParts(sql, fxn) {
        if (db === null) dbConnect();
        db.serialize(function () {
            db.all(sql, [], (err, rows) => {
                if (!err) {
                    //listUi.generateList(rows);
                    fxn(rows);
                }
            });
        });
    }

    /**
     * find/search parts
     * @param {manufacturer part number} manf 
     */
    function dbSearch(part, key, fxn) {
        var sql = "";
        if (db === null) dbConnect();
        db.serialize(function () {
            //search part number and description
            if (part) sql = `SELECT * FROM parts WHERE manf_part_no LIKE '%${key}%' OR description LIKE '%${key}%' OR specs LIKE '%${key}%'`;
            else sql = `SELECT * FROM parts WHERE type='${key}'`;
            db.all(sql, [], (err, rows) => {
                if (!err) {
                    //console.log(rows);
                    //listUi.generateList(rows);
                    fxn(rows);
                }
            });
        });
    }

    /**
     * execute sql statement
     * @param {string} sql 
     */
    function dbRunSavePartQuery(sql, isNew) {
        if (db === null) dbConnect();
        db.serialize(function () {
            db.run(sql, [], (err) => {
                if (err) {
                    console.log(err)
                    dialogs.showNotify(["Error", "Failed to save Part. Please verify all the fields", "error"]);
                } else {
                    dialogs.showNotify(["Success", `Successfully ${isNew ? 'added' : 'edited'} part`, "success"]);
                }
            });
        });
    }


    /**
     * fetch log from db matching the given id
     * @param {string} id 
     */
    function dbFetchLogs(id, fxn) {
        if (db === null) dbConnect();
        db.serialize(function () {
            let sql = `SELECT * FROM logs WHERE part_id='${id}'`;
            db.all(sql, [], (err, rows) => {
                if (!err) {
                    fxn(rows);
                    //partAddEditUi.createDBLogs(rows);
                }
            });
        });
    }

    /**
     * save part log
     * @param {sql statement} sql 
     */
    function dbRunSaveLog(log, stock = -1) {
        if (db === null) dbConnect();
        var sql = `INSERT INTO logs
            (part_id,user,date,quantity,state,desc)
            VALUES
            ('${log[0]}','${log[1]}','${log[2]}','${log[3]}','${log[4]}','${log[5]}')`;
        db.serialize(function () {
            db.run(sql, [], (err) => {
                if (err) {
                    dialogs.showNotify(["Error", "Failed to save log.", "error"]);
                } else {
                    fxn(log);
                    //partAddEditUi.createlog(log);
                }
            });
            if (stock !== -1) {
                sql = `UPDATE parts SET stock='${stock}' WHERE id='${log[0]}'`;
                db.run(sql, [], (err) => {
                    if (err) {
                        dialogs.showNotify(["Error", "Failed to update stock.", "error"]);
                    }
                });
            }
        });
    }

    /**
     * delete a log from part logs
     * @param {array} qry 
     * @param {function} fxn 
     */
    function dbDeleteLog(qry, fxn) {
        if (db === null) dbConnect();
        var sql = `DELETE FROM logs WHERE
        part_id='${qry[0]}' AND date='${qry[1]}'`;
        db.serialize(function () {
            db.run(sql, [], (err) => {
                if (err) {
                    dialogs.showNotify(["Error", "Failed to delete log.", "error"]);
                } else {
                    fxn();
                }
            });
        });
    }

    /**
     * delete part from db
     * @param {string} id 
     * @param {function} fxn 
     */
    function dbDeletePart(id, fxn) {
        if (db === null) dbConnect();
        //delete part
        var sql = `DELETE FROM parts WHERE id='${id}'`;
        db.serialize(function () {
            db.run(sql, [], (err) => {
                if (err) {
                    dialogs.showNotify(["Error", "Failed to delete part.", "error"]);
                } else {
                    //delete logs
                    var sql = `DELETE FROM logs WHERE part_id='${id}'`;
                    db.serialize(function () {
                        db.run(sql, [], (err) => {
                            if (err) {
                                dialogs.showNotify(["Error", "Failed to delete logs.", "error"]);
                            } else {
                                fxn();
                            }
                        });
                    });
                }
            });


        });
    }

    /**
     * close db
     */
    function dbClose() {
        if (db !== null) {
            db.close((err) => {
                if (err) {
                    return console.error(err.message);
                }
                console.log('Database closed.');
                db = null;
            });
        }
    }

    /**
     * create user db
     */
    async function createUserDb() {
        var file = settings.userDbPath;
        const exists = await fs.pathExists(file);
        if (exists !== true) {
            await fs.copy(settings.defaultDbPath, settings.userDbPath);
            db = null;
        }
    }

    /**
     * set part storage location
     * @param {String} sql 
     */
    async function dbSetPartStorage() {
        if (db === null) dbConnect();
        db.serialize(function () {
            //check storage field in db
            let csql = `SELECT storage FROM parts LIMIT 1`;
            db.all(csql, [], (err, rows) => {
                if (err) {
                    //add field if not exists
                    csql = 'ALTER table parts ADD COLUMN storage TEXT';
                    db.run(csql, [], (err) => {
                        if (err) {
                            console.log(err);
                        } else {
                            dialogs.showNotify(["Success", "Database updated. Please Restart application!", "success"]);
                        }
                    });
                }
            });
        });
    }

    function init() {
        createUserDb();
        dbSetPartStorage();
    }

    return {
        init: init,
        dbConnect: dbConnect,
        dbFetchParts: dbFetchParts,
        dbSearch: dbSearch,
        dbRunSavePartQuery: dbRunSavePartQuery,
        dbSetPartStorage: dbSetPartStorage,
        dbDeletePart: dbDeletePart,
        dbFetchLogs: dbFetchLogs,
        dbRunSaveLog: dbRunSaveLog,
        dbDeleteLog: dbDeleteLog,
        dbClose: dbClose
    }
})();


module.exports = { database };