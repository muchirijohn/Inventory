/**
 * app settings
 */
const { url } = require('inspector'),
    path = require('path'),
    fs = require('fs-extra');

const resPath__ = path.join(__dirname, '..', '/res/data'),
    userPrefs__ = {
        default: 'pref_default.json',
        user: 'pref_user.json'
    },
    userDbs__ = {
        default: 'phi_inventory.db',
        user: 'phi_inventory_user.db'
    };

function workingDir() {
    let url = path.join(resPath__, `/${userPrefs__.user}`);
    const u_path = fs.pathExistsSync(url);
    if (u_path === true) {
        app_prefs = fs.readJsonSync(url);
        return app_prefs.dir;
    }
    return path.join(__dirname, '..', '/res');
};

async function copyUserDb(dir = '') {
    var dpath = path.join(resPath__, `/${userDbs__.user}`);
    var wDir = (dir.length > 1 ) ? dir :  workingDir();
    wDir = path.join(wDir, '/data', `/${userDbs__.user}`);
    console.log(wDir)
    const exists = await fs.pathExists(wDir);
    if (exists !== true) {
        await fs.copy(dpath, wDir);
    }
}

let getUserData = {
    uPref: () => {
        let url = path.join(resPath__, `/${userPrefs__.user}`);
        return url;
    },

    uDb: () => {
        wDir = workingDir();
        wDir = path.join(wDir, '/data', `/${userDbs__.user}`);
        console.log(wDir);
        //let url = path.join(resPath__, `/${userDbs__.user}`);
        return wDir;
    }
}

const settings = {

    /**
    * app main directory
    */
    appDir: path.join(__dirname, '..'),

    /**
     * resources/data path
    */
    resPath: resPath__,

    /**
     * user preferences json files
     */
    userPrefs: userPrefs__,

    /**
     * default preferences
     */
    defaultPref: path.join(resPath__, `/${userPrefs__.default}`),

    /**
     * /user preferences
     */
    userPref: getUserData.uPref(),

    /**
     * user and default databases
     */
    userDbs: userDbs__,

    //default db
    defaultDbPath: path.join(resPath__, `/${userDbs__.default}`),

    //user db
    userDbPath: getUserData.uDb(),

    copyUDb: (dir) => { copyUserDb(dir) }
};

module.exports = { settings };