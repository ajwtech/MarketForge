#!/bin/sh
set -e

# Check for missing environment variables for installation
for var in APP_ENV DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME SITE_URL; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required environment variable $var is not set"
    exit 1
  fi
done

echo "Checking if SuiteCRM needs installation..."

# Wait briefly for PHP-FPM to start before continuing
sleep 5

if [ ! -f "/var/suitecrm/www/html/public/legacy/config.php" ] || grep -q "'installer_locked' => false" "/var/suitecrm/www/html/public/legacy/config.php" 2>/dev/null; then
  echo "Installation required. Running SuiteCRM installer..."

  # Before installation double check that the database is 
  # reachable from the supervisor hosted process
  echo "Verifying database connection and permissions..."
  if ! ./bin/console doctrine:database:create --if-not-exists; then
    echo "ERROR: Could not connect to database or create it"
    exit 1
  fi

  # Before installation
  echo "Clearing cache..."
  rm -rf var/cache/*
  mkdir -p var/cache
  chmod -R 775 var/cache

  echo "php-fpm is up. Running installer..."
  if ./bin/console suitecrm:app:install \
    -W "true" \
    -e "${APP_ENV}" \
    -H "${DB_HOST}" \
    -Z "${DB_PORT}" \
    -u "${DB_USER}" \
    -p "${DB_PASSWORD}" \
    -U "${DB_USER}" \
    -P "${DB_PASSWORD}" \
    -N "${DB_NAME}" \
    -S "${SITE_URL}" \
    -d "no" \
    --no-interaction \
    --no-debug; then
    
    echo "Setting permissions..."
    find . -type d -not -perm 2775 -exec chmod 2775 {} \;
    find . -type f -not -perm 0664 -exec chmod 0664 {} \;
    find . ! -user root -exec chown root:www-data {} \;
    chmod +x bin/console

    echo "Locking installer..."
    APP_CONFIG="/var/suitecrm/www/html/public/legacy/config.php"
    PERSISTENT_CONFIG="/mnt/persistent-config/config.php"
    
    # Check if the config file is a symlink
    if [ -L "$APP_CONFIG" ]; then
      echo "Config file is a symlink. Updating persistent config..."
      # Update the target of the symlink
      sed -i "s/'installer_locked' => false/'installer_locked' => true/" "$PERSISTENT_CONFIG"
    else
      # If it's not a symlink, ensure it's copied to persistent storage
      echo "Config file is not a symlink. Copying to persistent storage..."
      sed -i "s/'installer_locked' => false/'installer_locked' => true/" "$APP_CONFIG"
      
      # Ensure persistent directory exists
      mkdir -p /mnt/persistent-config
      
      # Copy to persistent storage
      cp -f "$APP_CONFIG" "$PERSISTENT_CONFIG"
      
      # Remove original and create symlink
      rm -f "$APP_CONFIG"
      ln -sf "$PERSISTENT_CONFIG" "$APP_CONFIG"
      
      # Set proper permissions
      chmod 664 "$PERSISTENT_CONFIG"
      chown root:www-data "$PERSISTENT_CONFIG"
    fi

    echo "SuiteCRM installer completed successfully."
  else
    echo "ERROR: SuiteCRM installation failed"
    exit 1
  fi
else
  echo "Installation already completed or config file not found."
  # Check if installation is already complete
  if [ -f "/var/suitecrm/www/html/public/legacy/config.php" ] && grep -q "'installer_locked' => true" "/var/suitecrm/www/html/public/legacy/config.php"; then
    echo "SuiteCRM is already installed and locked."
  else
    echo "WARNING: Could not determine installation status. Config file may be missing or corrupt."
  fi
fi

# Exit successfully for supervisor
exit 0