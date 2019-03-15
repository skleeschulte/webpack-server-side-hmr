#!/usr/bin/env node

var os = require('os');
var path = require('path');
var findup = require('findup-sync');
var spawn = require('child_process').spawn;
var IpcClient = require('./ipcClient');
var log = require('./log');

// set tag for logging
log.setTag('nodemon-hmr');

/**
 * Print usage information
 * @param message Optional message to prepend
 * @param exit Boolean indicating whether to exit after printing usage information
 */
function printUsage(message, exit) {
    var usage = os.EOL +
        '  Usage: nodemon-hmr [options] [script.js] [args]' + os.EOL + os.EOL +
        '  nodemon-hmr is a wrapper around nodemon. nodemon-hmr options are prefixed' + os.EOL +
        '  with \'nh-\', all other arguments are passed through to nodemon.' + os.EOL + os.EOL +
        '  Options for nodemon-hmr (all optional):' + os.EOL + os.EOL +
        '  --nh-nodemon-exec=[path]       Path to a specific nodemon executable. Absolute' + os.EOL +
        '                                 path or relative to current working directory.' + os.EOL +
        '  --nh-channel-name=[name]       Set signal server channel name to [name].' + os.EOL +
        '  --nh-ignore-debug-option-env   Do not inject the value of a NODE_DEBUG_OPTION' + os.EOL +
        '                                 environment variable into nodemon options.' + os.EOL +
        '  --nh-silent                    Suppress all messages by hmr-runner.' + os.EOL +
        '  --nh-debug                     Print debug messages (overrides --silent).' + os.EOL +
        '  -h, --help                     Show nodemon-hmr and nodemon usage help.' + os.EOL + os.EOL;

    if (message) usage = os.EOL + message + os.EOL + usage;

    process.stdout.write(usage);
    if (exit) process.exit();
}

// parse command line arguments

var args = process.argv.slice(2);
var nodemonHmrArgs = args.filter(function(arg) { return /^--nh-.*/.test(arg); });
var nodemonArgs = args.filter(function(arg) { return !/^--nh-.*/.test(arg); });

var nodemonExec = undefined;
var channelName = undefined;
var ignoreDebugOptionEnv = false;

nodemonHmrArgs.forEach(function(arg) {
    var match = arg.match(/^(--[^=]*)(=(.*))?$/);
    var key = match[1];
    var hasEqSign = !!match[2];
    var value = match[3];

    switch(key) {
        case '--nh-nodemon-exec':
            if (!value) printUsage('Argument --nh-nodemon-exec cannot have an empty value.', true);
            nodemonExec = value;
            break;
        case '--nh-channel-name':
            if (!value) printUsage('Argument --nh-channel-name cannot have an empty value.', true);
            channelName = value;
            break;
        case '--nh-ignore-debug-option-env':
            if (hasEqSign) printUsage('Cannot assign value to argument --ignore-debug-option-env.', true);
            ignoreDebugOptionEnv = true;
            break;
        case '--nh-silent':
            if (hasEqSign) printUsage('Cannot assign value to argument --silent.', true);
            log.setLevel('silent');
            break;
        case '--nh-debug':
            if (hasEqSign) printUsage('Cannot assign value to argument --debug.', true);
            log.setLevel('debug');
            break;
        default:
            printUsage('Invalid nodemon-hmr argument: ' + arg, true);
    }
});

// check if help is printed
var showHelp = false;
if (nodemonArgs.indexOf('-h') !== -1 || nodemonArgs.indexOf('--help') !== -1) {
    showHelp = true;
    if (nodemonArgs.length === 1) {
        printUsage();
    }
}

// Inject value of env variable NODE_DEBUG_OPTION
if (!ignoreDebugOptionEnv && process.env.NODE_DEBUG_OPTION) {
    if (nodemonArgs.filter(function(arg) { return /^--(inspect|debug)(-brk)?=/.test(arg); }).length === 0) {
        nodemonArgs.unshift(process.env.NODE_DEBUG_OPTION);
    }
}

// find nodemon executable
if (nodemonExec) {
    if (!path.isAbsolute(nodemonExec)) {
        nodemonExec = path.resolve(__dirname, nodemonExec);
    }
} else {
    nodemonExec = findup('node_modules/.bin/nodemon');
}

// run nodemon
log('Starting nodemon:');
log(nodemonExec + ' ' + nodemonArgs.join(' '));
var nodemon = spawn(nodemonExec, nodemonArgs, {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
});
process.stdin.pipe(nodemon.stdin);
nodemon.on('exit', function(code, signal) {
    log.debug('nodemon finished with code ' + code + '(signal \'' + signal + '\'). Quitting nodemon-hmr.');
    process.exit();
});

// connect to signaling server and restart when signaling server sends restart message
if (!showHelp) {
    var client = new IpcClient(channelName);
    client.events.on('restart', function() {
        log('Received \'restart\' event, sending \'rs\' to nodemon.');
        nodemon.stdin.write('rs');
    });
    client.connect();
} else {
    log.debug('Showing help, not connecting to signaling server.');
}
