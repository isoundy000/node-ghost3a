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
            self.onServerHeart(heart, timeout);
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
        self.logger.warn('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.pushData(session, NOSYNTAX, {
            code: 400,
            data: 'Bad Request'
        });
        return;
    }
    if (self.handler.onSocketData) {
        //路由对象自定义了路由规则
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.handler.onSocketData(session, pack);
    } else if (pack.route.indexOf('$_') === 0) {
        //该前缀的函数作为路由对象的私有函数，不进行转发
        self.logger.warn('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.response(session, pack, {
            code: 405,
            data: 'Method Not Allowed'
        });
    } else if (self.handler[pack.route]) {
        //转发到路由对象的对应函数
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.handler[pack.route](session, pack);
    } else if (pack.route === HEARTICK) {
        //心跳包
        self.logger.trace('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        session.resetHeart();//更新最近心跳时间
        self.pushData(session, HEARTICK, pack.message);
    } else {
        //无路由
        self.logger.warn('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
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
    self.logger.info('onSocketClose:', session.id, session.uid, code, reason);
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
    self.logger.error('onSocketError:', session.id, session.uid, error);
};
Router.prototype.onSocketTimeout = function (session, timeout) {
    const self = this;
    if (self.handler.onSocketTimeout) {
        self.handler.onSocketTimeout(session, timeout);
    }
    //退出已加入的所有分组
    session.eachChannel(function (gid) {
        self.quitChannel(session, gid);
    });
    session.socket.terminate();//强制关闭连接
    self.logger.warn('onSocketTimeout:', session.id, session.uid);
};
Router.prototype.onServerHeart = function (heart, timeout) {
    const self = this;
    if (self.handler.onServerHeart) {
        self.handler.onServerHeart(heart, timeout);
    }
    //关闭全部的超时未收到心跳包的连接
    let totalCnt = 0;
    let aliveCnt = 0;
    self.app.wssapp.clients.forEach(function (socket) {
        totalCnt++;
        if (socket.session.isExpired(timeout)) {
            self.onSocketTimeout(socket.session, timeout);
        } else {
            aliveCnt++;
        }
    });
    self.logger.trace('onServerHeart:', 'totalCnt =', totalCnt + ', aliveCnt =', aliveCnt + ', channels =', self.channel);
};
Router.prototype.response = function (session, pack, message) {
    const self = this;
    const json = JSON.stringify({
        route: RESPONSE,
        reqId: pack.reqId,
        message: message
    });
    session.socket.send(json);
    self.logger.debug('response:', session.id, session.uid, json.length, 'bytes ->', json);
};
Router.prototype.pushData = function (session, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    session.socket.send(json);
    if (route === HEARTICK) {
        self.logger.trace('pushData:', session.id, session.uid, json.length, 'bytes ->', json);
    } else {
        self.logger.debug('pushData:', session.id, session.uid, json.length, 'bytes ->', json);
    }
};
Router.prototype.joinChannel = function (session, gid) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    if (!group.clients[session.id]) {
        group.clients[session.id] = session;
        group.count++;
        session.joinChannel(gid);
    }
    self.channel[gid] = group;
    self.logger.debug('joinChannel:', gid, session.id, session.uid);
    self.logger.trace('joinChannel', self.channel, session.channel);
};
Router.prototype.quitChannel = function (session, gid) {
    const self = this;
    const group = self.channel[gid] || {count: 0, clients: {}};
    if (group.clients[session.id]) {
        delete group.clients[session.id];
        group.count--;
        session.quitChannel(gid);
    }
    if (group.count > 0) {
        self.channel[gid] = group;
    } else {
        delete self.channel[gid];
    }
    self.logger.debug('quitChannel:', gid, session.id, session.uid);
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
    self.logger.debug('pushChannel:', gid, json.length, 'byte ->', json);
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
    self.logger.debug('broadcast:', json.length, 'bytes ->', json);
};
/**
 * @param app
 * @returns {Router}
 */
module.exports = function (app) {
    return new Router(app);
};