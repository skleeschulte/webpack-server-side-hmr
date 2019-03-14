var level = 'log';
var tag;

function tagMessage(message) {
    if (tag) return '[' + tag + '] ' + message;
    return message;
}

function log(message) {
    level !== 'silent' && console.log(tagMessage(message));
}

log.debug = function(message) {
    level === 'debug' && log(message);
};

log.warn = function(message) {
    level !== 'silent' && console.warn(tagMessage(message));
};

log.setTag = function(messageTag) {
    tag = messageTag;
};

log.setLevel = function(logLevel) {
    level = logLevel;
};

module.exports = log;
