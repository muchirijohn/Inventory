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

async function Qrc_async(data) {
    try {
        return await QRCode.toDataURL(data);
    } catch (err) {
        return 'error';
    }
}

module.exports = { Qrc, Qrc_async};