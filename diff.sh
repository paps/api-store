#!/usr/bin/env bash

if [ $# -lt 1 ]
then
  echo "Usage: $0 js|json|md|lib"
  exit 1
fi

if [ -x "$(command -v colordiff)" ]; then
  diffcmd='colordiff'
  diffarg=''
else
  diffcmd='diff'
  diffarg='--color'
fi

if [[ "$1" == "lib" ]]; then

  cd libs
  for i in *.js; do
    dev=DEV/`echo $i | sed 's/\.js$/-DEV\.js/'`
    $diffcmd $diffarg --context=0 "$i" "$dev"
  done
  cd ..

else

  cd store
  for i in */; do
    if [[ "$i" != "DEV/" ]]; then
      if [[ "$1" == "js" ]]; then
        prod=$i`echo $i | sed 's/\/$/.js/'`
        dev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.js/'`
      elif [[ "$1" == "json" ]]; then
        prod=$i`echo $i | sed 's/\/$/.json/'`
        dev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.json/'`
      elif [[ "$1" == "md" ]]; then
        prod=$i`echo $i | sed 's/\/$/.md/'`
        dev=DEV/`echo $i | sed 's/\/$/ DEV/'`/`echo $i | sed 's/\/$/ DEV.md/'`
      fi
      $diffcmd $diffarg --context=0 "$prod" "$dev"
    fi
  done
  cd ..

fi
