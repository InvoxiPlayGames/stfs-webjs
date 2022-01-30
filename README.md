# stfs-webjs

Read Xbox 360 STFS archives (savegames, updates, DLC, etc) in the web browser.

This is not to be trusted to produce reliable output. This was made solely as an experiment.

A live example is available at https://invoxiplaygames.github.io/stfs-webjs/stfs.html

## Usage

```js
// Load an array buffer with an STFS file
STFS_LoadPackage(FileArrayBuffer);
// Print the package name
console.log(STFS_GetPackageName());
// Reset the library to use another file.
STFS_Reset();
```