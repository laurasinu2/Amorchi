# Memrly: cuentas por correo (rama feat/memrly-auth-20261123)

Esta rama parte de `feat/memrly-backend-rest-20261122`. No incluye Google OAuth y NO se ha desplegado en Contabo.

## Incluye
- Modal responsivo en pantallas grandes y página completa en móviles.
- Registro con contraseña de 12+ caracteres y repetición. Sin SMTP, guarda `email_verified_at = NULL` y permite iniciar sesión mostrando **Correo pendiente de verificar**.
- Cuando exista SMTP, quedará disponible la verificación mediante código de seis dígitos.
- Código de recuperación de 10 minutos, cinco intentos por código y reenvío limitado a uno por minuto.
- Inicio de sesión con `Recordarme`: cookie HttpOnly Secure SameSite=Strict de 30 días o cookie de sesión de navegador con caducidad servidor de 12 horas.
- Access JWT de 12 horas, renovable mediante cookie y asociado a una sesión revocable de PostgreSQL.
- Cierre de sesión y restablecimiento de contraseña revocan sesiones en servidor.
- Acceso por álbum autorizado mediante `album_members` en endpoints de fotos.
- Ajustes > Cuenta y confirmación de cerrar sesión.

## Antes de habilitar cuentas en producción

1. Realiza una copia de seguridad consistente de PostgreSQL y verifica un procedimiento de restauración.
2. En la base **existente** de Memrly, aplica `server/db/003_auth.sql` una sola vez antes de actualizar la API. Los scripts de `docker-entrypoint-initdb.d` SOLO se ejecutan en volúmenes nuevos. No ejecutes `docker compose down -v` para forzar migraciones.
3. El correo SMTP es opcional por ahora. Sin él, la cuenta permanece pendiente de verificar y puede utilizarse con su contraseña. **No hay recuperación de contraseña sin correo**. Activa `MEMRLY_ALLOW_SIGNUP=true` únicamente después de comprobar HTTPS, protección frente a abusos y copias de seguridad.
4. Configura `MEMRLY_PUBLIC_ORIGIN=https://memrly.duckdns.org` para comprobación de origen en refresh/logout.
5. Valida tests de CI y un registro de prueba, verificación, recuperación y cierre de sesión.
6. Configura limitación de solicitudes por IP en el proxy para login, recuperación y registro, así como supervisión SMTP, antes de abrir registros al público.

**Compatibilidad:** `/api/v1/auth/register` y `/api/v1/auth/login` anteriores retornan 410 deliberadamente, ya que permitían esquivar la verificación. Los tokens antiguos sin identificador de sesión dejan de dar acceso. Los usuarios existentes pueden entrar con contraseña, aunque su correo permanezca pendiente de verificación. La nueva interfaz no sincroniza todavía fotografías ni cambia IndexedDB.

## API de cuentas

| Método | Ruta | Función |
|---|---|---|
| POST | /api/v1/account/register | Crear cuenta pendiente de verificación; enviar código solo si SMTP está configurado |
| POST | /api/v1/account/verify | Verificar código |
| POST | /api/v1/account/resend | Reenviar código |
| POST | /api/v1/account/login | Obtener sesión y token |
| POST | /api/v1/account/refresh | Renovar token mediante cookie |
| POST | /api/v1/account/logout | Revocar sesión y borrar cookie |
| POST | /api/v1/account/forgot | Solicitar código de recuperación |
| POST | /api/v1/account/reset | Cambiar contraseña y revocar sesiones |
| GET | /api/v1/auth/me | Datos de cuenta mediante Bearer |

No copies claves SMTP, contraseñas ni cookies al repositorio.
