
/**
 * utils
 */
module.exports = {

    /**
     * Check if a number is an integer
     * @param {Integer} value 
     * @returns filtered value
     */
    filterInt: (value) => {
        if (/^[-+]?(\d+|Infinity)$/.test(value)) {
            return Number(value)
        } else {
            return NaN
        }
    }

};