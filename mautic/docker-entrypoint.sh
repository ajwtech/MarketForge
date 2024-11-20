#!/bin/bash
echo "Determining Role..."
if [ "$MAUTIC_ROLE" = "mautic_worker" ]; then
    exec /entrypoint_mautic_worker.sh
elif [ "$MAUTIC_ROLE" = "mautic_cron" ]; then
    exec /entrypoint_mautic_cron.sh
elif [ "$MAUTIC_ROLE" = "mautic_web" ]; then
    exec /entrypoint_mautic_web.sh "$@"
elif [ "$MAUTIC_ROLE" = "mautic_init" ]; then
    exec /entrypoint_mautic_init.sh
else
    echo "No valid role specified, exiting"
    exit 1
fi
