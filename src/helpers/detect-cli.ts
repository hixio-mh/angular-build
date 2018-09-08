// TODO: to review
export function isFromWebpackCli(): boolean {
  return process.argv.length >= 2 && /(\\|\/)?webpack(\.js)?$/i.test(process.argv[1]);
}

export function isFromAngularCli(): boolean {
  return process.argv.length >= 2 && /(\\|\/)?ng$/i.test(process.argv[1]);
}


export function isFromWebpackDevServer(): boolean {
  return process.argv.length >= 2 && /(\\|\/)?webpack-dev-server(\.js)?$/i.test(process.argv[1]);
}

export function isFromAngularCliDevServer(): boolean {
  return process.argv.length >= 3 &&
    /(\\|\/)?ng(\.js)?$/i.test(process.argv[1]) &&
    process.argv[2] === 'serve';
}
