const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";

  return {
    mode: argv.mode || "development",
    entry: "./src/renderer/index.tsx",
    target: "electron-renderer",
    devtool: isDevelopment ? "source-map" : false,
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          include: /src/,
          use: [{ loader: "ts-loader" }],
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "[name]__[local]__[hash:base64:5]",
                  auto: true,
                },
                importLoaders: 1,
              },
            },
          ],
        },
      ],
    },
    output: {
      path: path.resolve(__dirname, "dist/renderer"),
      filename: "bundle.js",
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/renderer/index.html",
      }),
    ],
  };
};
