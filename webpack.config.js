const path = require('path');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    context: __dirname,
    entry: slsw.lib.entries,
    target: 'node',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    externals: [nodeExternals()], // Evita empacotar os node_modules
    output: {
        libraryTarget: 'commonjs2',
        path: path.join(__dirname, '.webpack'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                },
                exclude: /node_modules/,
            },
        ],
    },
};
