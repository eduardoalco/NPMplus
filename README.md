# NPMplus

NPMplus es un gestor de proxies inversos con interfaz web, HTTPS automático y una compilación reforzada de nginx. Este fork publica sus imágenes en [`docker.io/eduardoalco/npmplus`](https://hub.docker.com/r/eduardoalco/npmplus); el proyecto upstream y su soporte comunitario siguen siendo [`ZoeyVid/NPMplus`](https://github.com/ZoeyVid/NPMplus).

El despliegue incluido usa el proyecto Compose `npmplus` y levanta siempre cinco contenedores separados: `npmplus`, `crowdsec`, `npmplus-anubis`, `npmplus-geoipupdate` y `npmplus-caddy`. No hay perfiles.

- [Inicio rápido](#inicio-rápido)
- [Requisitos](#requisitos)
- [Arquitectura](#arquitectura)
- [Puertos y red](#puertos-y-red)
- [Servicios integrados](#servicios-integrados)
- [Persistencia y copias de seguridad](#persistencia-y-copias-de-seguridad)
- [Actualización y rollback](#actualización-y-rollback)
- [Diagnóstico](#diagnóstico)
- [Configuración avanzada](#configuración-avanzada)
- [Seguridad](#seguridad)
- [Migración](#migración-desde-nginx-proxy-manager)
- [Soporte y upstream](#soporte-y-upstream)

> Este software se distribuye bajo GNU AGPL v3 o posterior y deriva de [nginx-proxy-manager](https://github.com/NginxProxyManager/nginx-proxy-manager), publicado bajo licencia MIT. Al usar ACME se aceptan las condiciones de Let's Encrypt o de la CA configurada.

## Inicio rápido

Desde la raíz de una copia de este repositorio:

1. Cree la configuración local:

   ```bash
   cp .env.example .env
   ```

2. Edite `.env`. Como mínimo, revise `TZ` y las rutas persistentes. Mantenga `LOGROTATE=true`, `AUTH_REQUEST_ANUBIS_UPSTREAM=http://127.0.0.1:8923` y `DISABLE_HTTP=true`: CrowdSec, Anubis y Caddy forman parte del stack predeterminado.

3. Cree los secretos de MaxMind. Sustituya los valores de ejemplo por las credenciales de una cuenta [GeoLite2](https://www.maxmind.com/en/geolite2/signup):

   ```bash
   install -d -m 700 secrets
   printf '%s' 'YOUR_ACCOUNT_ID' > secrets/maxmind_account_id
   printf '%s' 'YOUR_LICENSE_KEY' > secrets/maxmind_license_key
   chmod 600 secrets/maxmind_account_id secrets/maxmind_license_key
   ```

4. Levante todo el stack con un único comando:

   ```bash
   docker compose up -d
   ```

5. Abra la administración en `https://<host>:81`. Si no definió `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, consulte los logs de `npmplus` para obtener las credenciales iniciales generadas.

## Requisitos

- Host Linux con [Docker Engine](https://docs.docker.com/engine/install/) y el plugin [Docker Compose](https://docs.docker.com/compose/install/linux/).
- Arquitectura `amd64` con nivel x86-64-v2 o superior, o `arm64`.
- Puertos libres y permitidos por el firewall: `80/tcp`, `443/tcp`, `443/udp` y `81/tcp`.
- Credenciales MaxMind GeoLite2 guardadas en los dos archivos indicados arriba.
- DNS público apuntando al host. Con Caddy ocupando el puerto 80, use DNS challenge para certificados cuando HTTP-01 no sea aplicable.

Docker es la plataforma probada. Podman puede funcionar, pero no es el objetivo principal de este despliegue. SQLite es la base de datos soportada y recomendada; MySQL/MariaDB/PostgreSQL no forman parte del stack ni reciben soporte en este fork.

## Arquitectura

Compose declara `name: npmplus` y coordina cinco servicios en un único stack:

| Contenedor | Responsabilidad | Aislamiento y datos compartidos |
| --- | --- | --- |
| `npmplus` | UI React/Vite, API Node.js, nginx, Certbot, SQLite y tareas internas supervisadas por `dinit` | Usa la red del host y persiste `/data` |
| `crowdsec` | Security Engine, LAPI y AppSec | Red bridge auxiliar; sólo lee los logs de nginx |
| `npmplus-anubis` | Desafíos anti-bot mediante `auth_request` | Red bridge auxiliar; endpoint publicado sólo en loopback |
| `npmplus-geoipupdate` | Actualización periódica de GeoLite2 | Red bridge auxiliar; comparte únicamente el directorio GeoIP y recibe secretos como archivos |
| `npmplus-caddy` | Redirección HTTP global y permanente hacia HTTPS | Red bridge auxiliar; es el único propietario del puerto público 80 |

Todos pertenecen al mismo stack para simplificar el ciclo de vida, pero **no están fusionados en un contenedor monolítico**. La separación limita privilegios, montajes y superficie de ataque por función; los servicios auxiliares usan `cap_drop: ALL` cuando es posible y `no-new-privileges`.

## Puertos y red

`npmplus` usa `network_mode: host`; no se le deben añadir `ports` ni una red bridge. Como `DISABLE_HTTP=true`, no escucha en 80. Sus listeners son:

| Puerto | Propietario | Uso |
| --- | --- | --- |
| `80/tcp` | `npmplus-caddy` | Redirección HTTP a HTTPS |
| `443/tcp` | `npmplus` | HTTPS para proxy hosts y streams |
| `443/udp` | `npmplus` | HTTP/3 sobre QUIC |
| `81/tcp` | `npmplus` | UI y API administrativas mediante HTTPS |
| `127.0.0.1:8080/tcp` | `crowdsec` | LAPI |
| `127.0.0.1:7422/tcp` | `crowdsec` | AppSec |
| `127.0.0.1:8923/tcp` | `npmplus-anubis` | Subrequests de autenticación |

Los tres puertos auxiliares se publican sólo en loopback. NPMplus puede alcanzarlos porque comparte la red del host, pero no quedan expuestos directamente a la red externa.

## Servicios integrados

### CrowdSec y bouncer

CrowdSec carga la colección `ZoeyVid/npmplus`, lee en modo sólo lectura los logs definidos por `deployment/crowdsec/acquis.yaml` y expone LAPI/AppSec únicamente en `127.0.0.1`. `LOGROTATE=true` es necesario para producir los logs consumidos por CrowdSec.

Tras el primer arranque, cree la credencial del bouncer:

```bash
docker compose exec crowdsec cscli bouncers add npmplus
```

Copie la clave mostrada a `/opt/npmplus/crowdsec/crowdsec.conf` —o bajo el valor configurado en `NPMPLUS_DATA_DIR`—, establezca `ENABLED` en `true`, asigne la clave a `API_KEY` y vuelva a aplicar el stack. Sin este paso CrowdSec detecta decisiones, pero NPMplus no las ejecuta.

CrowdSec puede compartir señales con su servicio central. Revise la [configuración de sharing](https://docs.crowdsec.net/docs/next/configuration/crowdsec_configuration/#sharing), los [metadatos enviados](https://docs.crowdsec.net/docs/central_api/intro/#signal-meta-data) y, si procede, el [firewall bouncer](https://docs.crowdsec.net/u/bouncers/firewall). AppSec fuerza buffering de las solicitudes protegidas.

### Anubis

Anubis se ejecuta en modo subrequest con la política versionada `deployment/anubis/botPolicies.yaml`. La política devuelve `401` para desafío y `403` para denegación, valores requeridos por nginx `auth_request`. Para usarlo, seleccione **Anubis** en cada proxy host o ubicación; no necesita una location nginx personalizada.

### GeoIP Update

`npmplus-geoipupdate` actualiza `GeoLite2-Country`, `GeoLite2-City` y `GeoLite2-ASN` cada 24 horas de forma predeterminada. Las bases se guardan bajo `${NPMPLUS_DATA_DIR}/goaccess/geoip`.

- Active `GOA=true` para que GoAccess las consuma.
- Active `NGINX_LOAD_GEOIP2_MODULE=true` para reglas GeoIP2 personalizadas.
- Los secretos de Compose son archivos montados, no un almacén cifrado: mantenga permisos `600`, exclúyalos del control de versiones y proteja sus backups.

### Caddy y desafíos DNS

`npmplus-caddy` publica `80/tcp` y sólo redirige a HTTPS. NPMplus conserva `443/tcp`, `443/udp` y `81/tcp`. Como NPMplus tiene HTTP desactivado, la validación ACME HTTP-01 puede no ser viable; en ese caso seleccione **DNS Challenge** al crear el certificado en la UI.

Para Azure DNS, la definición integrada usa `certbot-dns-azure==2.6.1` con dependencias fijadas y `--no-deps`, incluida exactamente `azure-mgmt-dns==8.2.0` junto con `azure-core==1.41.0` y `azure-identity==1.25.3`. La identidad debe tener el rol **DNS Zone Contributor** y las credenciales deben incluir al menos un mapeo `dns_azure_zoneN` entre zona y resource group, según la plantilla mostrada por la UI. No actualice sólo una de esas dependencias sin validar el conjunto.

## Persistencia y copias de seguridad

| Contenido | Ruta predeterminada del host |
| --- | --- |
| Estado NPMplus, SQLite, certificados, configuración generada y logs | `/opt/npmplus` |
| Configuración y credenciales CrowdSec | `/opt/crowdsec/conf` |
| Base de datos CrowdSec | `/opt/crowdsec/data` |
| Credenciales MaxMind | `./secrets` |

Las rutas pueden cambiarse en `.env`. Para obtener una copia coherente de SQLite, detenga `npmplus`, archive su directorio y vuelva a aplicar el stack:

```bash
DATA_DIR=/opt/npmplus
docker compose stop npmplus
tar -C "$(dirname "$DATA_DIR")" -czf "npmplus-backup-$(date +%F).tar.gz" "$(basename "$DATA_DIR")"
docker compose up -d
```

Incluya también los dos directorios de CrowdSec y, con protección equivalente, los secretos locales. Pruebe periódicamente la restauración en otro host. La posesión de una copia no sustituye la verificación de que SQLite, certificados y configuración arrancan correctamente.

## Actualización y rollback

Las imágenes auxiliares externas están fijadas por versión y digest. Las imágenes propias `docker.io/eduardoalco/npmplus:latest` y `docker.io/eduardoalco/npmplus:caddy` son canales móviles.

Antes de actualizar:

1. Haga una copia consistente de los datos.
2. Registre los digests actualmente desplegados y conserve el `compose.yaml` usado.
3. Revise las notas de la versión upstream y de este fork.

Actualice las imágenes y reaplique el mismo stack, sin perfiles:

```bash
docker compose pull
docker compose up -d
```

Para rollback, restaure el backup compatible, recupere el `compose.yaml` previo o fije las imágenes propias a los digests registrados y ejecute de nuevo `docker compose up -d`. Restaurar sólo la imagen no revierte migraciones de datos.

## Diagnóstico

```bash
docker compose config --quiet
docker compose ps
docker compose logs npmplus
docker compose logs crowdsec anubis geoipupdate npmplus-caddy
```

- `config --quiet` valida interpolación, secretos, configs y sintaxis.
- `ps` permite comprobar estado y healthchecks de los cinco contenedores.
- Use `logs -f <servicio>` para seguimiento en tiempo real.
- Si la UI no responde, confirme primero que `81/tcp` está permitido y que no existe otro proceso ocupándolo.
- Si HTTP no redirige, revise `npmplus-caddy`; NPMplus no debe escuchar en 80 en este stack.
- Si HTTP/3 falla, compruebe `443/udp`, firewall y NAT además de `443/tcp`.

El error nginx `sendmsg() failed (109: Protocol not available)` está asociado a QUIC GSO en hosts o rutas de red que no lo soportan correctamente. Esta imagen lo mitiga con `quic_gso off`; HTTP/3 y QUIC continúan activos. No establezca `DISABLE_H3_QUIC=true` para esta incidencia, porque esa opción sí desactiva HTTP/3 por completo.

## Configuración avanzada

Mantenga las personalizaciones bajo `${NPMPLUS_DATA_DIR}/custom_nginx` y evite copiar recetas genéricas de nginx-proxy-manager: NPMplus genera una configuración diferente y muchas directivas habituales son redundantes o incompatibles.

### Proveedores `auth_request`

Además de Anubis, NPMplus admite Tinyauth, OAuth2 Proxy, VoidAuth, Authelia y Authentik mediante sus variables `AUTH_REQUEST_*_UPSTREAM`. Defina la URL base en `.env` y seleccione el proveedor en la UI; el override de la ubicación principal prevalece sobre el de ubicaciones personalizadas.

### Balanceo de carga

Defina bloques `upstream` en `/opt/npmplus/custom_nginx/http_top.conf` o `stream_top.conf`, según corresponda. Consulte las directivas oficiales de nginx para [HTTP upstream](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) y [stream upstream](https://nginx.org/en/docs/stream/ngx_stream_upstream_module.html). El nombre debe comenzar por `cu_`; úselo como hostname en la UI y deje vacío el puerto, ya que los destinos se declaran dentro del bloque.

### Encrypted Client Hello

NPMplus puede rotar claves ECH mediante `/opt/npmplus/tls/ech/cron.sh`. El comando interno es `ech.sh <public-name> <identifier> [max-name-length]`; el script debe publicar el valor generado como registro DNS HTTPS. Adapte el ejemplo versionado [`ech-cron-cloudflare-example.sh`](ech-cron-cloudflare-example.sh). Un archivo vacío desactiva ECH; `ECH_ROTATION_INTERVAL` controla el intervalo, una hora de forma predeterminada.

### Listas de acceso y privacidad

Las reglas de una Access List se evalúan de arriba abajo. `Satisfy Any` y `Pass Auth to Upstream` sólo se aplican si están en la primera lista asignada al host o ubicación.

Los logs pueden contener IP y otros datos personales. Documente su tratamiento si activa logs persistentes, CrowdSec, GoAccess, GeoIP, Anubis, PHP-FPM o integraciones externas. Si habilita HSTS, evalúe también la [lista preload](https://hstspreload.org).

## Seguridad

- No publique `81/tcp` en Internet sin firewall, VPN o una política de acceso adecuada.
- Permita públicamente sólo `80/tcp`, `443/tcp` y `443/udp`; los endpoints de CrowdSec y Anubis deben permanecer en loopback.
- No añada privilegios ni montajes al Compose salvo que una función concreta lo requiera.
- Mantenga `.env`, `secrets/` y backups fuera del repositorio y con permisos restrictivos.
- Verifique TLS extremo a extremo si coloca otro CDN o proxy delante; un proxy externo puede reemplazar cabeceras, TLS y HTTP/3 configurados por NPMplus.
- NPMplus no confía en rangos de Cloudflare salvo que se active explícitamente `TRUST_CLOUDFLARE`. Si usa su proxy, configure **Full (strict)** y proteja el acceso directo a la IP de origen.

## Migración desde nginx-proxy-manager

La migración de vuelta al proyecto original no está soportada. Conserve una copia completa que permita volver al despliegue anterior.

1. Detenga el nginx-proxy-manager original después de copiar sus directorios de datos y Let's Encrypt.
2. Ajuste `NPMPLUS_DATA_DIR` y monte temporalmente el antiguo directorio `/etc/letsencrypt` en `npmplus`, como indica el comentario de `compose.yaml`.
3. Prepare `.env` y los secretos MaxMind según el [inicio rápido](#inicio-rápido).
4. Ejecute `docker compose up -d` y espere a que finalice la migración.
5. Retire el montaje temporal de `/etc/letsencrypt` y reaplique el stack.
6. Revise cada host, certificado y lista de acceso. La administración usa HTTPS; si NPMplus se proxifica a sí mismo, cambie el esquema upstream de `http` a `https`.
7. Abra y guarde los perfiles de usuario si los avatares antiguos no cargan debido a la CSP reforzada.

No intente migrar una base MySQL/MariaDB/PostgreSQL a SQLite de forma automática; este flujo presupone la instalación upstream estándar compatible.

## Soporte y upstream

Este repositorio es un fork y publica sus imágenes propias exclusivamente como `docker.io/eduardoalco/npmplus`. El upstream es [ZoeyVid/NPMplus](https://github.com/ZoeyVid/NPMplus); el nombre `ZoeyVid/npmplus` usado por CrowdSec identifica su colección y no debe cambiarse por el nombre de la imagen Docker.

Para ayuda funcional de NPMplus:

1. [Discussions de ZoeyVid/NPMplus](https://github.com/ZoeyVid/NPMplus/discussions)
2. [Discord](https://discord.gg/y8DhYhv427), canal `#support-npmplus`
3. [Issues de ZoeyVid/NPMplus](https://github.com/ZoeyVid/NPMplus/issues), sólo para errores reproducibles y solicitudes de funciones

Los problemas específicos de imagen, Compose o empaquetado de este fork deben reportarse primero en este fork, aportando `docker compose config`, `docker compose ps` y los logs relevantes sin secretos.
