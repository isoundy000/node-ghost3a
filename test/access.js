var Access = {
    auth: function (store, method, req, onSuccess, onError) {
        console.log("我是自定义的权限验证函数");
        onSuccess();
    },
    increment: {
        store: 'increment',
        fields: {
            test1: 10,
            test2: 20,
            test3: 30,
            test4: 40
        }
    },
    store: {
        picture: {
            upload: true,
            mimeType: {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/bmp': 'bmp'
            }
        }
    }
};
module.exports = Access;