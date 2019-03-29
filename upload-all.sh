#!/usr/bin/env bash

csonFile=${1:-"v2-test.cson"}
jsFileList=$( cat "$csonFile" | sed -e '1,/scripts:/d' | grep -v \# | grep -v \] | sed '/^[[:space:]]*$/d' | cut -d: -f2 | sed "s/'//g" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' )
mdFileList=$( echo "$jsFileList" | sed 's/\(.*\.\)js/\1md/' )
jsonFileList=$( echo "$jsFileList" | sed 's/\(.*\.\)js/\1json/' )
allFilesList=$( echo "$jsFileList\n$mdFileList\n$jsonFileList" )
IFS=$'\n'
for file in $allFilesList; do
    phantombuster -c $csonFile "$file"
done
