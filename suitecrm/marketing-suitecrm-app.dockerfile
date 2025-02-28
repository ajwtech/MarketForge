# Stage 1: Composer
FROM composer/composer:2.8-bin AS composer
# Stage 2: Builder
FROM php:8.3.16-fpm-alpine3.20 AS builder

# Copy Composer and node from the earlier images
COPY --from=composer /composer /usr/bin/composer

RUN apk update && apk add --no-cache --virtual .build-deps \
        imap-dev \
        build-base \
        brotli \
        findutils \
        git \
        imagemagick-dev \
        curl-dev \
        krb5-dev \
        openssl-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libxml2-dev \
        libxpm-dev \
        libldap \
        icu-dev \
        freetype-dev \
        oniguruma-dev \
        linux-headers \
        openldap-dev \
    && apk add --no-cache \
        curl \
        imagemagick \
        gettext \
        graphicsmagick \
        unzip \
        fcgi \
        mysql-client \
        php-cli \
        php-common \
        php83-intl \
        php83-imap \
        php83-ldap \
        libzip-dev \
        supervisor

# Configure, install, and enable PHP extensions 
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
    && docker-php-ext-configure ldap \
    && docker-php-ext-install -j$(nproc)  \
    gd \
    intl \
    mysqli \
    pdo_mysql \
    soap \
    zip \
    imap \
    ldap \
    && docker-php-ext-enable \
    intl \
    mysqli \
    pdo_mysql \
    soap \
    zip \
    imap \
    ldap 

    #colocate the temp directory with the SuiteCRM directory
    RUN   mkdir -p /var/suitecrm/www/html/tmp && \
        chown root:www-data /var/suitecrm/www/html/tmp && \
        chmod 2775 /var/suitecrm/www/html/tmp 

# Create suitecrm directory
RUN addgroup -g 82 -S www-data || true && adduser -u 82 -S www-data -G www-data || true && \
mkdir -p /var/suitecrm/www/html/
# env with templates
COPY --chown=root:www-data .template.env /var/template/.template.env

# Copy SuiteCRM application files (replacing SuiteCRM)
COPY --chown=root:www-data SuiteCRM-Core/ /var/suitecrm/www/html


WORKDIR /var/suitecrm/www/html

RUN find . -type d -not -perm 2775 -exec chmod 2775 {} \; && \
    find . -type f -not -perm 0664 -exec chmod 0664 {} \; && \
    find . ! -user root -exec chown root:www-data {} \; && \
    chmod +x bin/console

# for Azure ssh
ENV  SSH_PASSWD="root:Docker!"
RUN echo "$SSH_PASSWD" | chpasswd 

# Copy configuration files to their correct locations
COPY --chown=root:www-data  ./php.ini /usr/local/etc/php/php.ini
COPY --chown=root:www-data  ./www.conf /usr/local/etc/php-fpm.d/www.conf
COPY --chown=root:www-data  ./php-fpm.conf /usr/local/etc/php-fpm.conf

# Apply necessary permissions
RUN chmod -R 644 /usr/local/etc/php/php.ini \
    && chmod -R 755 /usr/local/etc/php-fpm.d \
    && chmod -R 644 /usr/local/etc/php-fpm.conf

# Set permissions for the entrypoint script
COPY --chown=root:www-data ./entrypoint.sh /var/local/entrypoint.sh
RUN chmod +x /var/local/entrypoint.sh

RUN COMPOSER_ALLOW_SUPERUSER=1 composer install

#this may seem excessive but it is necessary to ensure that the permissions are correct
RUN find . -type d -not -perm 2775 -exec chmod 2775 {} \; && \
    find . -type f -not -perm 0664 -exec chmod 0664 {} \; && \
    find . ! -user root -exec chown root:www-data {} \; && \
    chmod +x bin/console

# Copy Supervisor config
COPY --chown=root:www-data ./supervisor/suitecrm.conf /etc/supervisor.d/suitecrm.conf

# Copy run_installer script
COPY --chown=root:www-data ./run_installer.sh /usr/local/bin/run_installer.sh
RUN chmod +x /usr/local/bin/run_installer.sh

RUN mkdir -p /var/log/supervisor
#RUN apk del .build-deps
RUN rm -rf /var/cache/apk/*
USER root:www-data
EXPOSE 9000
# Define the entrypoint
ENTRYPOINT ["/var/local/entrypoint.sh"]

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor.d/suitecrm.conf"]
