
module.exports = {

    filterInt: (value) => {
        if (/^[-+]?(\d+|Infinity)$/.test(value)) {
            return Number(value)
        } else {
            return NaN
        }
    }

};