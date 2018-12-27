"use strict";
const Access = {};
/**
 * 必须实现该函数
 * 接口规则：/{webApiRoot}/{Access.store.key}/{Access.store.key.subKey}
 * 接口举例：/{webApiRoot}/picture/upload 或 /{webApiRoot}/user/login
 * @param store 对应{Access.store.key} 如：picture、user
 * @param method 对应{Access.store.key.subKey} 如：upload、login
 * @param req
 * @param onSuccess
 * @param onError
 */
Access.authorize = function (store, method, req, onSuccess, onError) {
    onSuccess();
    // onError();
    // onError(666666, '自定义错误码');
};
/**
 * 必须实现该权限配置
 * fields和mimeType为{Access.store.key.subKey}保留字
 */
Access.store = {
    picture: {
        upload: true,//允许请求接口：/{webApiRoot}/picture/upload
        mimeType: {'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp'}//允许上传的文件的mimeType、后缀
    },
    user: {
        login: true //允许请求接口：/{webApiRoot}/user/login
    }
};
module.exports = Access;