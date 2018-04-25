#!/usr/bin/env zsh

unamestr=`uname`

if [[ "$unamestr" == 'Linux' ]]; then
  diffcmd='diff'
  diffarg='--color'
elif [[ "$unamestr" == 'Darwin' ]]; then
  diffcmd='colordiff'
  diffarg=''
else
  echo "Could not determine OS / diff binary"
  exit 1
fi

cd libs
for i in *(.); do
  dev=DEV/`echo $i | sed 's/\.js$/-DEV\.js/'`
  $diffcmd $diffarg --context=2 "$i" "$dev"
done
cd ..

cd store
for i in */; do
  if [[ "$i" != "DEV/" ]]; then
    jsprod=$i`echo $i | sed 's/\/$/.js/'`
    jsdev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.js/'`
    jsonprod=$i`echo $i | sed 's/\/$/.json/'`
    jsondev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.json/'`
    mdprod=$i`echo $i | sed 's/\/$/.md/'`
    mddev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.md/'`
    $diffcmd $diffarg --context=2 "$jsprod" "$jsdev"
  fi
done
cd ..
