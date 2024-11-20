#!/bin/bash
set -e

# Define source and destination directories
SOURCE="/var/www/html/"
DESTINATION="/datastore"
LOGDIR="/datastore/var/logs"
LOGFILE="$LOGDIR/init_$(date +'%Y%m%d_%H%M%S').log"

# Function to rotate logs
rotate_logs() {
    local logdir=$1
    local max_logs=$2
    local log_count

    log_count=$(ls -1 "$logdir"/*.log 2>/dev/null | wc -l)
    if [ "$log_count" -gt "$max_logs" ]; then
        ls -1t "$logdir"/*.log | tail -n +$((max_logs + 1)) | xargs rm -f
    fi
}

# Rotate logs, keeping only the last 5
rotate_logs "$LOGDIR" 5

# Create necessary directories if they don't exist
mkdir -p "$DESTINATION"
mkdir -p "$LOGDIR"

# Create the log file
touch "$LOGFILE"

# Redirect output to log file
exec > >(tee -a "$LOGFILE") 2>&1

# Debug statements
echo "Log directory: $LOGDIR"
echo "Log file: $LOGFILE"

# Retrieve the environment variables
CONTAINER_APP_REVISION=${CONTAINER_APP_REVISION:-}
STORAGE_ACCOUNT_NAME=${STORAGE_ACCOUNT_NAME:-}
STORAGE_ACCOUNT_KEY=${STORAGE_ACCOUNT_KEY:-}
FILE_SHARE_NAME=${FILE_SHARE_NAME:-}

echo "Initializing container: Syncing files from $SOURCE to $DESTINATION..."

# Check if running in Azure environment
if [ -n "$STORAGE_ACCOUNT_KEY" ]; then
    echo "Using rclone for Azure environment..."

    # Install rclone
    apk add curl
    curl https://rclone.org/install.sh | bash

    # Configure rclone for Azure file share
    rclone config create azurefiles azureblob account="$STORAGE_ACCOUNT_NAME" key="$STORAGE_ACCOUNT_KEY"

    # Use rclone to copy or update files
    echo "Starting rclone sync..."
    rclone sync "$SOURCE" "azurefiles:$FILE_SHARE_NAME" --exclude 'config/local.php' --exclude 'var/logs' --progress --size-only || { echo "Rclone sync failed"; exit 1; }
    echo "rclone sync completed."

    # Copy local.php if it doesn't exist in the destination but does exist in the source. Otherwise, skip.
    if [ -f "$SOURCE/config/local.php" ]; then
        echo "Copying local.php using rclone..."
        rclone copy "$SOURCE/config/local.php" "azurefiles:$FILE_SHARE_NAME/config/" --ignore-existing --progress --size-only || { echo "Rclone for local.php failed"; exit 1; }
        echo "local.php copied successfully."
    else
        echo "local.php does not exist in the source directory, skipping."
    fi
else
    echo "Using rsync for local environment..."

    # Install rsync
    apk add rsync

    # Use rsync to copy or update files
    echo "Starting rsync..."
    rsync -a --progress --exclude='config/local.php' --exclude='var/logs' "$SOURCE" "$DESTINATION/" || { echo "Rsync failed"; exit 1; }
    echo "rsync completed."

    # Copy local.php if it doesn't exist in the destination but does exist in the source. Otherwise, skip.
    if [ -f "$SOURCE/config/local.php" ]; then
        echo "Copying local.php using rsync..."
        rsync -a --ignore-existing "$SOURCE/config/local.php" "$DESTINATION/config/" || { echo "Rsync for local.php failed"; exit 1; }
        echo "local.php copied successfully."
    else
        echo "local.php does not exist in the source directory, skipping."
    fi
fi

echo "Sync operation completed successfully."
echo "Init container completed successfully."