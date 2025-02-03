#!/bin/bash
composer update

# remove files not required in production
readarray -t FILES << EOS
smarty/smarty/demo
smarty/smarty/docs
smarty/smarty/*.sh
dg/rss-php/.github
tecnickcom/tcpdf/examples
tecnickcom/tcpdf/tools
EOS

# set -x
for FILE in ${FILES[*]}; do
    if [[ $FILE ]]
    then
        rm -rf ./vendor/${FILE}
    fi
done

echo "OK"
