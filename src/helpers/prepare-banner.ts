import * as path from 'path';
import * as fs from 'fs-extra';

export function prepareBannerSync(projectRoot: string, baseDir: string, banner: string): string {
    if (!banner) {
        return banner;
    }
    if (banner && /\.txt$/i.test(banner) && fs.existsSync(path.resolve(baseDir, banner))) {
        banner = fs.readFileSync(path.resolve(baseDir, banner), 'utf-8');
    } else if (banner && /\.txt$/i.test(banner) && fs.existsSync(path.resolve(projectRoot, banner))) {
        banner = fs.readFileSync(path.resolve(projectRoot, banner), 'utf-8');
    }

    if (banner) {
        banner = addCommentToBanner(banner);
    }
    return banner;
}

function addCommentToBanner(banner: string): string {
    if (banner && !banner.trim().startsWith('/')) {
        const commentLines: string[] = [];
        const bannerLines = banner.split('\n');
        for (let i = 0; i < bannerLines.length; i++) {
            if (bannerLines[i] === '' || bannerLines[i] === '\r') {
                continue;
            }

            const bannerText = bannerLines[i].trim();
            if (i === 0) {
                commentLines.push('/**');
                commentLines.push(` * ${bannerText}`);
                if (bannerLines.length === 1) {
                    commentLines.push(' */');
                }
            } else {
                commentLines.push(` * ${bannerText}`);
            }
        }
        banner = commentLines.join('\n');
        return banner;
    }
    return banner;
}
