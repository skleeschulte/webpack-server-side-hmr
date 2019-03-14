var net = require('net');
var EventEmitter = require('events');
var getPath = require('./getPath');
var log = require('./log');

function IpcClient(channelName) {
    this.channelName = channelName;
    this.connected = false;
    this.lastErrorTimestamp = 0;
    this.events = new EventEmitter();
}

IpcClient.prototype.connect = function() {
    this.connection = net.createConnection({ path: getPath(this.channelName) }, function() {
        log('Connected to signaling server');
        this.connected = true;
    }.bind(this));
    this.connection.setEncoding('utf8');

    this.connection.on('data', function(data) {
        log.debug('Received data: ' + data);
        if (data === 'webpack_assets_emitted') {
            this.events.emit('webpack_assets_emitted');
        } else if (data === 'restart') {
            this.events.emit('restart');
        }
    }.bind(this));

    this.connection.on('end', function() {
        log.warn('Lost connection to signaling server, reconnecting...');
        this.connected = false;
        this.connect();
    }.bind(this));

    this.connection.on('error', function(error) {
        if (Date.now() - this.lastErrorTimestamp > 10000) {
            log.warn('Failed to connect to signaling server (' + error.code + '), retrying...');
            log.debug(error.stack || error.message);
            this.lastErrorTimestamp = Date.now();
        }
        setTimeout(function() { this.connect() }.bind(this), 500);
    }.bind(this));
};

IpcClient.prototype.emit = function(message) {
    if (!this.connected) throw new Error('Not connected, cannot emit message!');
    this.connection.write(message);
};

module.exports = IpcClient;
