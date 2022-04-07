const swal = require('sweetalert');

/**
* alert dialogs
*/
var dialogs = (function dialogs() {
    
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
