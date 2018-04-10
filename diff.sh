#!/usr/bin/env zsh

unamestr=`uname`

if [[ "$unamestr" == 'Linux' ]]; then
  diffcmd='diff --color'
elif [[ "$unamestr" == 'Darwin' ]]; then
  diffcmd='colordiff'
else
  echo "Could not determine OS / diff binary"
  exit 1
fi

cd libs
for i in *(.)
do
  dev=dev/`echo $i | sed 's/\.js/-DEV\.js/g'`
  $diffcmd --context=2 $i $dev
done
cd ..

cd store
for i in *(.)
do
  dev=dev/`echo $i | sed 's/\.js/ DEV\.js/g'`
  $diffcmd --context=2 $i $dev
done
cd ..
