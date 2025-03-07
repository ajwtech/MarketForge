#!/bin/bash

# If the config mount is empty, populate it from the backup
if [ -z "$(ls -A /opt/app/config)" ]; then
  echo "Config mount is empty. Populating with initial configuration..."
  cp -r /opt/app/config-backup/* /opt/app/config/
fi

# Execute the original command
exec "$@"
