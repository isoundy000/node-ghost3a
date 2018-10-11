"use strict";
const Session = require('./session');
const HEARTICK = '$heartick$';
const RESPONSE = '$response$';
const NOSYNTAX = '$nosyntax$';
const Router = function (app) {
    this.app = app;
    this.logger = app.getLogger('router', __filename);
    this.handler = {};//自定义路由
    this.channel = {};//客户端分组
    this.ticker = null;//心跳检测器
};
Router.prototype.start = function (hander, heart, timeout) {
    const self = this;
    self.handler = hander || self.handler;
    self.app.wssapp.on('connection', function (socket, request) {
        //创建会话
        const session = new Session(socket, self.app.getIPV4({
            ip: request.connection.remoteAddress,
            headers: request.headers
        }));
        //注册监听器
        socket.on('message', function (buffer) {
            self.onSocketData(session, buffer);
        });
        socket.on('close', function (code, reason) {
            self.onSocketClose(session, code, reason);
        });
        socket.on('error', function (error) {
            self.onSocketError(session, error);
        });
        self.logger.info('on connection', session.ip);
    });
    if (heart > 0) {
        self.ticker = setInterval(function () {
            self.onServerHeart(timeout);
        }, heart);
    }
    self.logger.info('router startup success.');
};
Router.prototype.destroy = function () {
    const self = this;
    if (self.ticker) {
        clearInterval(self.ticker);
        self.ticker = null;
    }
};
Router.prototype.onSocketData = function (session, json) {
    const self = this;
    let pack;
    try {
        pack = JSON.parse(json);
    } catch (e) {
        self.logger.warn('onSocketData:', session.uid, json.length, '->', json);
        self.pushData(session, NOSYNTAX, {
            code: 400,
            data: 'Bad Request'
        });
        return;
    }
    if (self.handler.onSocketData) {
        //路由对象自定义了路由规则
        self.logger.debug('onSocketData:', session.uid, json.length, '->', json);
        self.handler.onSocketData(session, pack);
    } else if (pack.route.indexOf('$_') === 0) {
        //该前缀的函数作为路由对象的私有函数，不进行转发
        self.logger.warn('onSocketData:', session.uid, json.length, '->', json);
        self.response(session, pack, {
            code: 405,
            data: 'Method Not Allowed'
        });
    } else if (self.handler[pack.route]) {
        //转发到路由对象的对应函数
        self.logger.debug('onSocketData:', session.uid, json.length, '->', json);
        self.handler[pack.route](session, pack);
    } else if (pack.route === HEARTICK) {
        //心跳包
        self.logger.trace('onSocketData:', session.uid, json.length, '->', json);
        session.resetHeart();//更新最近心跳时间
        self.pushData(session, HEARTICK, pack.message);
    } else {
        //无路由
        self.logger.warn('onSocketData:', session.uid, json.length, '->', json);
        self.response(session, pack, {
            code: 501,
            data: 'Not Implemented'
        });
    }
};
Router.prototype.onSocketClose = function (session, code, reason) {
    const self = this;
    if (self.handler.onSocketClose) {
        self.handler.onSocketClose(session, code, reason);
    }
    //退出已加入的所有分组
    session.eachChannel(function (gid) {
        self.quitChannel(session, gid);
    });
    self.logger.info('onSocketClose:', session.uid, code, reason);
};
Router.prototype.onSocketError = function (session, error) {
    const self = this;
    if (self.handler.onSocketError) {
        self.handler.onSocketError(session, error);
    }
    //退出已加入的所有分组
    session.eachChannel(function (gid) {
        self.quitChannel(session, gid);
    });
    session.socket.terminate();//强制关闭连接
    self.logger.error('onSocketError:', session.uid, error);
};
Router.prototype.onServerHeart = function (timeout) {
    const self = this;
    if (self.handler.onServerHeart) {
        self.handler.onServerHeart(timeout);
    }
    //关闭全部的超时未收到心跳包的连接
    let aliveCnt = 0;
    self.app.wssapp.clients.forEach(function (socket) {
        let session = socket.session;
        if (session.isExpired(timeout)) {
            self.logger.info('Session closed by timeout:', session.uid);
            //退出已加入的所有分组
            session.eachChannel(function (gid) {
                self.quitChannel(session, gid);
            });
            return session.socket.terminate();//强制关闭连接
        }
        aliveCnt++;
    });
    self.logger.trace('onServerHeart: alive count is', aliveCnt);
};
Router.prototype.response = function (session, pack, message) {
    const self = this;
    const json = JSON.stringify({
        route: RESPONSE,
        reqId: pack.reqId,
        message: message
    });
    session.socket.send(json);
    self.logger.debug('response:', session.uid, json.length, '->', json);
};
Router.prototype.pushData = function (session, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    session.socket.send(json);
    if (route === HEARTICK) {
        self.logger.trace('pushData:', json.length, '->', json);
    } else {
        self.logger.debug('pushData:', json.length, '->', json);
    }
};
Router.prototype.joinChannel = function (session, gid) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    if (!group.clients[session.uid]) {
        group.clients[session.uid] = session;
        group.count++;
        session.joinChannel(gid);
    }
    self.channel[gid] = group;
    self.logger.debug('joinChannel:', gid, session.uid);
    self.logger.trace('joinChannel', self.channel, session.channel);
};
Router.prototype.quitChannel = function (session, gid) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    if (group.clients[session.uid]) {
        delete group.clients[session.uid];
        group.count--;
        session.quitChannel(gid);
    }
    if (group.count > 0) {
        self.channel[gid] = group;
    } else {
        delete self.channel[gid];
    }
    self.logger.debug('quitChannel:', gid, session.uid);
    self.logger.trace('quitChannel', self.channel, session.channel);
};
Router.prototype.deleteChannel = function (gid) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    const clients_channels = {};
    for (let key in group.clients) {
        let session = group.clients[key];
        session.quitChannel(gid);
        clients_channels[key] = session.channel;
    }
    delete self.channel[gid];
    self.logger.debug('deleteChannel:', gid);
    self.logger.trace('deleteChannel', self.channel, clients_channels);
};
Router.prototype.pushChannel = function (gid, route, message) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    const json = JSON.stringify({
        route: route,
        message: message
    });
    for (let key in group.clients) {
        group.clients[key].socket.send(json);
    }
    self.logger.debug('pushChannel:', gid, json.length, '->', json);
};
Router.prototype.broadcast = function (route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    self.app.wssapp.clients.forEach(function (socket) {
        if (socket.readyState === 1) {
            socket.send(json);
        }
    });
    self.logger.debug('broadcast:', json.length, '->', json);
};
/**
 * @param app
 * @returns {Router}
 */
module.exports = function (app) {
    return new Router(app);
};