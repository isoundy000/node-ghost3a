"use strict";
const Handler = function (app, router, servers) {
    this.app = app;
    this.router = router;
    this.servers = servers;
    this.logger = app.getLogger('router', __filename);
    //启动路由监听
    router.start(this, 3000, 30000);
};
Handler.prototype.onLogin = function (session, pack) {
    session.bindUid(pack.message.uid);
    this.router.response(session, pack, '登录成功');
};
Handler.prototype.onJoinRoom = function (session, pack) {
    this.router.joinChannel(session, pack.message.rid);
    this.router.response(session, pack, '进入房间成功');
};
Handler.prototype.onQuitRoom = function (session, pack) {
    this.router.quitChannel(session, pack.message.rid);
    this.router.response(session, pack, '退出房间成功');
};
Handler.prototype.onPushRoom = function (session, pack) {
    this.router.pushChannel(pack.message.rid, 'onPushRoom', '大家好' + new Date());
};
Handler.prototype.onDeleteRoom = function (session, pack) {
    this.router.pushChannel(pack.message.rid, 'onDeleteRoom', '删除前置');
    this.router.deleteChannel(pack.message.rid);
    this.router.pushChannel(pack.message.rid, 'onDeleteRoom', '删除后置');
};
Handler.prototype.onBroadcast = function (session, pack) {
    this.router.broadcast('onBroadcast', '大家好' + new Date());
};
Handler.prototype.onBeClose = function (session, pack) {
    this.router.pushData(session, 'onBeClose', "即将被动关闭");
    // session.socket.close();
    session.socket.terminate();
};
Handler.prototype.$_onServerHeart = function () {
    //同步发生的异常会被router.js捕获
    // let a;
    // a.b;
    //异步发生的异常会被app.js捕获
    // setTimeout(function () {
    //     let a;
    //     a.b;
    // }, 100);
};
/**
 *
 * @param app
 * @param router
 * @param servers
 * @returns {Handler}
 */
module.exports = function (app, router, servers) {
    return new Handler(app, router, servers);
};