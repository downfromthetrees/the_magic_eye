var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var LiveReloadPlugin =  require('webpack-livereload-plugin');

module.exports = {
    entry: path.resolve(__dirname, './src/client/index.jsx'),
    output: {
        path: '/',
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
              test: /\.jsx?$/,
              
              use: [
                {
                  loader: 'babel-loader',
                  query: {
                    presets: ['es2015']
                  }                  
                },
              ],
              exclude: /node_modules/,
            }
        ]
    },
    plugins: [
      new HtmlWebpackPlugin(
       {
         template: path.resolve(__dirname, './src/client/index.html'),
         title: 'The Magic Eye'
        }
      ),
      new LiveReloadPlugin()
    ],
    stats: {
      colors: true,
      hash: false,
      version: false,
      timings: false,
      assets: false,
      chunks: false,
      modules: false,
      reasons: false,
      children: false,
      source: false,
      errors: false,
      errorDetails: false,
      warnings: false,
      publicPath: false
    },
    devtool: 'source-map'
};
