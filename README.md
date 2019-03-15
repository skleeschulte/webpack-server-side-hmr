# webpack-server-side-hmr

Use [IPC connection](https://nodejs.org/api/net.html#net_ipc_support) for server side HMR
and full restarts where needed.

This package has three components:
- A Webpack plugin: Provides an IPC server that signals its clients when Webpack emitted new assets.
- An entry file that adds an IPC client to the server bundle file. It triggers updating modules when
  the server signals new assets and it triggers a restart when updating modules fails / is not
  possible.
- A runner executable. It restarts the server bundle when requested by the entry file client or when
  the server crashes and a new bundle is emitted.

##### Install:

    npm install -D webpack-server-side-hmr

##### Add plugin to Webpack config:

    const ServerSideHmrPlugin = require('webpack-server-side-hmr/plugin');

...

    new ServerSideHmrPlugin({
        // optional options (default values):
        channelName: 'webpack_server_side_hmr',
        silent: false,
        debug: false
    })

##### Add client entry to Webpack config:

    entry: [
        'webpack-server-side-hmr/client',
        ...
    ]
    
Use query string to add options:
    
    'webpack-server-side-hmr/client?debug&channelName=abc'

**Important:** Files from webpack-server-side-hmr package must not be treated as Webpack externals!

##### Run server bundle with hmr-runner:

In package.json script:
    
    hmr-runner node ./dist/server.js
    
Or call it directly:
    
    ./node_modules/.bin/hmr-runner node ./dist/server.js
    
To show available command line options run without arguments:
    
    ./node_modules/.bin/hmr-runner
    
##### Additional Webpack configuration

Add HotModuleReplacementPlugin:

    new webpack.HotModuleReplacementPlugin()

Enable watch mode:

    watch: true
    
##### Complete Webpack config example

    const path = require('path');
    const webpack = require('webpack');
    const ServerSideHmrPlugin = require('webpack-server-side-hmr/plugin');
    
    const projectRoot = __dirname;
    
    module.exports = {
    
        mode: 'development',
        target: 'node',
        context: projectRoot,
    
        entry: [
            'webpack-server-side-hmr/client',
            path.resolve(projectRoot, 'src/server.js')
        ],
        output: {
            path: path.resolve(projectRoot, 'dist'),
            filename: 'server.js',
            libraryTarget: 'commonjs2'
        },
    
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: { loader: 'babel-loader' }
                }
            ]
        },
    
        externals: [
            function(context, request, callback) {
                // ignore webpack-server-side-hmr
                if (/^webpack-server-side-hmr/.test(request) || /[/\\]node_modules[/\\]webpack-server-side-hmr([/\\].*)?$/.test(context)) {
                    return callback();
                }
                const resolved = require.resolve(request, { paths: [context] });
                if (/[/\\]node_modules[/\\]/.test(resolved)){
                    return callback(null, 'commonjs ' + request);
                }
                callback();
            }
        ],
    
        plugins: [
            new webpack.HotModuleReplacementPlugin(),
            new ServerSideHmrPlugin()
        ],
    
        devtool: false,
    
        // completely disable NodeStuffPlugin and NodeSourcePlugin
        // https://webpack.js.org/configuration/node/
        node: false,
    
        watch: true
    
    };
    