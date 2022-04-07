/**
* alert dialogs
*/
var dialogs = (function dialogs() {
    //use sweetalert
    const swal = require('sweetalert');
    /**
     * show a timed dialog message
     * @param {String} msg  message to display
     */
    function showTimerMsg(msg) {
        swal({
            title: msg[0],
            text: msg[1],
            icon: msg[2],
            timer: msg[3],
            showConfirmButton: false,
            allowOutsideClick: true,
            buttons: false
        })
    }

    return {
        showTimerMsg: showTimerMsg
    }
})();

module.exports = { dialogs };
