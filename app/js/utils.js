const path = require('path'),
    fs = require('fs-extra'),
    { settings } = require('./settings'),
    { dialogs } = require('./dialogs');
/**
 * utils
 */
var utils = (function utils() {

    /**
     * Check if a number is an integer
     * @param {Integer} value 
     * @returns filtered value
     */
    var filterInt = (value) => {
        if (/^[-+]?(\d+|Infinity)$/.test(value)) {
            return Number(value)
        } else {
            return NaN
        }
    }

    /**
     * read 
     */
    async function readPreferences(fxn) {
        const u_path = await fs.pathExists(settings.userPref);
        var pref_path = u_path ? settings.userPref : settings.defaultPref;
        const d_path = await fs.pathExists(pref_path);
        if (d_path === true) {
            try {
                app_prefs = await fs.readJson(pref_path);
                fxn();
                //mainUi.init();
                //$('#div-main-load span').text('Finalizing...');  
            } catch (err) {
                $('#div-main-load span').text('Error...');
                dialogs.showNotify(['Error', 'Ops! Something under the hood fried!', 'error']);
            }
        } else {
            $('#div-main-load span').text('Error...');
            dialogs.showNotify(['Error', 'Application preferences file is missing!', 'error']);
        }
    }

    return{
        filterInt: filterInt
    }
})();

module.exports = { utils };