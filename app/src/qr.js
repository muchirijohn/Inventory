var QRCode = require('qrcode')

export function getQr(data) {
    QRCode.toDataURL(data)
        .then(url => {
            return url;
        })
        .catch(err => {
            return 'error';
        });
}