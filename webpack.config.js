const path = require('path');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');

const isOffline = process.env.IS_OFFLINE === 'true'; // Verifica se está rodando offline

module.exports = {
    entry: slsw.lib.entries,
    target: 'node',
    // Define o modo baseado no ambiente, default é 'production'
    mode: isOffline ? 'development' : (process.env.NODE_ENV || 'production'),
    externals: [nodeExternals()],
    output: {
        libraryTarget: 'commonjs',
        path: path.join(__dirname, '.webpack'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    // Inclui plugins adicionais apenas se não estiver offline
    ...(isOffline ? {} : {
        plugins: [
            // Plugins que você deseja adicionar apenas em produção ou testes online
            // Exemplo: new CleanWebpackPlugin(),
        ]
    }),
};
