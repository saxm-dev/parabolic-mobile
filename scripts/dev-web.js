// Dev-server launcher that pins Metro to the REAL project path.
//
// The Claude preview tool starts servers from a junction inside the session
// root (OneDrive). Windows file-watch events don't propagate through the
// junction, so Metro never sees edits. Resolving to the physical path first
// makes the watcher (and typed-route generation) work normally.
const { realpathSync } = require('fs');
const path = require('path');

const realRoot = realpathSync(path.join(__dirname, '..'));
process.chdir(realRoot);
process.argv = [process.argv[0], path.join(realRoot, 'node_modules/expo/bin/cli'), 'start', '--web', '--port', '8081'];
require(path.join(realRoot, 'node_modules/expo/bin/cli'));
