#!/bin/sh

GREEN='\033[0;32m'
NC='\033[0m' # No Color

cd ./store/DEV
for file in ./*
do
	cd "$file";
	echo "$file.mdpp\c";
	markdown-pp "$file.mdpp" -o "$file.md" 2> /dev/null && echo "${GREEN} -> $file.md${NC}\c"
	echo ""
	cd ..;
done
