import * as path from 'path';

import { InvalidConfigError, ProjectConfigInternal } from '../models';
import { isInFolder, isSamePaths } from '../utils';

export function validateProjectConfig(projectRoot: string, projectConfig: ProjectConfigInternal): void {
    if (!projectConfig.outDir) {
        throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
            }].outDir' is required.`);
    }

    if (projectConfig.srcDir && path.isAbsolute(projectConfig.srcDir)) {
        throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
            }].srcDir' must be relative path.`);
    }
    if (projectConfig.outDir && path.isAbsolute(projectConfig.outDir)) {
        throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
            }].outDir' must be relative path.`);
    }

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');

    if (projectConfig.outDir) {
        const outDir = path.resolve(projectRoot, projectConfig.outDir);

        if (isSamePaths(projectRoot, outDir)) {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].outDir' must NOT be the same as working directory.`);
        }
        if (isSamePaths(srcDir, outDir)) {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].outDir' must NOT be the same as 'srcDir'.`);
        }
        if (outDir === path.parse(outDir).root || outDir === '.') {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].outDir' must NOT be the same as root directory.`);
        }

        const srcDirHomeRoot = path.parse(srcDir).root;
        if (outDir === srcDirHomeRoot) {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].outDir' must NOT be the root directory.`);
        }
        if (isInFolder(outDir, projectRoot)) {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].outDir' must NOT be outside of working directory.`);
        }
        if (isInFolder(outDir, srcDir)) {
            throw new InvalidConfigError(`The '${projectConfig._projectType}s[${projectConfig._index
                }].srcDir' must NOT be inside of 'outDir'.`);
        }
    }
}
