const QRCode = require('qrcode')

function Qrc(data) {
    QRCode.toDataURL(data)
        .then(url => {
            console.log(url);
            return url;
        })
        .catch(err => {
            console.log('error')
            return 'error';
        });
}

module.exports = { Qrc };