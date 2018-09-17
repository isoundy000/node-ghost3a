"use strict";
const Session = function (socket, ip) {
    this.socket = socket;
    this.ip = ip;
    this.uid = ip;
    this.channel = {};
};
Session.prototype.bindUid = function (uid) {
    this.uid = uid;
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
module.exports = Session;