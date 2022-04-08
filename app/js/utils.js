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

    return{
        filterInt: filterInt
    }
})();

module.exports = { utils };