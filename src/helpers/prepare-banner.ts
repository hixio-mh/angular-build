import * as path from 'path';
import * as fs from 'fs-extra';

export function prepareBannerSync(projectRoot: string, srcDir: string, banner: string): string {
    if (!banner) {
        return banner;
    }
    if (banner && /\.txt$/i.test(banner) && srcDir && fs.existsSync(path.resolve(srcDir, banner))) {
        banner = fs.readFileSync(path.resolve(srcDir, banner), 'utf-8');
    } else if (banner && /\.txt$/i.test(banner) && fs.existsSync(path.resolve(projectRoot, banner))) {
        banner = fs.readFileSync(path.resolve(projectRoot, banner), 'utf-8');
    }

    if (banner) {
        // read package info
        let packageName = '';
        let packageVersion = '';
        if (fs.existsSync(path.resolve(projectRoot, 'package.json'))) {
            const pkgConfig = fs.readJSONSync(path.resolve(projectRoot, 'package.json'));
            packageName = pkgConfig && pkgConfig.name ? pkgConfig.name : undefined;
            packageVersion = pkgConfig && pkgConfig.version ? pkgConfig.version : undefined;
        }
        if (srcDir && fs.existsSync(path.resolve(srcDir, 'package.json'))) {
            const pkgConfig = fs.readJSONSync(path.resolve(srcDir, 'package.json'));
            packageName = pkgConfig && pkgConfig.name ? pkgConfig.name : undefined;
        }
        let packageNameWithoutScope = packageName;
        if (packageNameWithoutScope && packageNameWithoutScope.indexOf('/') > -1) {
            packageNameWithoutScope = packageNameWithoutScope.split('/')[1];
        }

        banner = addCommentToBanner(banner);
        banner = replacePlaceholders(banner, packageNameWithoutScope, packageVersion);
    }

    return banner;
}

function addCommentToBanner(banner: string): string {
    if (!banner || banner.trim().startsWith('/')) {
        return banner;
    }

    const commentLines: string[] = [];
    const bannerLines = banner.split('\n');
    for (let i = 0; i < bannerLines.length; i++) {
        if (bannerLines[i] === '' || bannerLines[i] === '\r') {
            continue;
        }

        const bannerText = bannerLines[i].trim();
        if (i === 0) {
            commentLines.push('/**');
        }
        commentLines.push(` * ${bannerText}`);
    }
    commentLines.push(' */');
    banner = commentLines.join('\n');
    return banner;
}


function replacePlaceholders(banner: string, packageName: string, packageVersion: string): string {
    banner = banner.replace(/\$CURRENT_YEAR\$/gm, (new Date()).getFullYear().toString());
    if (!!packageName) {
        banner = banner.replace(/\$PACKAGE_NAME\$/gm, packageName);
    }
    if (!!packageVersion) {
        banner = banner.replace(/\$PACKAGE_VERSION\$/gm, packageVersion);
    }
    return banner;
}
