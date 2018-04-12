var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var LiveReloadPlugin =  require('webpack-livereload-plugin');

module.exports = {
    entry: path.resolve(__dirname, './src/client/index.jsx'),
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'bundle.js',
        publicPath: path.resolve(__dirname, 'build')
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
                // {
                //   loader: 'ts-loader',
                // },                
              ],
              exclude: /node_modules/,
            }
        ]
    },
    plugins: [
      new HtmlWebpackPlugin(
       {
         filename: path.resolve(__dirname, './src/client/index.html'),
         template: path.resolve(__dirname, './src/client/index.html'),
         title: 'The Magic Eye'
        }
      )
      //,new LiveReloadPlugin()
    ],
    stats: {
        colors: true
    },
    devtool: 'source-map'
};
