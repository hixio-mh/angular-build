import * as webpack from 'webpack';

export function getWebpackToStringStatsOptions(options?: webpack.Stats.ToStringOptions, verbose: boolean = false):
    webpack.Stats.ToStringOptionsObject {
    const defaultOptions: webpack.Stats.ToStringOptions = {
        colors: true,
        errors: true,
        warnings: true,
        assets: true, // buildOptions.debug,

        // version: false,
        publicPath: false,
        reasons: false,
        chunkModules: false,
        modules: false,
        // listing all children is very noisy in AOT and hides warnings/errors
        children: false,
        // make sure 'chunks' is false or it will add 5-10 seconds to your build and incremental build time, due to excessive output.
        chunks: false
    };

    if (options && typeof options === 'object') {
        const verboseOptions: webpack.Stats.ToStringOptions = {
            version: true,
            publicPath: true,
            reasons: true,
            chunkModules: true,
            modules: true,
            children: true,
            chunks: true,
            errorDetails: true,
            cached: true
        };
        return Object.assign({}, defaultOptions, verbose ? verboseOptions : {}, options);
    } else if (options && typeof options === 'string') {
        if (options === 'none') {
            return {
                hash: false,
                version: false,
                timings: false,
                assets: false,
                entrypoints: false,
                chunks: false,
                chunkModules: false,
                modules: false,
                reasons: false,
                depth: false,
                usedExports: false,
                providedExports: false,
                children: false,
                source: false,
                errors: false,
                errorDetails: false,
                warnings: false,
                publicPath: false,
                performance: false
            } as any;
        } else {
            const pn = options;
            return {
                hash: pn !== 'errors-only' && pn !== 'minimal',
                version: pn === 'verbose',
                timings: pn !== 'errors-only' && pn !== 'minimal',
                assets: pn === 'verbose',
                entrypoints: pn === 'verbose',
                chunks: pn !== 'errors-only',
                chunkModules: pn === 'verbose',
                // warnings: pn !== "errors-only",
                errorDetails: pn !== 'errors-only' && pn !== 'minimal',
                reasons: pn === 'verbose',
                depth: pn === 'verbose',
                usedExports: pn === 'verbose',
                providedExports: pn === 'verbose',
                colors: true,
                performance: true
            } as any;
        }

    } else {
        return Object.assign({}, defaultOptions);
    }
}
