function getPath(channelName) {
    var _channelName = channelName || 'webpack_server_side_hmr';
    return (process.platform === 'win32')
        ? '\\\\.\\pipe\\' + _channelName
        : '/tmp/' + _channelName + '.sock';
}

module.exports = getPath;
