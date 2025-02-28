#!/bin/sh

# Ensure the script exits on any error
set -e
umask 0002
# Regular container execution
echo "Main container: Checking application population..."

if [ ! -d "/var/suitecrm/www/html/" ] || [ -z "$(ls -A /var/suitecrm/www/html/)" ]; then
  echo "Error: /var/suitecrm/www/html/ is not populated. Exiting..."
  exit 1
else
  echo "docroot is populated. Continuing..."
fi

# Define paths
CONFIG_DIR="/var/suitecrm/www/html/public/legacy"
PERSISTENT_DIR="/mnt/persistent-config"
CONFIG_FILES="config.php config_override.php"

# Ensure persistent directory exists
mkdir -p $PERSISTENT_DIR
echo "Persistent config directory: $PERSISTENT_DIR"
ls -la $PERSISTENT_DIR

for CONFIG_FILE in $CONFIG_FILES; do
  # Full paths
  APP_CONFIG_PATH="$CONFIG_DIR/$CONFIG_FILE"
  PERSISTENT_CONFIG_PATH="$PERSISTENT_DIR/$CONFIG_FILE"
  
  echo "Checking config file: $CONFIG_FILE"
  echo "App path: $APP_CONFIG_PATH"
  echo "Persistent path: $PERSISTENT_CONFIG_PATH"

  # If persistent config exists, always use it
  if [ -f "$PERSISTENT_CONFIG_PATH" ]; then
    echo "Found persistent config for $CONFIG_FILE"
    
    # Remove any existing app config or symlink
    if [ -e "$APP_CONFIG_PATH" ] || [ -L "$APP_CONFIG_PATH" ]; then
      echo "Removing existing app config file or symlink"
      rm -f "$APP_CONFIG_PATH"
    fi
    
    # Create symlink or copy file (symlink might be more reliable)
    echo "Creating symlink from $PERSISTENT_CONFIG_PATH to $APP_CONFIG_PATH"
    ln -sf "$PERSISTENT_CONFIG_PATH" "$APP_CONFIG_PATH"
    
  # If app config exists but persistent doesn't
  elif [ -f "$APP_CONFIG_PATH" ] && [ ! -L "$APP_CONFIG_PATH" ]; then
    echo "App config exists but no persistent config for $CONFIG_FILE. Copying to persistent storage."
    cp -f "$APP_CONFIG_PATH" "$PERSISTENT_CONFIG_PATH"
    rm -f "$APP_CONFIG_PATH"
    ln -sf "$PERSISTENT_CONFIG_PATH" "$APP_CONFIG_PATH"
  else
    echo "No config found for $CONFIG_FILE. Will be created during installation if needed."
  fi
done

# Debugging: List what we have after setup
echo "Contents of $CONFIG_DIR after setup:"
ls -la $CONFIG_DIR
echo "Contents of $PERSISTENT_DIR after setup:"
ls -la $PERSISTENT_DIR

echo "Waiting for MySQL to be ready..."
echo "DB_HOST: ${DB_HOST}"
echo "DB_NAME: ${DB_NAME}"
echo "DB_PORT: ${DB_PORT}"
echo "DB_USER: ${DB_USER}"
echo "DB_TYPE: ${DB_TYPE}"
until mysqladmin --host ${DB_HOST} --port ${DB_PORT} --user ${DB_USER} --password=${DB_PASSWORD} ping | grep -q "mysqld is alive"; do
    sleep 2
done
echo "Connection Successful: MySQL is up and running!"

envsubst '${APP_ENV} \
          ${DB_HOST} \
          ${DB_PORT} \
          ${DB_USER} \
          ${DB_PASSWORD} \
          ${DB_NAME} \
          ${DB_TYPE} \
          ${DB_VERSION} \
          ${DB_CHARSET} \
          ${siteFQDN} '  \
          < /var/template/.template.env > .env.local

COMPOSER_ALLOW_SUPERUSER=1 composer dump-env prod

# Add cache directory creation for critical paths If this is missing the folders are created with root:root permissions
echo "Creating legacy cache directories..."
mkdir -p /var/suitecrm/www/html/public/legacy/cache/modules/{Users,Employees,UserPreferences,Administration}
mkdir -p /var/suitecrm/www/html/public/legacy/cache/smarty/templates_c
mkdir -p /var/suitecrm/www/html/public/legacy/cache/themes



echo "Setting permissions..."
find /var/suitecrm/www/html/public -type d -not -perm 2775 -exec chmod 2775 {} \;
find /var/suitecrm/www/html/public -type f -not -perm 0664 -exec chmod 0664 {} \;
find /var/suitecrm/www/html/public ! -user root -exec chown root:www-data {} \;
chmod +x bin/console


exec "$@"

