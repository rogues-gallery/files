const path = require('path');
const fs = require("fs");
const glob = require('glob');
const fse = require('fs-extra');


// Verbose is enabled by default
let verbose = true;

// If npm color module is installed
// @see : https://github.com/marak/colors.js/
const hasColorModule = ('yellow' in String.prototype);

// Color code by indexes
const colorCodeByLevels = ['yellow', 'grey'];

/**
 * Show a log, only if verbose is enabled.
 * Will use colors if npm module colors is installed
 * @see : https://github.com/marak/colors.js/
 * @param pLogContent Content to show
 * @param pLogLevel Color level (0 -> yellow, 1 -> light grey)
 */
const colorLog = (pLogContent, pLogLevel) =>
{
	// Enable log only if verbose is enabled
	verbose && console.log(

		// If we have color module, show with colors
		hasColorModule
		? pLogContent[ colorCodeByLevels[pLogLevel]  ]

		// Without colors
		: pLogContent
	);
}

/**
 * Compute destination path depending of a file name (to move and copy) and a destination path as argument.
 * If the argument destination path has a trailing slash, this method will return the file name prepended with the destination path as a directory.
 * Without trailing slash, the last part of the argument destination path will be replaced by the file name.
 *
 * Simpler : Trailing slash means we move or copy the file inside the directory
 *
 * @param pDestination Destination path, with or without trailing slash
 * @param pFilePath File path to get the file name if there is a trailing slash.
 */
const targetDirectoryWithTrailingSlash = (pDestination, pFilePath) =>
{
	return (
		// If there is a trailing slash
		(pDestination.lastIndexOf('/') === pDestination.length - 1)

		// We compute path by adding the file name inside the destination directory
		? path.join(pDestination, path.basename( pFilePath ))

		// Otherwise, we just return the destination
		: pDestination
	);
};


/**
 * Files class.
 * Can represent a list of files or folders.
 * Can't represent both files and folders.
 * Target files from a glob.
 * @see https://github.com/isaacs/node-glob
 */
class Files
{
	/**
	 * Target existing files from a glob.
	 */
	static getFiles (pGlob)
	{
		return new Files(pGlob, false, true, false);
	}

	/**
	 * Target existing folders from a glob.
	 */
	static getFolders (pGlob)
	{
		return new Files(pGlob, false, false, true);
	}

	/**
	 * Target any file or folders.
	 */
	static any (pPath)
	{
		return new Files(pPath, false, false, false);
	}

	/**
	 * Target a non existing file or folder.
	 */
	static new (pPath)
	{
		return new Files(pPath, true, false, false);
	}

	/**
	 * Enable or disable console log
	 */
	static setVerbose ( pVerbose )
	{
		verbose = pVerbose;
	}


	/**
	 * Target files list or folder from a glog.
	 * Can target files and folder if not filtered.
	 * @param pGlob Glob pattern.
	 * @param pNew If true, will target nothing.
	 * @param pOnlyFiles If true, will only target existing files.
	 * @param pOnlyFolders If true, will only target existing folders.
	 */
	constructor (pGlob, pNew, pOnlyFiles, pOnlyFolders)
	{
		// Record glob for logging and new files
		this.glob = pGlob;

		// Target files with glob or new array if this is a new file
		this.files = pNew ? [] : glob.sync( this.glob );

		// Filter files or folders
		pOnlyFiles && this.onlyExistingFiles();
		pOnlyFolders && this.onlyExistingFolders();
	}

	/**
	 * Filter glob to target only existing files.
	 */
	onlyExistingFiles ()
	{
		// Filter files or folder
		this.files = this.files.filter(
			file => fs.lstatSync( file ).isFile()
		);
	}

	/**
	 * Filter glob to target only existing folders.
	 */
	onlyExistingFolders ()
	{
		// Filter files or folder
		this.files = this.files.filter(
			file => fs.lstatSync( file ).isDirectory()
		);
	}


	/**
	 * Check if this glob is targeting existing files or folders.
	 * @returns {boolean}
	 */
	exists ()
	{
		return (this.files.length > 0);
	}

	/**
	 * Browse through all targeted files or folders from glob.
	 * @param pHandler First argument will be the file or folder path
	 */
	all ( pHandler )
	{
		return this.files.map( pHandler );
	}

	/**
	 * Delete all targeted files or folders.
	 * No warning.
	 * @return {number} Total removed files.
	 */
	delete ()
	{
		colorLog(`Files.delete ${this.glob} ...`, 0);

		// Browse files or folders
		this.files.map( file =>
		{
			// Remove
			fse.removeSync( file );
			colorLog(`	Deleted ${file}`, 1);
		});

		// Return total deleted files and remove targeted files list
		const totalFiles = this.files.length;
		this.files = [];
		return totalFiles;
	}

	/**
	 * Delete all targeted files or folders.
	 * No warning.
	 * @return {number} Total removed files.
	 */
	remove ()
	{
		return this.delete();
	}

	/**
	 * Move all targeted files or folders inside a directory.
	 * Add a trailing slash to force directory creation.
	 * Files list will be updated with new moved file paths.
	 * @param pDestination Directory path where all files / folders will be moved into. No glob.
	 * @return {number} Total moved files.
	 */
	moveTo ( pDestination )
	{
		colorLog(`Files.moveTo ${this.glob} ...`, 0);

		// Browse files or folders
		const newFiles = [];
		this.files.map( file =>
		{
			// Get file name and compute destination
			// We target a directory if there is a trailing slash into the destination.
			const destination = targetDirectoryWithTrailingSlash( pDestination, file );

			// Move
			fse.moveSync( file, destination );
			colorLog(`	${file} moved to ${destination}`, 1);

			// Add moved file to new files list
			newFiles.push( destination );
		});

		// Return total moved files and update files list
		const totalFiles = this.files.length;
		this.files = newFiles;
		return totalFiles;
	}

	/**
	 * Copy all targeted files or folders inside a directory.
	 * Add a trailing slash to force directory creation.
	 * Files list will stay the same after using this method.
	 * @param pDestination Directory path where all files / folders will be copied into. No glob.
	 * @return {number} Total copied files.
	 */
	copyTo ( pDestination )
	{
		colorLog(`Files.copyTo ${this.glob} ...`, 0);

		// Browse files or folders
		this.files.map( file =>
		{
			// Get file name and compute destination
			// We target a directory if there is a trailing slash into the destination.
			const destination = targetDirectoryWithTrailingSlash( pDestination, file );

			// Copy
			fse.copySync( file, destination );
			colorLog(`	${file} copied to ${destination}`, 1);
		});

		// Return total copied files and do not alter files.
		return this.files.length;
	}

	/**
	 * Read file content.
	 * Only work if glob is pointing to an existing file.
	 * Returns null if the file is not found.
	 * @param pEncoding default is utf-8
	 * @returns {Buffer}
	 */
	read (pEncoding = 'utf-8')
	{
		// Read file from disk and return null if file does not exists
		return (
			fs.existsSync( this.glob )
			? fs.readFileSync( this.glob, { encoding: pEncoding } )
			: null
		)
	}

	/**
	 * Write file content.
	 * Will use glob to create the file.
	 * @param pContent Content of the file to write, as a string
	 * @param pEncoding default is utf-8
	 */
	write (pContent = '', pEncoding = 'utf-8')
	{
		// Create parent folders recursively
		fse.ensureDirSync( path.dirname( this.glob ) );

		// Write file to disk
		fs.writeFileSync( this.glob, pContent, { encoding: pEncoding } );
	}

	/**
	 * Add content to an existing file.
	 * Will create file if it does not exists
	 * @param pContent Content to append
	 * @param pNewLine If true, will create a new line.
	 * @param pEncoding default is utf-8
	 */
	append (pContent = '', pNewLine = true, pEncoding = 'utf-8')
	{
		// Create parent folders recursively
		fse.ensureDirSync( path.dirname( this.glob ) );

		// Prepend content by a new line
		// Do not do it if this is the first line
		const before = (
			!fs.existsSync( this.glob ) || !pNewLine ? '' : "\n"
		);

		// Append content to the file
		fs.appendFileSync( this.glob, before + pContent, { encoding: pEncoding } );
	}

	/**
	 * Create parent folders if they do not exists.
	 * Will use glob if there is no targeted files.
	 */
	createFolders ()
	{
		// If there is no targeted files
		if (this.files.length === 0)
		{
			// Use glob so we can ensure dir for new files
			fse.ensureDirSync( this.glob );
		}

		// But if there is targeted files
		else
		{
			// Use files list to ensure dir because glob is not a real path
			this.files.map( file => fse.ensureDirSync( file ) );
		}
	}

	/**
	 * Create parent folders if they do not exists.
	 * Will use glob if there is no targeted files.
	 */
	ensureFolders ()
	{
		this.createFolders();
	}

	/**
	 * Update a file with an handler.
	 * Will read file content and pass it as first argument of the handler.
	 * Will write file content from handler return.
	 * @param pHandler Will have file content as first argument. Return new file content to be written.
	 */
	alter ( pHandler )
	{
		this.write(
			pHandler(
				this.read()
			)
		);
	}

	/**
	 * Update a JSON file with an handler.
	 * @param pHandler Will have JSON content as first argument. Return new JSON content to be written.
	 * @param pSpaces Spaces size. Null to uglify.
	 */
	alterJSON ( pHandler, pSpaces = 2 )
	{
		this.write(
			JSON.stringify(
				pHandler(
					JSON.parse(
						this.read().toString()
					)
				),
				null,
				pSpaces
			)
		);
	}
}

/**
 * Exports public API
 */
module.exports = { Files };