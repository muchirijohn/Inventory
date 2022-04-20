var packager = require('electron-packager');
var options = {
    'arch': 'x64',
    'platform': 'win32',
    'dir': './',
    'app-copyright': 'Muchiri John',
    'app-version': '1.0.6',
    'appname': 'Inventory',
    'asar': false,
    'icon': './app/res/data/icon.png',
    'name': 'Inventory',
    'ignore': ['./releases', './.git'],
    'out': './releases',
    'overwrite': true,
    'prune': true,
    'version': '1.0.6',
    'electron-version': '17.1.0',
    'version-string':{
      'CompanyName': 'Muchiri John',
      'FileDescription': 'Inventory',
      'OriginalFilename': 'Inventory',
      'ProductName': 'Inventory',
      'InternalName': 'Inventory'
    }
};
packager(options, function callback(err, appPaths) {
    console.log(err);
    console.log(appPaths);
});