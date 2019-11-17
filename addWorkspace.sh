#!/bin/bash

# the workspace type
# this is used as the main directory and a prefix on the package name
ws_type="$1"
# workspace name
ws_name="$2"
# the directory of the workspace
ws_dir="$ws_type/$ws_name"
# the scoped name of the workspace
# this is the package name in package.json
# as well as how other packages can reference it
ws_scoped_name="@local-$ws_type/$ws_name"

infoStr () {
	echo -en "$1 \t...\t"
}

failStr () {
	echo -e "\n\t$1\n"
	exit 1
}

passFail () {
	if [[ $? == 0 ]]; then
		echo " [ OK ]"
	else
		echo " [ FAIL ]"
		failStr "$1"
	fi
}

# basic sanity checks
[[ -z "$ws_type" ]] && failStr "No workspace type defined"
[[ -z "$ws_name" ]] && failStr "No workspace name defined"

# check if the root package.json is private and has workspaces directories assigned
wsRequirements () {
	infoStr "Checking for workspace requirements"
	grep -q '"private": true' package.json && grep -q '"workspaces":' package.json
	passFail "Make sure this project is private and that you have defined workspace directories."
}

# create the directories
createDirs () {
	infoStr "Creating workspace directories"

	[[ ! -d "$ws_dir" ]] && mkdir -p "$ws_dir"

	passFail "Workspace already exists. "
}

initPackage () {
	npm init --silent --yes >> /dev/null 2>&1 && yarn init --silent --yes --private >> /dev/null 2>&1
	passFail "Unable to initialize node package manager"
}

initWs () {
	infoStr "Crate Workspace Name"
	echo "{\"name\": \"$ws_scoped_name\"}" > "$ws_dir/package.json"
	passFail "Could not write to package.json"

	# note that the initPackage function contains the passFail call
	# because we want to ensure the 'cd -' is always called
	infoStr "Initializing workspace"
	cd "$ws_dir" && initPackage; cd - >> /dev/null 2>&1
}

verifyWs () {
	infoStr "Verifying workspace $ws_scoped_name setup"
	yarn workspaces info | grep -q "$ws_scoped_name"
	passFail "workspace was not setup properly"
}

wsRequirements
createDirs
initWs
verifyWs
