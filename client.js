var tag = 'ServerSideHmrClient';

console.log('client here');

if(module.hot) {

    var querystring = require('querystring');
    var IpcClient = require('./ipcClient');
    var log = require('./log');
    var logApplyResult = require('./log-apply-result');

    var options = querystring.parse(__resourceQuery.substr(1));

    log.setTag(tag);
    if (options.silent || options.silent === '') log.setLevel('silent');
    if (options.debug || options.debug === '') log.setLevel('debug');

    var client = new IpcClient(options.channelName);
    client.events.on('webpack_assets_emitted', function() {
        checkForUpdate();
    });
    client.connect();

    module.hot.addStatusHandler(function(status) {
        if (['abort', 'fail'].indexOf(status) >= 0) {
            log('Detected HMR status \'' + status + '\', emitting \'restart\' event');
            try {
                client.emit('restart');
            } catch(e) {
                log.warn('Could not emit \'restart\' event, you need to restart manually.');
            }
        }
    });

    /**
     * Copied from https://github.com/webpack/webpack/blob/v4.29.6/hot/signal.js and modified:
     */
    var checkForUpdate = function(fromUpdate) {
        if (module.hot.status() !== 'idle') {
            log.warn('[HMR] Got \'webpack_assets_emitted\' event but currently in ' + module.hot.status() + ' state.');
            log.warn('[HMR] Need to be in idle state to start hot update.');
            return;
        }

        module.hot
            .check()
            .then(function(updatedModules) {
                if (!updatedModules) {
                    if (fromUpdate) log('[HMR] Update applied.');
                    else log.warn('[HMR] Cannot find update.');
                    return;
                }

                return module.hot
                    .apply()
                    .then(function(renewedModules) {
                        logApplyResult(updatedModules, renewedModules);
                        checkForUpdate(true);
                        return null;
                    });
            })
            .catch(function(error) {
                var status = module.hot.status();
                if (['abort', 'fail'].indexOf(status) >= 0) {
                    log.warn('[HMR] Cannot apply update.');
                    log.warn('[HMR] ' + (error.stack || error.message));
                    log.warn("[HMR] You need to restart the application!");
                } else {
                    log.warn('[HMR] Update failed: ' + (error.stack || error.message));
                }
            });
    };
} else {
    throw new Error('[' + tag + "] Hot Module Replacement (HMR) is disabled.");
}
