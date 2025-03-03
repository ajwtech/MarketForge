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

# OAuth2 key handling with persistent storage
OAUTH_DIR="/var/suitecrm/www/html/public/legacy/Api/V8/OAuth2"
PERSISTENT_OAUTH_DIR="$PERSISTENT_DIR/OAuth2"

# Ensure persistent OAuth2 directory exists
mkdir -p $PERSISTENT_OAUTH_DIR
echo "Persistent OAuth2 directory: $PERSISTENT_OAUTH_DIR"
mkdir -p "$OAUTH_DIR"
chmod 750 "$OAUTH_DIR"
chown root:www-data "$OAUTH_DIR"

# Handle private.key and public.key
for KEY_FILE in private.key public.key; do
  # Full paths
  APP_KEY_PATH="$OAUTH_DIR/$KEY_FILE"
  PERSISTENT_KEY_PATH="$PERSISTENT_OAUTH_DIR/$KEY_FILE"
  
  echo "Checking OAuth2 key file: $KEY_FILE"
  echo "App path: $APP_KEY_PATH"
  echo "Persistent path: $PERSISTENT_KEY_PATH"

  # If persistent key exists, always use it
  if [ -f "$PERSISTENT_KEY_PATH" ]; then
    echo "Found persistent OAuth2 key for $KEY_FILE"
    
    # Remove any existing key file or symlink
    if [ -e "$APP_KEY_PATH" ] || [ -L "$APP_KEY_PATH" ]; then
      echo "Removing existing app key file or symlink"
      rm -f "$APP_KEY_PATH"
    fi
    
    # Try to create a hard link first
    echo "Trying hard link from $PERSISTENT_KEY_PATH to $APP_KEY_PATH"
    if ! ln "$PERSISTENT_KEY_PATH" "$APP_KEY_PATH" 2>/dev/null; then
      echo "Hard link failed (likely cross-device). Falling back to file copy."
      # Copy the file with correct permissions
      cp -f "$PERSISTENT_KEY_PATH" "$APP_KEY_PATH"
      chmod 640 "$APP_KEY_PATH"
      chown root:www-data "$APP_KEY_PATH"
    fi
  fi
done

# Only generate keys if they don't exist in persistent storage
if [ ! -f "$PERSISTENT_OAUTH_DIR/private.key" ] || [ ! -f "$PERSISTENT_OAUTH_DIR/public.key" ]; then
    echo "Generating OAuth2 keys..."
    
    # Try multiple approaches to generate the keys
    KEY_GEN_SUCCESS=0
    
    # First try SuiteCRM built-in commands (try different possible commands)
    echo "Trying SuiteCRM built-in commands to generate OAuth2 keys..."
    if php bin/console suitecrm:oauth:key:generate 2>/dev/null; then
        KEY_GEN_SUCCESS=1
        echo "Keys generated successfully with suitecrm:oauth:key:generate"
    elif php bin/console oauth:keys:generate 2>/dev/null; then
        KEY_GEN_SUCCESS=1
        echo "Keys generated successfully with oauth:keys:generate"
    else
        echo "No built-in commands worked for key generation"
    fi
    
    # If built-in commands failed, use OpenSSL to generate keys manually
    if [ $KEY_GEN_SUCCESS -eq 0 ]; then
        echo "Using OpenSSL to manually generate OAuth2 keys..."
        
        # Generate private key
        openssl genrsa -out "$PERSISTENT_OAUTH_DIR/private.key" 2048
        chmod 640 "$PERSISTENT_OAUTH_DIR/private.key"
        chown root:www-data "$PERSISTENT_OAUTH_DIR/private.key"
        
        # Generate public key from private key
        openssl rsa -in "$PERSISTENT_OAUTH_DIR/private.key" -pubout -out "$PERSISTENT_OAUTH_DIR/public.key"
        chmod 640 "$PERSISTENT_OAUTH_DIR/public.key"
        chown root:www-data "$PERSISTENT_OAUTH_DIR/public.key"
        
        if [ -f "$PERSISTENT_OAUTH_DIR/private.key" ] && [ -f "$PERSISTENT_OAUTH_DIR/public.key" ]; then
            KEY_GEN_SUCCESS=1
            echo "Keys generated successfully with OpenSSL"
            
            # Try hard link first, fall back to copy
            echo "Trying to create links to application directory..."
            if ! ln "$PERSISTENT_OAUTH_DIR/private.key" "$OAUTH_DIR/private.key" 2>/dev/null; then
                echo "Hard link failed. Using file copy for private.key."
                cp -f "$PERSISTENT_OAUTH_DIR/private.key" "$OAUTH_DIR/private.key"
                chmod 640 "$OAUTH_DIR/private.key"
                chown root:www-data "$OAUTH_DIR/private.key"
            fi
            
            if ! ln "$PERSISTENT_OAUTH_DIR/public.key" "$OAUTH_DIR/public.key" 2>/dev/null; then
                echo "Hard link failed. Using file copy for public.key."
                # FIX: Corrected path to use slash instead of dot
                cp -f "$PERSISTENT_OAUTH_DIR/public.key" "$OAUTH_DIR/public.key"
                chmod 640 "$OAUTH_DIR/public.key"
                chown root:www-data "$OAUTH_DIR/public.key"
            fi
        else
            echo "ERROR: Failed to generate OAuth2 keys with OpenSSL"
        fi
    else
        # If keys were generated by SuiteCRM command but in app directory, copy to persistent storage
        if [ -f "$OAUTH_DIR/private.key" ] && [ ! -L "$OAUTH_DIR/private.key" ]; then
            # First set the correct permissions on the app file
            chmod 640 "$OAUTH_DIR/private.key"
            chown root:www-data "$OAUTH_DIR/private.key"
            
            # Copy to persistent storage with correct permissions
            cp -f "$OAUTH_DIR/private.key" "$PERSISTENT_OAUTH_DIR/private.key"
            chmod 640 "$PERSISTENT_OAUTH_DIR/private.key"
            chown root:www-data "$PERSISTENT_OAUTH_DIR/private.key"
            
            # We keep the original file as is, no need to remove and recreate
        fi
        
        if [ -f "$OAUTH_DIR/public.key" ] && [ ! -L "$OAUTH_DIR/public.key" ]; then
            # Fix the typo in the path
            chmod 640 "$OAUTH_DIR/public.key"
            chown root:www-data "$OAUTH_DIR/public.key"
            
            # Copy to persistent storage with correct permissions
            cp -f "$OAUTH_DIR/public.key" "$PERSISTENT_OAUTH_DIR/public.key"
            chmod 640 "$PERSISTENT_OAUTH_DIR/public.key"
            chown root:www-data "$PERSISTENT_OAUTH_DIR/public.key"
            
            # We keep the original file as is, no need to remove and recreate
        fi
    fi
    
    if [ $KEY_GEN_SUCCESS -eq 0 ]; then
        echo "WARNING: Failed to generate OAuth2 keys. Authentication might not work properly."
    fi
else
    echo "OAuth2 keys already exist in persistent storage. Using existing keys."
fi

# Setting general permissions for all files and directories
echo "Setting general permissions..."
find /var/suitecrm/www/html/public -type d -not -perm 2775 -exec chmod 2775 {} \;
find /var/suitecrm/www/html/public -type f -not -perm 0664 -exec chmod 0664 {} \;
find /var/suitecrm/www/html/public ! -user root -exec chown root:www-data {} \;
chmod +x bin/console

# Apply specific permissions to OAuth key files as the final step
echo "Setting specific permissions (640) for OAuth2 key files..."
# Since we're using hard links, setting permissions on either file affects both
if [ -f "$PERSISTENT_OAUTH_DIR/private.key" ]; then
    chmod 640 "$PERSISTENT_OAUTH_DIR/private.key"
    chown root:www-data "$PERSISTENT_OAUTH_DIR/private.key"
fi

if [ -f "$PERSISTENT_OAUTH_DIR/public.key" ]; then
    chmod 640 "$PERSISTENT_OAUTH_DIR/public.key"
    chown root:www-data "$PERSISTENT_OAUTH_DIR/public.key"
fi

# For application files (no more symlinks)
if [ -f "$OAUTH_DIR/private.key" ]; then
    chmod 640 "$OAUTH_DIR/private.key"
    chown root:www-data "$OAUTH_DIR/private.key"
    echo "Set permissions on $OAUTH_DIR/private.key: $(stat -c '%a %U:%G' "$OAUTH_DIR/private.key")"
fi

if [ -f "$OAUTH_DIR/public.key" ]; then
    chmod 640 "$OAUTH_DIR/public.key"
    chown root:www-data "$OAUTH_DIR/public.key"
    echo "Set permissions on $OAUTH_DIR/public.key: $(stat -c '%a %U:%G' "$OAUTH_DIR/public.key")"
fi

exec "$@"

