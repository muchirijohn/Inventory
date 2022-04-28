/**
 * app settings
 */
const { url } = require('inspector');
const path = require('path');

const resPath__ = path.join(__dirname, '..', '/res/data'),
    userPrefs__ = {
        default: 'pref_default.json',
        user: 'pref_user.json'
    },
    userDbs__ = {
        default: 'phi_inventory.db',
        user: 'phi_inventory_user.db'
    };

let  getUserData = {
    uPref: ()=>{
        let url = path.join(resPath__, `/${userPrefs__.user}`);
        return url;
    },

    uDb: ()=>{
        let url = path.join(resPath__, `/${userDbs__.user}`);
        return url;
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
    userPref:  getUserData.uPref(),

    /**
     * user and default databases
     */
    userDbs: userDbs__,

    //default db
    defaultDbPath: path.join(resPath__, `/${userDbs__.default}`),

    //user db
    userDbPath: getUserData.uDb()
};

module.exports = { settings };