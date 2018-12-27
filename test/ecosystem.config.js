module.exports = {
    apps: require('../ghost3a').pm2cfg.create(process.argv, __filename, '/cfgs/servers.json', true).getPm2Apps()
};
