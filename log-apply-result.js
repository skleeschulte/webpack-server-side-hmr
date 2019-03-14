/**
 * Copied from https://github.com/webpack/webpack/blob/v4.29.6/hot/log-apply-result.js and modified:
 *
 * MIT License http://www.opensource.org/licenses/mit-license.php
 * Original Author: Tobias Koppers @sokra
*/
module.exports = function(updatedModules, renewedModules) {
    var unacceptedModules = updatedModules.filter(function(moduleId) {
        return renewedModules && renewedModules.indexOf(moduleId) < 0;
    });
    var log = require("./log");

    if (unacceptedModules.length > 0) {
        log.warn('[HMR] The following modules couldn\'t be hot updated: (They would need a full reload!)');
        unacceptedModules.forEach(function(moduleId) {
            log.warn('[HMR]  - ' + moduleId);
        });
    }

    if (!renewedModules || renewedModules.length === 0) {
        log('[HMR] Nothing hot updated.');
    } else {
        log('[HMR] Updated modules:');
        renewedModules.forEach(function(moduleId) {
            if (typeof moduleId === 'string' && moduleId.indexOf('!') !== -1) {
                var parts = moduleId.split('!');
                log('[HMR]  - ' + parts.pop());
                log('[HMR]  - ' + moduleId);
            } else {
                log('[HMR]  - ' + moduleId);
            }
        });
        var numberIds = renewedModules.every(function(moduleId) {
            return typeof moduleId === 'number';
        });
        if (numberIds) log('[HMR] Consider using the NamedModulesPlugin for module names.');
    }
};
