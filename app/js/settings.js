const path = require('path');

const app_dir = path.join(__dirname, '..');
const pref_default_path = path.join(__dirname,'..', 'res/data/pref_default.json');
const pref_user_path =  path.join(__dirname, '..', 'res/data/pref_user.json');

module.exports = { app_dir, pref_default_path, pref_user_path };