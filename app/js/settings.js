/**
 * app settings
 */
const path = require('path');

const resPath__ = path.join(__dirname, '..', '\\res\\data'),
    userPrefs__ = {
        default: 'pref_default.json',
        user: 'pref_user.json'
    },
    userDbs__ = {
        default: 'phi_inventory.db',
        user: 'phi_inventory_user.db'
    };


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
    defaultPref: path.join(resPath__, `\\${userPrefs__.default}`),

    /**
     * /user preferences
     */
    userPref: path.join(resPath__, `\\${userPrefs__.user}`),

    /**
     * user and default databases
     */
    userDbs: userDbs__,

    //default db
    defaultDbPath: path.join(resPath__, `\\${userDbs__.default}`),

    //user db
    userDbPath: path.join(resPath__, `\\${userDbs__.user}`)
};

module.exports = { settings };