#!/usr/bin/env zsh

cd libs
for i in *(.)
do
  dev=dev/`echo $i | sed 's/\.js/-DEV\.js/g'`
  diff --color --context=2 $i $dev
done
cd ..

cd store
for i in *(.)
do
  dev=dev/`echo $i | sed 's/\.js/ DEV\.js/g'`
  diff --color --context=2 $i $dev
done
cd ..
