# Stage 1: Composer
FROM composer/composer:2.8-bin AS composer
# Stage 2: Builder
FROM php:8.2.27-fpm-alpine3.20 AS builder

# Copy Composer from the earlier images
COPY --from=composer /composer /usr/bin/composer

RUN apk update && apk add --no-cache --virtual .build-deps \
        imap-dev \
        brotli \
        git \
        curl-dev \
        krb5-dev \
        openssl-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        zlib-dev \
        libwebp-dev \
        libxml2-dev \
        libxpm-dev \
        icu-dev \
        freetype-dev \
        oniguruma-dev \
        linux-headers \
    && apk add --no-cache \
        ca-certificates \
        curl \
        imagemagick \
        php82-imap \
        gettext \
        graphicsmagick \
        unzip \
        fcgi \
        mysql-client \
        php82-intl \
        php82-xml \
        php82-pdo_mysql \
        dialog \
        openssh-server \
        cronie \
        libzip-dev \
    # Configure, install, and enable PHP extensions 
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
    && docker-php-ext-configure opcache --enable-opcache \
    && docker-php-ext-install -j$(nproc) intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif gd imap opcache \
    && docker-php-ext-enable intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif gd imap opcache \
    && apk del .build-deps

# Copy application files into the container
COPY --chown=root:www-data vtigercrm/vtigercrm/ /var/vtiger/www/html

# Apply necessary permissions
RUN chown -R root:www-data /var/vtiger/www/html \
    && chmod -R 755 /var/vtiger/www/html 

# Set permissions for the entrypoint script
COPY --chown=root:www-data ./entrypoint.sh /var/local/entrypoint.sh
RUN chmod +x /var/local/entrypoint.sh

# Ensure Composer can run as the superuser
WORKDIR /var/vtiger/www/html
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install Composer dependencies
RUN if [ -f composer.json ]; then composer install --no-interaction --no-scripts --optimize-autoloader; fi

RUN find -type d -exec chmod 755 {} \; \
    && chmod 775 backup/ \
    && chmod -R 775 cache/ \
    && chmod -R 775 cron/ \
    && chmod 775 install/ \
    && chmod -R 775 languages/ \
    && chmod -R 775 layouts/v7/modules/ \
    && chmod 775 logs/ \
    && chmod -R 775 modules/ \ 
    && chmod 775 storage/ \
    && chmod -R 775 test/ \
    && chmod -R 775 user_privileges/ \
    && find -type f -exec chmod 644 {} \; \
    && chmod 664 config.inc.php \
    #&& chmod 664 install.php \
    && chmod 664 parent_tabdata.php \
    && chmod 664 tabdata.php \
    && chmod 664 user_privileges/audit_trail.php \
    && chmod 664 user_privileges/default_module_view.php \
    && chmod 664 user_privileges/enable_backup.php

# for Azure ssh
ENV  SSH_PASSWD="root:Docker!"
RUN echo "$SSH_PASSWD" | chpasswd 

# Copy configuration files to their correct locations
COPY --chown=www-data:www-data  ./php.ini /usr/local/etc/php/php.ini
COPY --chown=www-data:www-data  ./www.conf /usr/local/etc/php-fpm.d/www.conf
COPY --chown=www-data:www-data  ./php-fpm.conf /usr/local/etc/php-fpm.conf

# Apply necessary permissions
RUN chmod -R 644 /usr/local/etc/php/php.ini \
    && chmod -R 755 /usr/local/etc/php-fpm.d \
    && chmod -R 644 /usr/local/etc/php-fpm.conf

# Apply necessary permissions
RUN chmod +x /var/local/entrypoint.sh

EXPOSE 9000
# Define the entrypoint
ENTRYPOINT ["/var/local/entrypoint.sh"]

CMD ["php-fpm"]
