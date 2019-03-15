#!/usr/bin/env node

var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;
var readline = require('readline');
var treeKill = require('tree-kill');
var IpcClient = require('./ipcClient');
var log = require('./log');

// set tag for logging
log.setTag('hmr-runner');

/**
 * Print usage information
 * @param message Optional message to prepend
 */
function printUsage(message) {
    var usage = os.EOL +
        'Usage: hmr-runner [hmr-runner arguments] command [command arguments]' + os.EOL + os.EOL +
        '  Optional hmr-runner arguments:' + os.EOL + os.EOL +
        '    --no-rs                     Do not listen for restart command \'rs\' on STDIN' + os.EOL +
        '    --channel-name=[name]       Set signal server channel name to [name]' + os.EOL +
        '    --ignore-debug-option-env   Do not try to inject NODE_DEBUG_OPTION' + os.EOL +
        '                                environment variable into command arguments' + os.EOL +
        '    --silent                    Suppress all messages by hmr-runner' + os.EOL +
        '    --debug                     Print debug messages (overrides --silent)' + os.EOL + os.EOL;

    if (message) usage = os.EOL + message + os.EOL + usage;

    process.stdout.write(usage);
    process.exit();
}

// parse command line arguments

var args = process.argv.slice(2);
var hmrRunnerArgs;
var command;
var commandArgs;

for (var i = 0; i < args.length; i++) {
    if (args[i].substr(0, 1) !== '-') {
        hmrRunnerArgs = args.slice(0, i);
        command = args[i];
        commandArgs = args.slice(i+1);
        break;
    }
}

if (!command) {
    printUsage('No command found.');
}

var restartOnRs = true;
var channelName = undefined;
var ignoreDebugOptionEnv = false;

hmrRunnerArgs.forEach(function(arg) {
    var match = arg.match(/^--([^=]*)(=(.*))?$/);

    if (!match) printUsage('Invalid hmr-runner argument: ' + arg);

    var key = match[1];
    var value = match[3];

    switch(key) {
        case 'no-rs':
            if (value) printUsage('Cannot assign value to argument --no-rs.');
            restartOnRs = false;
            break;
        case 'channel-name':
            if (!value) printUsage('Channel name is empty.');
            channelName = value;
            break;
        case 'ignore-debug-option-env':
            if (value) printUsage('Cannot assign value to argument --ignore-debug-option-env.');
            ignoreDebugOptionEnv = true;
            break;
        case 'silent':
            if (value) printUsage('Cannot assign value to argument --silent.');
            log.setLevel('silent');
            break;
        case 'debug':
            if (value) printUsage('Cannot assign value to argument --debug.');
            log.setLevel('debug');
            break;
        default:
            printUsage('Invalid hmr-runner argument: ' + arg);
    }
});

// restart when rs[Enter] is typed
if (restartOnRs) {
    var rl = readline.createInterface({
        input: process.stdin
    });
    rl.on('line', function(line) {
        if (line === 'rs') {
            log('Detected \'rs\' command on STDIN, restarting...');
            restartChild();
        }
    });
}

// If running a node command and NODE_DEBUG_OPTION is present, inject it
if (!ignoreDebugOptionEnv && process.env.NODE_DEBUG_OPTION && process.env.NODE_DEBUG_OPTION.trim()) {
    if (path.basename(command, path.extname(command)) === 'node') {
        if (commandArgs.filter(function(arg) { return /^--(inspect|debug)(-brk)?=/.test(arg); }).length === 0) {
            console.debug('Adding debug option to command arguments: ' + process.env.NODE_DEBUG_OPTION);
            commandArgs.unshift(process.env.NODE_DEBUG_OPTION);
        }
    }
}

// connect to signaling server and restart when signaling server sends restart message
var client = new IpcClient(channelName);
client.events.on('restart', function() {
    log('Received \'restart\' event, restarting child.');
    restartChild();
});
client.connect();

var child;
var running = false;
var restarting = false;

/**
 * Run command with spawn child. When child exits with code != 0, wait for the signaling server to send a
 * webpack_assets_emitted event.
 */
function spawnChild() {
    if (running) {
        log.debug('spawnChild: Child is already running.');
        return;
    }
    running = true;
    log('Running command: ' + command + ' ' + commandArgs.join(' '));
    child = spawn(command, commandArgs, { stdio: 'inherit' });
    child.on('exit', function(code, signal) {
        running = false;
        if (code === 0 && !restarting) {
            log('Child process finished with exit code 0. Quitting hmr-runner.');
            process.exit();
        } else {
            if (signal) {
                log('Child process was terminated by signal\'' + signal + '\'.');
            } else {
                log('Child process finished with exit code \'' + code + '\'.');
            }
            if (!restarting) {
                log('Waiting for \'webpack_assets_emitted\' event to restart child.');
                client.events.once('webpack_assets_emitted', function() {
                    log('Received \'webpack_assets_emitted\' event, restarting child.');
                    restartChild();
                });
            }
        }
    });
}
spawnChild();

/**
 * Restart child process.
 */
function restartChild() {
    if (restarting) {
        log.debug('Restart requested, but there is already a restart in progress - ignoring request.');
        return;
    }
    restarting = true;
    log.debug('Restarting child');
    if (running && child && child.pid) {
        log.debug('Child is running (PID ' + child.pid + '), killing child');
        treeKill(child.pid, function(error) {
            if (error) {
                log.warn('There was an error when trying to kill the child process.');
                throw error;
            }
            spawnChild();
        });
    } else {
        spawnChild();
    }
    restarting = false;
}
