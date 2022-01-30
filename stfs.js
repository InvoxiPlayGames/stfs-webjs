/*
    stfs.js
    MIT License

    Copyright (c) 2022 InvoxiPlayGames

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

// global variables
var STFS_FileBuffer = null; // ArrayBuffer for file
var STFS_UInt8View = null; // Uint8Array for buffer
var STFS_Dirty = false; // whether the state is "dirty", only used for init
var STFS_PackageLoaded = false; // whether a file is loaded or not
var STFS_TableSizeShift = 0; // whether to shift block tables (?)
var STFS_FileTable = []; // table of files

// constants
// package types
const STFS_CON = 0x434F4E20; // console-signed package (content made by the console e.g. save games)
const STFS_LIVE = 0x4C495645; // Xbox Live-signed package (content downloaded from Live e.g. games on demand, arcade games)
const STFS_PIRS = 0x50495253; // Microsoft-signed package (on-disc content e.g. NXE art, installable game content, software updates)
// content types
const STFS_SAVEGAME = 0x1;
const STFS_DLC = 0x2;
const STFS_AVATARITEM = 0x9000;
const STFS_PROFILE = 0x10000;
const STFS_GAMERPIC = 0x20000;
const STFS_THEME = 0x30000;
const STFS_TITLEUPDATE = 0xB0000;
const STFS_ARCADEGAME = 0xD0000;

// endianness swapping functions
function STFS_Swap32(i) {
	return (((i>>24)&0xff) | ((i<<8)&0xff0000) | ((i>>8)&0xff00) | ((i<<24)&0xff000000)) & 0xffffffff;
}
function STFS_Swap24(i) {
	return (((i&0xff)<<16) | i&0x00ff00 | (i>>16)) & 0xffffff;
}
function STFS_Swap16(i) {
	return ((i>>8) | (i<<8)) & 0xffff;
}
// reading functions
function STFS_Read8(offset) {
	if (!STFS_Dirty) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_UInt8View[offset];
}
function STFS_Read16(offset) {
	if (!STFS_Dirty) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return ((STFS_Read8(offset) << 8) | STFS_Read8(offset + 1)) & 0xffff;
}
function STFS_Read32(offset) {
	if (!STFS_Dirty) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return ((STFS_Read16(offset) << 16) | STFS_Read16(offset + 2)) & 0xffffffff;
}
function STFS_Read24(offset) {
	if (!STFS_Dirty) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_Read32(offset - 1) & 0xffffff;
}
function STFS_ReadString(offset, length) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var str = "";
	for (var i = offset; i < offset + length; i+=2) {
		var read = STFS_Read16(i);
		if (read == 0x0000) return str; // assume end
		str += String.fromCharCode(read);
	}
	return str;
}
function STFS_ReadASCIIString(offset, length) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var str = "";
	for (var i = offset; i < offset + length; i++) {
		var read = STFS_UInt8View[i];
		if (read == 0x00) return str; // assume end
		str += String.fromCharCode(read);
	}
	return str;
}
// writing functions
function STFS_Write8(offset, i) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_UInt8View[offset] = i & 0xff;
}
function STFS_Write16(offset, i) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write8(offset, (i >> 8) & 0xff)
	STFS_Write8(offset + 1, i & 0xff)
}
function STFS_Write24(offset, i) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write8(offset, (i >> 16) & 0xff)
	STFS_Write16(offset + 1, i & 0xffff)
}
function STFS_Write32(offset, i) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write16(offset, (i >> 16) & 0xffff)
	STFS_Write16(offset + 2, i & 0xffff)
}
function STFS_WriteString(offset, str) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var length = str.Length;
	var a = 0;
	for (var i = offset; i < offset + length; i+=2) {
		STFS_Write16(i, str.charCodeAt(a++));
	}
	return str;
}

// gets the file type according to the package type constants
function STFS_GetFileType() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_Read32(0);
}
// gets the type of content according to the content type constants
function STFS_GetContentType() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_Read32(0x344);
}
// gets the Title ID that the STFS package is for
function STFS_GetTitleID() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_Read32(0x360);
}
// gets the content ID/header SHA1 of the file as a hex string
function STFS_GetContentID() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var outString = "";
	for (var i = 0x32C; i < 0x340 ; i++) { // hacky hex conversions
		outString += STFS_UInt8View[i].toString(16).padStart(2, '0');
	}
	return outString.toUpperCase();
}
// gets the package name
function STFS_GetPackageName() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_ReadString(0x411, 0x900);
}
// gets the package description
function STFS_GetPackageDescription() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_ReadString(0xD11, 0x900);
}
// gets the publisher name
function STFS_GetPublisherName() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_ReadString(0x1611, 0x80);
}
// gets the Title Name that the STFS package is for
function STFS_GetTitleName() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	return STFS_ReadString(0x1691, 0x80);
}
// gets the package thumbnail as a blob URL
function STFS_GetPackageThumb() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var thumbSize = STFS_Read32(0x1712);
	var thumbSlice = new Uint8Array(STFS_FileBuffer, 0x171A, thumbSize);
	return URL.createObjectURL(new Blob([thumbSlice], {type: "image/png"}));
}
// gets the title thumbnail as a blob URL
function STFS_GetTitleThumb() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	var thumbSize = STFS_Read32(0x1716);
	var thumbSlice = new Uint8Array(STFS_FileBuffer, 0x571A, thumbSize);
	return URL.createObjectURL(new Blob([thumbSlice], {type: "image/png"}));
}

// sets the type of content according to the content type constants
function STFS_SetContentType(contentType) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write32(0x344, contentType);
}
// sets the Title ID that the STFS package is for
function STFS_SetTitleID(titleID) {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write32(0x360, titleID);
}

// initialise file system functions and read file table
function STFS_InitFS() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_FileTable = [];
	var entryID = STFS_Read32(0x340);
	if ((((entryID + 0xFFF) & 0xF000) >> 0xC) != 0xB) STFS_TableSizeShift = 1;
	var tableBlocks = STFS_GetBlocksFromBlock(STFS_Read24(0x379 + 0x4), STFS_Read16(0x379 + 0x2));
	for (var i = 0; i < tableBlocks.length; i++) {
		var offset = STFS_BlockToOffset(tableBlocks[i]);
		while (true) {
			if (STFS_Read8(offset) == 0) break; // assume that if string is null, there's no more fileSize
			var nameLength = STFS_Read8(offset + 0x28);
			var flags = (nameLength & 0xC0) >> 6;
			nameLength = nameLength & 0x3F;
			var fileName = STFS_ReadASCIIString(offset, nameLength);
			var parentDirectory = STFS_Read16(offset + 0x32);
			var fileSize = STFS_Read32(offset + 0x34);
			var startingBlock = STFS_Swap24(STFS_Read24(offset + 0x2F));
			var numOfBlocks = STFS_Swap24(STFS_Read24(offset + 0x29));
			STFS_FileTable.push({ fileName, nameLength, flags, parentDirectory, fileSize, startingBlock, numOfBlocks });
			offset += 0x40;
		}
	}
}
// converts a block number into a file offset
function STFS_BlockToOffset(blockNum) {
	var oBlockNum = blockNum; // keep original value
	if (oBlockNum >= 0xAA) blockNum += ((oBlockNum / 0xAA) + 1) << STFS_TableSizeShift;
	if (oBlockNum >= 0x70E4) blockNum += ((oBlockNum / 0x70E4) + 1) << STFS_TableSizeShift;
	return 0xC000 + (blockNum * 0x1000);
}
// get the offset of the hash table for a given block
function STFS_BlockToHashOffset(blockNum) {
	var record = blockNum % 0xAA;
	var tableIndex = Math.floor(blockNum / 0xAA) * (STFS_TableSizeShift == 1 ? 0xAC : 0xAB);
	if (blockNum >= 0xAA) tableIndex += ((blockNum / 0x70E4) + 1) << STFS_TableSizeShift;
	if (blockNum >= 0x70E4) tableIndex += 1 << STFS_TableSizeShift;
	return (STFS_TableSizeShift == 0 ? 0xB000 : 0x0000) + (tableIndex * 0x1000) + (record * 0x18);
}
// get an array of blocks starting from a given index and count
function STFS_GetBlocksFromBlock(blockNum, blockCount) {
	var blocks = [ blockNum ];
	while (blockCount > 0) {
		var hashOffset = STFS_BlockToHashOffset(blocks.at(-1));
		var newBlock = STFS_Read24(hashOffset + 0x15);
		if (newBlock == blocks.at(-1) || newBlock == 0xFFFFFF) break;
		blocks.push(newBlock)
		blockCount--;
	}
	return blocks;
}
// get an array of file objects
function STFS_GetFileTable() {
	return STFS_FileTable;
}
// get a file based on filename
function STFS_GetFile(fileName) {
	return STFS_FileTable.find(f => f.fileName == fileName);
}
// get the full path to a file, including directory namespaceURI
function STFS_GetFilePath(file) {
	var filePath = file.fileName;
	while (file.parentDirectory != 0xffff) {
		file = STFS_FileTable[file.parentDirectory];
		filePath = file.fileName + "/" + filePath;
	}
	return filePath;
}
// get a blob URL to a file
function STFS_ReadFile(file) {
	if ((file.flags & 2) == 2) throw "This is a directory!";
	var blocks = STFS_GetBlocksFromBlock(file.startingBlock, file.numOfBlocks);
	var blockArrays = [];
	var readRemaining = file.fileSize;
	for (var i = 0; i < blocks.length; i++) {
		var offset = STFS_BlockToOffset(blocks[i]);
		blockArrays.push(new Uint8Array(STFS_FileBuffer, offset, readRemaining < 0x1000 ? readRemaining : 0x1000));
		readRemaining -= 0x1000;
		if (readRemaining <= 0) break;
	}
	return URL.createObjectURL(new Blob(blockArrays, {type: "application/octet-stream"}));
}

// converts + "fake signs" the current buffer as LIVE (only works on patched kernels) 
function STFS_FakeSignLIVE() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write32(0, STFS_LIVE);
	// blank signature and padding
	for (var i = 0x4; i < 0x22C; i++) STFS_UInt8View[i] = 0;
}
// converts + "fake signs" the current buffer as PIRS (only works on patched kernels)
function STFS_FakeSignPIRS() {
	if (!STFS_PackageLoaded) throw 'No STFS package loaded, please run STFS_LoadPackage';
	STFS_Write32(0, STFS_PIRS);
	// blank signature and padding
	for (var i = 0x4; i < 0x22C; i++) STFS_UInt8View[i] = 0;
}

// resets state of the library (clears global variables)
function STFS_Reset() {
	STFS_FileBuffer = null;
	STFS_UInt8View = null;
	STFS_PackageLoaded = false;
	STFS_Dirty = false;
	STFS_TableSizeShift = 0;
	STFS_FileTable = false;
}

// loads an STFS archive, argument = ArrayBuffer
function STFS_LoadPackage(abuf) {
	if (STFS_Dirty) throw 'STFS.js is in a dirty state, please run STFS_Reset';
	if (STFS_PackageLoaded) throw 'STFS file already loaded, please run STFS_Reset';
	if (!abuf instanceof ArrayBuffer) throw 'Input is not arraybuffer';
	if (abuf.byteLength <= 0x971A) throw 'Input file too short';
	STFS_Dirty = true;
	STFS_FileBuffer = abuf;
	STFS_UInt8View = new Uint8Array(STFS_FileBuffer);
	switch (STFS_Read32(0)) {
		case STFS_CON:
		case STFS_LIVE:
		case STFS_PIRS:
		    break;
		default:
		    throw 'Input is not a valid STFS archive';
	}
	STFS_PackageLoaded = true;
	return STFS_PackageLoaded;
}
// gets a blob URL for a STFS archive
function STFS_SavePackage() {
	return URL.createObjectURL(new Blob([STFS_FileBuffer], {type: "application/octet-stream"}));
}

// gets a friendly name for a file type
function STFS_Name_FileType(fileType) {
	switch(fileType) {
		case STFS_CON: return "Console-signed";
		case STFS_PIRS: return "Microsoft-signed";
		case STFS_LIVE: return "Xbox Live-signed";
		default: return "Unknown Type " + fileType.toString(16);
	}
}
// gets a friendly name for a content type
function STFS_Name_ContentType(contentType) {
	switch(contentType) {
        case STFS_SAVEGAME: return "Saved Game";
		case STFS_DLC: return "Downloadable Content";
		case STFS_PROFILE: return "User Profile";
		case STFS_ARCADEGAME: return "Xbox Live Arcade Game";
		case STFS_TITLEUPDATE: return "Title Update";
		default: return "Unknown Type " + contentType.toString(16);
	}
}