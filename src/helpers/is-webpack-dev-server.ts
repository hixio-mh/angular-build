export function isWebpackDevServer(): boolean {
    const devServer = (!!process.argv[1] && /(\\|\/)?webpack-dev-server(\.js)?$/i.test(process.argv[1]));
    return devServer;
}
