const QRCode = require('qrcode')

const options = {
    errorCorrectionLevel: 'H',
    type: 'image/jpeg',
    quality: 0.3,
    margin: 1,
    color: {
      dark:"#036574ff",
      light:"#fafafaff"
    }
  }

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
        return QRCode.toDataURL(data, options);
    } catch (err) {
        return 'error';
    }
}

module.exports = { Qrc, Qrc_async};