# API del dashboard de comercios — imagen de despliegue.
#
# ¿Por qué un Dockerfile y no el autodetector de Railway?
#
# Railway detecta PHP por la presencia de un `composer.json`, y esta API no
# tiene ninguno a propósito: no usa dependencias, trae su propio autoloader
# PSR-4 de cinco líneas (ver public/index.php) y se despliega copiando la
# carpeta. Agregar un composer.json vacío solo para que el builder la reconozca
# sería mentirle al detector sobre lo que el proyecto es. Con un Dockerfile la
# decisión de no usar Composer se sostiene, y además quedan explícitas las dos
# cosas que este servicio necesita y que ningún autodetector adivina: que el
# document root es `public/` y no la raíz, y que hace falta la extensión
# pdo_pgsql.
#
# Local:
#   docker build -t seis-mas-dashboard-api dashboard/api
#   docker run --rm -p 8080:8080 --env-file dashboard/api/.env seis-mas-dashboard-api
#
# Railway (desde la raíz del repo — este repo es un monorepo y `railway up`
# sube la raíz, no el directorio desde el que se invoca):
#   railway up ./dashboard/api --path-as-root --service dashboard-api

FROM php:8.3-apache

# pdo_pgsql es la única extensión que la API necesita y no viene en la imagen
# base. libpq-dev es para compilarla; se queda porque libpq es también la
# biblioteca en tiempo de ejecución.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

# El front controller vive detrás de un rewrite (public/.htaccess), así que sin
# mod_rewrite todas las rutas menos /index.php darían 404.
RUN a2enmod rewrite

# Configuración de producción recomendada por la propia imagen: sin
# display_errors, con opcache en modo producción. El detalle de los errores va
# al log del contenedor (error_log), que es donde Railway lo muestra.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# Railway inyecta PORT y espera que el proceso escuche ahí. El valor por
# defecto es para poder correr la imagen en local sin pasar nada.
ENV PORT=8080

# Apache sustituye ${PORT} desde el entorno del proceso al arrancar, así que la
# misma imagen sirve en cualquier puerto sin reconstruirla.
RUN printf 'Listen ${PORT}\n' > /etc/apache2/ports.conf

# El document root es public/, no la raíz del proyecto. Es la diferencia entre
# servir la API y servir el código fuente: con la raíz como document root,
# `GET /.env` y `GET /src/Core/Db.php` serían archivos estáticos descargables.
# AllowOverride All es lo que hace que public/.htaccess se aplique — ahí viven
# el rewrite al front controller y el reenvío de la cabecera Authorization, sin
# la cual el JWT no llega a PHP y toda la API responde 401.
RUN printf '%s\n' \
    '<VirtualHost *:${PORT}>' \
    '    DocumentRoot /var/www/html/public' \
    '    <Directory /var/www/html/public>' \
    '        Options -Indexes +FollowSymLinks' \
    '        AllowOverride All' \
    '        Require all granted' \
    '    </Directory>' \
    '    ErrorLog /dev/stderr' \
    '    CustomLog /dev/stdout combined' \
    '</VirtualHost>' \
    > /etc/apache2/sites-available/000-default.conf

# ServerName fijo para que Apache no avise en cada arranque que no pudo
# determinar el nombre del servidor por FQDN.
RUN printf 'ServerName localhost\n' > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername

WORKDIR /var/www/html

# Solo lo que la API necesita para correr. El .env queda fuera por
# .dockerignore: en Railway las variables vienen del entorno del servicio, y
# una imagen con credenciales dentro es una credencial que viaja a un registro.
COPY config/ ./config/
COPY src/ ./src/
COPY public/ ./public/

# El proceso de Apache no necesita escribir nada: la API no guarda archivos ni
# cachea en disco. Los archivos quedan del root y legibles, no escribibles, por
# el usuario que atiende las peticiones.
RUN chown -R root:root /var/www/html && chmod -R a-w,a+rX /var/www/html

EXPOSE 8080

CMD ["apache2-foreground"]
