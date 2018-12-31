module.exports = {
    apps: require('../ghost3a').pm2cfg.create(process.argv, __filename, '${base}/cfgs/servers.json', '/etc/hostname', 2).getPm2Apps()
};
