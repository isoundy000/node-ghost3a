"use strict";
let increment = 1;
const Session = function (socket, ip) {
    this.id = increment++;//自增id
    this.socket = socket;//绑定的套接字
    this.ip = ip;//绑定的IP地址
    this.uid = null;//绑定的用户ID
    this.context = {};//缓存的自定义数据
    this.channel = {};//加入的自定义群组
    this.hearted = Date.now();//最近收到心跳包的时间
    this.socket.session = this;//绑定本实例到socket
};
Session.prototype.bindUid = function (uid) {
    this.uid = uid;
};
Session.prototype.setContext = function (key, value) {
    this.context[key] = value;
};
Session.prototype.getContext = function (key) {
    return this.context[key];
};
Session.prototype.delContext = function (key) {
    delete this.context[key];
};
Session.prototype.joinChannel = function (gid) {
    this.channel[gid] = true;
};
Session.prototype.quitChannel = function (gid) {
    delete this.channel[gid];
};
Session.prototype.eachChannel = function (callback) {
    for (let key in this.channel) {
        callback(key);
    }
};
Session.prototype.resetHeart = function () {
    this.hearted = Date.now();
};
Session.prototype.isExpired = function (timeout) {
    return Date.now() > this.hearted + timeout;
};
module.exports = Session;