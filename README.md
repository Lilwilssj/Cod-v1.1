
```markdown
Callejon Oriente Digital v1.1

Por el momento el sistema de entregas se encuentra en desarrollo...

# Sistema de Gestión de Entregas y Miembros
Este proyecto es una aplicación web diseñada para gestionar miembros y registrar la entrega de beneficios como 'clap', 'gas', y 'combo'. La aplicación incluye funcionalidades de autenticación, registro de usuarios, recuperación de miembros, y reinicio de entregas.

## Tabla de Contenidos

- [Características](#características)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Metodología de Desarrollo](#metodología-de-desarrollo)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)

## Características

- **Autenticación**: Inicio de sesión y registro de usuarios con roles específicos.
- **Gestión de Miembros**: Registro, actualización, y eliminación de miembros. Recuperación de miembros eliminados desde una tabla de respaldo.
- **Registro de Entregas**: Registro de entregas de beneficios ('clap', 'gas', 'combo') y controles adicionales para el gas.
- **Reinicio de Entregas**: Funcionalidad para reiniciar las entregas y mantener un respaldo histórico.

## Tecnologías Utilizadas

- **Backend**: Express
- **Base de Datos**: MySQL (gestionada con Laragon)
- **Autenticación**: bcryptjs para el hash de contraseñas
- **Sesiones**: express-session
- **Tiempos**: moment
- **IPs**: request-ip
- **Middleware**: body-parser

## Instalación

1. Clona el repositorio:
    ```bash
    git clone https://github.com/tu-usuario/tu-repositorio.git
    cd tu-repositorio
    ```

2. Instala las dependencias:
    ```bash
    npm install
    ```

3. Configura la base de datos MySQL utilizando Laragon:
    - Crea una base de datos llamada `cod`
    - Ejecuta los scripts SQL proporcionados en el directorio `database` para crear las tablas necesarias

4. Configura las variables de entorno en un archivo `.env` (opcional, si decides utilizar variables de entorno):
    ```env
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=
    DB_NAME=cod
    SESSION_SECRET=secret-key
    ```

## Configuración

Asegúrate de configurar correctamente los siguientes archivos:

- **Base de Datos**: Configura la conexión a la base de datos en el archivo principal del servidor.
- **Sesiones**: Configura las sesiones en el servidor con `express-session`.

## Uso

1. Inicia el servidor:
    ```bash
    npm start
    ```

2. Accede a la aplicación en tu navegador:
    ```text
    http://localhost:3000
    ```

## Metodología de Desarrollo

La metodología utilizada para el desarrollo de esta aplicación es **Kanban**. Kanban es una metodología ágil que permite gestionar y mejorar el trabajo a través de la visualización del flujo de trabajo y la limitación del trabajo en progreso.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue los siguientes pasos para contribuir:

1. Haz un fork del proyecto.
2. Crea una nueva rama (`git checkout -b feature/nueva-caracteristica`).
3. Realiza tus cambios y haz commit (`git commit -am 'Agregar nueva característica'`).
4. Empuja los cambios a tu rama (`git push origin feature/nueva-caracteristica`).
5. Abre un Pull Request.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
