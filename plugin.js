var IpcServer = require('./ipcServer');
var log = require('./log');

log.setTag('ServerSideHmrPlugin');

function ServerSideHmrPlugin(options) {
    this.options = Object.assign({
        channelName: undefined,
        silent: false,
        debug: false
    }, options || {});

    if (this.options.silent) log.setLevel('silent');
    if (this.options.debug) log.setLevel('debug');

    this.server = new IpcServer(this.options.channelName);
}

ServerSideHmrPlugin.prototype.apply = function(compiler) {
    var first = true;
    compiler.hooks.afterEmit.tap('ServerSideHmrPlugin', function(compilation) {
        if (first) {
            first = false;
            return;
        }
        this.server.broadcast('webpack_assets_emitted');
    }.bind(this));
};

module.exports = ServerSideHmrPlugin;
