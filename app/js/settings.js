const path = require('path');

var settings = (function settings() {

    //app main directory
    const appDir = path.join(__dirname, '..');
    //default preferences
    const defaultPref = path.join(__dirname, '..', 'res/data/pref_default.json');
    //user preferences
    const userPref = path.join(__dirname, '..', 'res/data/pref_user.json');

})();

module.exports = { settings };