"use strict";
const ROUTE_P2P_MSG = 'route_p2p_msg';
const ROUTE_GRP_MSG = 'route_grp_msg';
const ROUTE_GRP_ALL = 'route_all_msg';
const Handler = function (app, router) {
    this.app = app;
    this.router = router;
    this.logger = app.getLogger('router', __filename);
    //加载web接口
    app.webapp.all(app.config.serverConfig.webApiRoot + '/user/login', function (request, response) {
        response.json({code: 200, data: Date.now()});
    });
    //启动websocket路由监听
    // router.start(this, 60000, 60000 * 2);
    router.start(this, 10000, 10000 * 2);
};
Handler.prototype.onLogin = function (session, pack) {
    this.router.bindUid(session, pack.message.uid);
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
    session.socket.terminate();
};
Handler.prototype.onBridgePushP2P = function (session, pack) {
    this.router.bridgesPushP2P('home', pack.message.uid, ROUTE_P2P_MSG, pack.message.context);
};
Handler.prototype.onBridgePushGrp = function (session, pack) {
    this.router.bridgesPushGrp('home', pack.message.gid, ROUTE_GRP_MSG, pack.message.context);
};
Handler.prototype.onBridgePushAll = function (session, pack) {
    this.router.bridgesPushAll('home', ROUTE_GRP_ALL, pack.message.context);
};
Handler.prototype.$_onServerHeart = function () {
    //TODO 此函数将按照心跳检测时间循环运行

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
 * @returns {Handler}
 */
module.exports = function (app, router) {
    return new Handler(app, router);
};