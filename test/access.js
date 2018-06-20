var Access = {};
Access.authorize = function (store, method, req, onSuccess, onError) {
    onSuccess();
    // onError();
    // onError(666666, '自定义错误码');
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