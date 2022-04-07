const swal = require('sweetalert');

/**
* alert dialogs
*/
var dialogs = (function dialogs() {
    /**
     * show notofication dialog
     * @param {Array} msg 
     */
     function showNotify(msg) {
        let title = msg[0], 
        message = msg[1],
        icon = msg[2];
        //show notification
        swal(title, message, icon);
    }


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
        showNotify: showNotify,
        showTimerMsg: showTimerMsg
    }
})();

module.exports = { dialogs };
