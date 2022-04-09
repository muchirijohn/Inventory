const swal = require('sweetalert');

/**
* alert dialogs
*/
var dialogs = (function dialogs() {
    /**
     * show notofication dialog
     * @param {Array} msg 
     */
    function notify(msg) {
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
    function msgTimer(msg) {
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

    /**
     * show a confirm notification
     * @param {Array} msg Array object containing the message to display
     * @param {Function} fxn_confirm confirm function
     * @param {Function} fxn_cancel cancel function
     */
    function confirm(msg, fxn_confirm, fxn_cancel = null) {
        swal({
            title: msg.title,
            text: msg.text,
            icon: msg.icon,
            buttons: msg.buttons,
            dangerMode: msg.dangerMode,
        }).then((confirm_) => {
            if (confirm_) {
                fxn_confirm();
            } else {
                if (typeof (fxn_cancel) === 'function') {
                    fxn_cancel();
                }
            }
        });
    }

    return {
        notify: notify,
        msgTimer: msgTimer,
        confirm: confirm
    }
})();

module.exports = { dialogs };
