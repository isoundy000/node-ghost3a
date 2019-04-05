"use strict";
const WebSocket = require('ws');
const Session = require('./session');
const HEARTICK = '$heartick$';//心跳包路由
const RESPONSE = '$response$';//响应请求路由
const NOSYNTAX = '$nosyntax$';//响应语法错误路由
const INNERP2P = '$innerp2p$';//跨进程p2p包路由
const INNERGRP = '$innergrp$';//跨进程grp路由
const INNERALL = '$innerall$';//跨进程广播路由
const Router = function (app, link, sevs) {
    this.app = app;
    this.link = typeof link === 'string' ? JSON.parse(link) : link;
    this.sevs = typeof sevs === 'string' ? JSON.parse(sevs) : sevs;
    this.logger = app.getLogger('router', __filename);
    this.handler = {};//自定义路由
    this.clients = {};//客户端集合
    this.channel = {};//客户端分组
    this.bridges = {};//服务端分组
    this.ticker = null;//客户端心跳检测器
    this.looper = null;//服务端心跳检测器
};
Router.prototype.start = function (hander, heart, timeout) {
    const self = this;
    if (heart < 1000) throw Error(self.app.name + '-> socket检测间隔最少为1秒');
    if (timeout < 10000) throw Error(self.app.name + '-> socket超时时间最少为10秒');
    if (heart * 2 > timeout) throw Error(self.app.name + '-> 必须满足heart*2<=timeout');
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
    self.ticker = setInterval(function () {
        try {
            self.onServerHeart(heart, timeout);
        } catch (e) {
            self.logger.error('未处理的心跳异常：', e);
        }
    }, heart);
    //连接到其他的服务器进程
    self.bridgesInit(heart, timeout);
    self.logger.info('router startup success.');
};
Router.prototype.destroy = function () {
    const self = this;
    if (self.ticker) {
        clearInterval(self.ticker);
        self.ticker = null;
    }
    if (self.looper) {
        clearInterval(self.looper);
        self.looper = null;
    }
    self.logger.info('router destroy success.');
};
/**
 * 单进程中通讯功能
 */
Router.prototype.onSocketData = function (session, json) {
    const self = this;
    let pack = null;
    try {
        pack = JSON.parse(json);
    } catch (e) {
        self.logger.error('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.pushData(session, NOSYNTAX, {
            code: 400,
            data: 'Bad Request by 1'
        });
        self.forceClose(session);//强制清除会话
        return;
    }
    if (!pack || !pack.route) {
        self.logger.error('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.pushData(session, NOSYNTAX, {
            code: 400,
            data: 'Bad Request by 2'
        });
        self.forceClose(session);//强制清除会话
    } else if (pack.route.indexOf('$_') === 0) {
        //该前缀的函数作为路由对象的私有函数，不进行转发
        self.logger.error('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.response(session, pack, {
            code: 405,
            data: 'Method Not Allowed'
        });
        self.forceClose(session);//强制清除会话
    } else if (self.handler[pack.route]) {
        //转发到路由对象的对应函数
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.handler[pack.route](session, pack);
    } else if (pack.route === HEARTICK) {
        //通用心跳包
        self.logger.trace('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        session.resetHeart();//更新最近心跳时间
        self.pushData(session, HEARTICK, pack.message);
    } else if (pack.route === INNERP2P) {
        //跨进程P2P包
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        if (self.clients[pack.$uid$]) self.pushData(self.clients[pack.$uid$], pack.$route$, pack.message);
    } else if (pack.route === INNERGRP) {
        //跨进程GRP包
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.pushChannel(pack.$gid$, pack.$route$, pack.message);
    } else if (pack.route === INNERALL) {
        //跨进程ALL包
        self.logger.debug('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.broadcast(pack.$route$, pack.message);
    } else {
        //无路由
        self.logger.error('onSocketData:', session.id, session.uid, json.length, 'bytes ->', json);
        self.response(session, pack, {
            code: 501,
            data: 'Not Implemented'
        });
        self.forceClose(session);//强制清除会话
    }
};
Router.prototype.onSocketClose = function (session, code, reason) {
    const self = this;
    if (self.handler.$_onSocketClose) {
        self.handler.$_onSocketClose(session, code, reason);
    }
    delete self.clients[session.uid];//从客户端列表移除
    session.eachChannel(function (gid) {
        self.quitChannel(session, gid);//退出已加入的所有分组
    });
    self.logger.info('onSocketClose:', session.id, session.uid, code, reason);
};
Router.prototype.onSocketError = function (session, error) {
    const self = this;
    if (self.handler.$_onSocketError) {
        self.handler.$_onSocketError(session, error);
    }
    self.forceClose(session);//强制清除会话
    self.logger.error('onSocketError:', session.id, session.uid, error);
};
Router.prototype.onSocketTimeout = function (session, timeout) {
    const self = this;
    if (self.handler.$_onSocketTimeout) {
        self.handler.$_onSocketTimeout(session, timeout);
    }
    self.forceClose(session);//强制清除会话
    self.logger.warn('onSocketTimeout:', session.id, session.uid);
};
Router.prototype.onServerHeart = function (heart, timeout) {
    const self = this;
    if (self.handler.$_onServerHeart) {
        self.handler.$_onServerHeart(heart, timeout);
    }
    //关闭全部的超时未收到心跳包的连接
    let totalCnt = 0;
    let aliveCnt = 0;
    self.app.wssapp.clients.forEach(function (socket) {
        totalCnt++;
        if (socket.$session.isExpired(timeout)) {
            self.onSocketTimeout(socket.$session, timeout);
        } else {
            aliveCnt++;
        }
    });
    self.logger.trace('onServerHeart:', ' totalCnt->', totalCnt, ' aliveCnt->', aliveCnt, ' channels->', self.channel, {clients: self.clients});
};
Router.prototype.forceClose = function (session) {
    const self = this;
    delete self.clients[session.uid];//从客户端列表移除
    session.eachChannel(function (gid) {
        self.quitChannel(session, gid);//退出已加入的所有分组
    });
    session.socket.terminate();//强制关闭连接
};
Router.prototype.response = function (session, pack, message) {
    const self = this;
    const json = JSON.stringify({
        route: RESPONSE,
        reqId: pack.reqId,
        message: message
    });
    if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(json);
    }
    self.logger.debug('response:', session.id, session.uid, json.length, 'bytes ->', json);
};
Router.prototype.pushData = function (session, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(json);
    }
    if (route === HEARTICK) {
        self.logger.trace('pushData:', session.id, session.uid, json.length, 'bytes ->', json);
    } else {
        self.logger.debug('pushData:', session.id, session.uid, json.length, 'bytes ->', json);
    }
};
Router.prototype.bindUid = function (session, uid) {
    const self = this;
    session.bindUid(uid);
    self.clients[uid] = session;
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
        if (group.clients[key].socket.readyState === WebSocket.OPEN) {
            group.clients[key].socket.send(json);
        }
    }
    self.logger.debug('pushChannel:', gid, json.length, 'byte ->', json);
};
Router.prototype.broadcast = function (route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    let total = 0;
    let count = 0;
    self.app.wssapp.clients.forEach(function (socket) {
        total++;
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(json);
            count++;
        }
    });
    self.logger.debug('broadcast:' + count + '/' + total, json.length, 'bytes ->', json);
};
/**
 * 多进程间通讯功能
 */
Router.prototype.bridgesInit = function (heart, timeout) {
    const self = this;
    //生成连接信息
    for (let i = 0; i < self.link.length; i++) {
        const group = self.link[i];
        const addrs = self.sevs[group];
        self.bridges[group] = [];
        for (let k = 0; k < addrs.length; k++) {
            self.bridges[group].push({
                name: group,
                host: addrs[k].inip || addrs[k].host,
                port: addrs[k].port,
                prot: addrs[k].ssls ? 'wss' : 'ws',
                socket: null,//该连接的引用
                counts: 0,//断线重连次数
            });
        }
    }
    self.logger.trace('bridgesInit:', self.bridges);
    //创建连接任务
    for (let key in self.bridges) {
        const group = self.bridges[key];
        for (let i = 0; i < group.length; i++) {
            self.bridgesConnect(group[i]);
        }
    }
    //启动连接心跳
    self.looper = setInterval(function () {
        const time = Date.now();
        for (let key in self.bridges) {
            const group = self.bridges[key];
            for (let i = 0; i < group.length; i++) {
                self.bridgesPushData(group[i], HEARTICK, time);
            }
        }
    }, Math.floor(timeout / 2));
};
Router.prototype.bridgesConnect = function (bridge) {
    const self = this;
    //{rejectUnauthorized:false}解决用内网连接时证书altnames不匹配的问题
    const socket = new WebSocket(bridge.prot + '://' + bridge.host + ':' + bridge.port + '/', void 0, {rejectUnauthorized: false});
    socket.on('error', function (error) {
        if (bridge.counts > 0) self.logger.warn(error.syscall, error.code);
        bridge.socket = null;
        socket.terminate();//强制关闭连接
        self.bridgesConnect(bridge);
    });
    socket.on('open', function () {
        bridge.socket = socket;
        bridge.counts++;
        self.logger.info('内部连接:', bridge.name, bridge.host + ':' + bridge.port, '已经建立,次数:', bridge.counts);
        socket.on('close', function (code, reason) {
            bridge.socket = null;
            self.bridgesConnect(bridge);
        });
        socket.on('message', function (buffer) {
            self.logger.trace('bridgesOnData:', buffer.length, 'bytes ->', buffer);
        });
    });
};
Router.prototype.bridgesPushData = function (bridge, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: route,
        message: message
    });
    if (bridge.socket && bridge.socket.readyState === WebSocket.OPEN) {
        bridge.socket.send(json);
    }
    if (route === HEARTICK) {
        self.logger.trace('bridgesPushData:', bridge.name, bridge.host + ':' + bridge.port, json.length, 'bytes ->', json);
    } else {
        self.logger.debug('bridgesPushData:', bridge.name, bridge.host + ':' + bridge.port, json.length, 'bytes ->', json);
    }
};
Router.prototype.bridgesPushP2P = function (name, uid, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: INNERP2P,
        $uid$: uid,
        $route$: route,
        message: message
    });
    const group = self.bridges[name];
    for (let i = 0; i < group.length; i++) {
        const bridge = group[i];
        if (bridge.socket && bridge.socket.readyState === WebSocket.OPEN) {
            bridge.socket.send(json);
        }
    }
    self.logger.debug('bridgesPushP2P:', name, uid, json.length, 'bytes ->', json);
};
Router.prototype.bridgesPushGrp = function (name, gid, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: INNERGRP,
        $gid$: gid,
        $route$: route,
        message: message
    });
    const group = self.bridges[name];
    for (let i = 0; i < group.length; i++) {
        const bridge = group[i];
        if (bridge.socket && bridge.socket.readyState === WebSocket.OPEN) {
            bridge.socket.send(json);
        }
    }
    self.logger.debug('bridgesPushGrp:', name, gid, json.length, 'bytes ->', json);
};
Router.prototype.bridgesPushAll = function (name, route, message) {
    const self = this;
    const json = JSON.stringify({
        route: INNERALL,
        $route$: route,
        message: message
    });
    const group = self.bridges[name];
    for (let i = 0; i < group.length; i++) {
        const bridge = group[i];
        if (bridge.socket && bridge.socket.readyState === WebSocket.OPEN) {
            bridge.socket.send(json);
        }
    }
    self.logger.debug('bridgesPushAll:', name, json.length, 'bytes ->', json);
};
/**
 * @param app context类实例
 * @param link 本进程需要连接的进程分组
 * @param sevs 工程的全部进程集合
 * @returns {Router} 类实例
 */
module.exports = function (app, link, sevs) {
    return new Router(app, link, sevs);
};