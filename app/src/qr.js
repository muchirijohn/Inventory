var QRCode = require('qrcode')

export function Qr_code(data) {
    QRCode.toDataURL(data)
        .then(url => {
            return url;
        })
        .catch(err => {
            return 'error';
        });
}