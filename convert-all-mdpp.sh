#!/bin/sh

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

okMsg="[${GREEN}OK${NC}]"
errorMsg="[${RED}ERR${NC}]"

for file in ./store/DEV/*; do
	input=$(echo "$file"| sed -E "s/\.\/store\/DEV\///g" | sed -E "s/\.\///g");
	output=$(echo "$input" | sed -E "s/ DEV$//g");

	echo ":: $input";

	if $(markdown-pp "$file/$input.mdpp" -o "$file/$input.md" 2> /dev/null)
	then
		echo $okMsg "Transpiling..."
		#-- Add MD name into the local .gitignore
		cd "$file";
		gitignore=".gitignore"
		if [ ! -f $gitignore ] || [ ! -s $gitignore ]; then
			echo "$input.md" > $gitignore
			echo $okMsg "MD gitignore created..."
		else
			flag=false
			while IFS="" read -r p || [ -n "$p" ]
			do
				line=$(printf '%s\n' "$p")
				if [[ "$line" == "$input.md" ]]
				then
					flag=true
				fi
			done < $gitignore

			if [[ "$flag" == false ]]
			then
				if [[ ! $(tail -c1 $gitignore | wc -l) -gt 0 ]]
				then
					echo "" >> $gitignore
				fi
				echo "$input.md" >> $gitignore
				echo $okMsg "MD gitignored updated..."
			fi
		fi
		cd ~-

		#-- Move file in the release folder
		if mv "./store/DEV/$input/$input.md" "./store/$output/$output.md" 2> /dev/null
		then
			echo $okMsg "Releasing..."
		else
			echo $errorMsg "Releasing..."
		fi
	else
		echo $errorMsg "Transpiling..."
	fi
	echo ""
done
