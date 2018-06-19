var Access = {};
Access.auth = function (store, method, req, onSuccess, onError) {
    onSuccess();
};
Access.store = {
    picture: {
        upload: true,
        mimeType: {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/bmp': 'bmp'
        }
    }
};
module.exports = Access;