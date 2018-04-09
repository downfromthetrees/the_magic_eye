import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import LiveReloadPlugin from 'webpack-livereload-plugin'

export default  {
  entry: './client/index.js',
  output: {
    path: '/',
    filename: 'bundle.js'
  },
  module: {
    rules: [... ]
  },
  plugins: [..]
};

// var path = require("path");
// var config = {
//   entry: ["./app.tsx"],
//   output: {
//     path: path.resolve(__dirname, "build"),
//     filename: "bundle.js"
//   },
//   resolve: {
//     extensions: [".tsx", ".js"]
//     //".ts", 
//   },

//   module: {
//     loaders: [
//       {
//         test: /\.tsx?$/,
//         loader: "ts-loader",
//         exclude: /node_modules/
//       }
//     ]
//   }
// };

// module.exports = config;