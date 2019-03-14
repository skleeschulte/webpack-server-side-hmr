var net = require('net');
var getPath = require('./getPath');
var log = require('./log');

function IpcServer(channelName) {
    this.channelName = channelName;
    this.connections = [];
    this._start();
}

IpcServer.prototype._start = function() {
    var path = getPath(this.channelName);
    this.server = net.createServer(this._connectionListener.bind(this));
    this.server.on('error', function(error) {
        this.server.close();
        if (error.code === 'EADDRINUSE') {
            log.warn('Cannot start server, probably another instance of ServerSideHmrPlugin is already running.');
            log.warn('If you need to run in parallel, consider changing the channel name.');
        }
        throw error;
    }.bind(this));
    this.server.listen(path, function() {
        log('Signaling server started');
        log.debug('Signaling server bound to ' + path);
    });
};

IpcServer.prototype._connectionListener = function(connection) {
    log.debug('A client connected to the signaling server');

    connection.setEncoding('utf8');
    connection.on('data', function(data) {
        log.debug('Signaling server received data from a client: ' + data);
        this.broadcast(data, connection);
    }.bind(this));

    this.connections.push(connection);
    connection.on('end', function() {
        this.connections = this.connections.filter(function(c) { return c !== connection; });
        log.debug('A client disconnected from the signaling server');
    }.bind(this));
};

IpcServer.prototype.broadcast = function(data, excludedConnection) {
    log.debug('Signaling server is broadcasting data: ' + data);
    this.connections
        .filter(function (connection) { return connection !== excludedConnection; })
        .forEach(function(connection) { connection.write(data); });
};

module.exports = IpcServer;
