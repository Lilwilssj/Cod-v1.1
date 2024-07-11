import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import mysql from 'mysql2/promise';
import bodyParser from "body-parser";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import moment from 'moment';
import requestIp from 'request-ip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configuración de la aplicación Express
app.set('view engine', 'html');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIp.mw()); // Middleware para obtener la IP del cliente
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Configuración de la conexión a la base de datos con mysql2
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cod',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware para verificar si el usuario está autenticado
function checkAuthenticated(req, res, next) {
    if (req.session.user) {
        return res.redirect('/index');
    }
    next();
}

function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Función para reintegrar miembros desde la tabla de respaldo a la principal
async function reintegrarMiembrosDesdeRespaldoAutomaticamente() {
    try {
        // Obtener miembros en estado "muerto" desde la tabla de respaldo
        const [rows] = await pool.query('SELECT * FROM miembros_respaldo WHERE estado_anterior = "muerto"');

        // Iterar sobre los miembros encontrados y reintegrarlos a la tabla principal
        for (const miembro of rows) {
            // Verificar si el miembro ya existe en la tabla principal
            const [existingRows] = await pool.query('SELECT * FROM miembros WHERE cedula_de_identidad = ?', [miembro.cedula_de_identidad]);

            if (existingRows.length === 0) {
                // Insertar el miembro en la tabla principal
                await pool.query('INSERT INTO miembros (nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        miembro.nombres,
                        miembro.apellidos,
                        miembro.cedula_de_identidad,
                        miembro.telefono,
                        miembro.fecha_nacimiento,
                        miembro.carnet_de_patria,
                        miembro.escalera,
                        'vivo' // Establecer el estado como "vivo"
                    ]);
                // Eliminar el miembro de la tabla de respaldo
                await pool.query('DELETE FROM miembros_respaldo WHERE id = ?', [miembro.id]);

                console.log(`Miembro reintegrado desde respaldo: ${miembro.nombres} ${miembro.apellidos}`);
            }
        }
    } catch (error) {
        console.error('Error al reintegrar miembros desde respaldo:', error);
    }
}
// Intervalo de 24 horas (86400000 milisegundos = 24 horas)
const intervaloReintegracion = 86400000;
setInterval(reintegrarMiembrosDesdeRespaldoAutomaticamente, intervaloReintegracion);

// Ruta para cerrar sesión
app.get('/logout', async (req, res) => {
    try {
        if (req.session.user) {
            const userId = req.session.user.id;

            // Actualizar el estado a fuera de línea en la base de datos
            await pool.query(
                'UPDATE usuarios SET online = 0 WHERE id = ?',
                [userId]
            );

            // Destruir la sesión
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error al cerrar sesión:', err);
                    return res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
                }
                res.redirect('/login');
            });
        } else {
            res.status(401).json({ success: false, error: 'No se ha iniciado sesión' });
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
    }
});

// Ruta principal que redirige a la página de inicio de sesión
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Ruta para servir el formulario de inicio de sesión
app.get('/login', checkAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

// Ruta para servir el formulario de entregas
app.get('/entregas', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/entregas.html');
});

// Ruta para servir el formulario del núcleo familiar
app.get('/nucleo', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/nucleo.html');
});

// Ruta para recuperar algun miembro eliminado previamente
app.get('/recuperar', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/recuperar.html');
});

// Ruta para servir el formulario de registro
app.get('/register', checkAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/register.html');
});

// Rutas protegidas
app.get('/integrante', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/integrante.html');
});

app.get('/editar', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/editar.html');
});

app.get('/index', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

// Ruta para manejar el inicio de sesión (autenticación)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Usuario no registrado' });
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
        }

        // Marcar al usuario como en línea en la base de datos
        await pool.query(
            'UPDATE usuarios SET online = 1 WHERE id = ?',
            [user.id]
        );

        // Guardar la información del usuario en la sesión
        req.session.user = user;

        return res.json({ success: true, redirectUrl: '/index' });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ success: false, error: 'Error al iniciar sesión' });
    }
});

// Ruta para manejar el registro de nuevos usuarios
app.post('/register', async (req, res) => {
    const { admin_password, username, password, confirm_password, role } = req.body;

    if (password !== confirm_password) {
        return res.status(400).json({ success: false, error: 'Las contraseñas no coinciden' });
    }

    try {
        const [adminRows] = await pool.query('SELECT * FROM admin_passwords WHERE id = 1');
        if (adminRows.length === 0) {
            return res.status(500).json({ success: false, error: 'No se pudo verificar la contraseña del administrador' });
        }

        const adminPasswordPlain = adminRows[0].password;
        if (admin_password !== adminPasswordPlain) {
            return res.status(401).json({ success: false, error: 'Contraseña de administrador incorrecta' });
        }

        const [rows] = await pool.query('SELECT * FROM usuarios WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.status(400).json({ success: false, error: 'El usuario ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query('INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);

        const ip = req.clientIp;
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const userAgent = req.headers['user-agent'];

        console.log(`Nuevo usuario registrado:
            Usuario: ${username}
            Rol: ${role}
            IP: ${ip}
            Fecha y Hora: ${timestamp}
            Agente de Usuario: ${userAgent}
        `);

        res.status(201).json({ success: true, redirectUrl: '/login' });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ success: false, error: 'Error al registrar usuario' });
    }
});

// Ruta para obtener la lista de miembros (verificación de cédula)
app.get('/cedula', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM miembros');
        res.json({ miembros: rows });
    } catch (error) {
        console.error('Error al obtener miembros:', error);
        res.status(500).json({ success: false, error: 'Error al obtener miembros' });
    }
});

// Ruta para manejar el registro de nuevos miembros
app.post('/register-member', async (req, res) => {
    const { nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera } = req.body;

    try {
        console.log('Datos recibidos del formulario:', req.body); 

        // Verificar si ya existe un miembro con la misma cédula de identidad
        const [existingRows] = await pool.query('SELECT * FROM miembros WHERE cedula_de_identidad = ?', [cedula_de_identidad]);
        if (existingRows.length > 0) {
            console.log('Error: Esta cédula ya se encuentra registrada en el sistema!'); 
            return res.status(400).json({ success: false, error: 'Esta cédula ya se encuentra registrada en el sistema!' });
        }

        // Si no existe, procede a insertar el nuevo miembro
        const [insertRow] = await pool.query('INSERT INTO miembros (nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera) VALUES (?, ?, ?, ?, ?, ?, ?)', [nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera]);

        console.log('Miembro registrado correctamente:', insertRow); 
        res.json({ success: true, message: 'Miembro registrado correctamente', redirectUrl: '/index' });
    } catch (error) {
        console.error('Error al registrar miembro:', error);
        res.status(500).json({ success: false, error: 'Error al registrar miembro' });
    }
});

// Ruta para actualizar un miembro
app.post('/update-member', async (req, res) => {
    const { id, nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera } = req.body;

    try {
        await pool.query(
            'UPDATE miembros SET nombres = ?, apellidos = ?, cedula_de_identidad = ?, telefono = ?, fecha_nacimiento = ?, carnet_de_patria = ?, escalera = ? WHERE id = ?',
            [nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera, id]
        );

        return res.status(200).json({ success: true, message: 'Miembro actualizado exitosamente', redirectUrl: '/index' });

    } catch (error) {
        console.error('Error al actualizar miembro:', error);
        return res.status(500).json({ success: false, error: 'Error al actualizar miembro' });
    }
});


// Ruta para obtener todos los miembros agrupados por escalera
app.get('/miembros', ensureAuthenticated, async (req, res) => {
    try {
        const usuario = req.session.user;

        if (usuario.role === 'admin' || usuario.role === 'superadmin') {
            const queryPromises = [];
            for (let i = 1; i <= 12; i++) {
                queryPromises.push(pool.query(`SELECT * FROM miembros WHERE escalera = ?`, [i]));
            }

            const results = await Promise.all(queryPromises);
            const miembrosPorEscalera = results.map(result => result[0]);

            res.json({ miembrosPorEscalera });
        } else {
            res.status(403).json({ success: false, error: 'No tienes permiso para acceder a esta información' });
        }
    } catch (error) {
        console.error('Error al obtener miembros:', error);
        res.status(500).json({ success: false, error: 'Error al obtener miembros' });
    }
});

// Ruta para obtener datos de un miembro específico
app.get('/obtener-miembro/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('SELECT * FROM miembros WHERE id = ?', [id]);
        if (result.length > 0) {
            res.json({ datosMiembro: result[0] });
        } else {
            res.status(404).json({ error: 'Miembro no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener datos del miembro:', error);
        res.status(500).json({ error: 'Error al obtener datos del miembro' });
    }
});

// Ruta para eliminar un miembro de la tabla principal y moverlo a la tabla de respaldo
app.delete('/delete-member/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        // Obtener los datos del miembro que se va a eliminar
        const [miembro] = await pool.query('SELECT * FROM miembros WHERE id = ?', [id]);

        // Verificar si se encontró el miembro
        if (miembro.length === 0) {
            return res.status(404).json({ success: false, error: 'Miembro no encontrado' });
        }

        // Guardar los datos del miembro en la tabla de respaldo antes de eliminarlo
        await pool.query('INSERT INTO miembros_respaldo (nombres, apellidos, cedula_de_identidad, telefono, fecha_nacimiento, carnet_de_patria, escalera, estado_anterior, fecha_eliminacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())', [
            miembro[0].nombres,
            miembro[0].apellidos,
            miembro[0].cedula_de_identidad,
            miembro[0].telefono,
            miembro[0].fecha_nacimiento,
            miembro[0].carnet_de_patria,
            miembro[0].escalera,
            miembro[0].estado
        ]);

        // Eliminar el miembro de la tabla principal
        await pool.query('DELETE FROM miembros WHERE id = ?', [id]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error al eliminar miembro:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar miembro' });
    }
});



// Ruta para obtener el nombre de usuario
app.get('/get-username', ensureAuthenticated, (req, res) => {
    const usuario = req.session.user;
    res.json({ username: usuario.username });
});

// Ruta para obtener el contador de miembros creados
app.get('/contador-miembros', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) AS totalMiembros FROM miembros WHERE estado = "vivo"');
        const totalMiembros = rows[0].totalMiembros || 0; // Si no hay miembros, se devuelve 0
        res.json({ totalMiembros });
    } catch (error) {
        console.error('Error al obtener contador de miembros creados:', error);
        res.status(500).json({ success: false, error: 'Error al obtener contador de miembros creados' });
    }
});



// Ruta para obtener el contador de jefes en línea
app.get('/contador-jefes', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) AS jefesEnLinea FROM usuarios WHERE role = "jefe" AND online = 1');
        const jefesEnLinea = rows[0].jefesEnLinea;
        res.json({ jefesEnLinea });
    } catch (error) {
        console.error('Error al obtener contador de jefes en línea:', error);
        res.status(500).json({ success: false, error: 'Error al obtener contador de jefes en línea' });
    }
});

// Ruta para obtener el contador de administradores en línea
app.get('/contador-admin', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) AS adminEnLinea FROM usuarios WHERE role = "admin" AND online = 1');
        const adminEnLinea = rows[0].adminEnLinea;
        res.json({ adminEnLinea });
    } catch (error) {
        console.error('Error al obtener contador de administradores en línea:', error);
        res.status(500).json({ success: false, error: 'Error al obtener contador de administradores en línea' });
    }
});

// Ruta para obtener todos los miembros
app.get('/todos-los-miembros', ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM miembros');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener miembros:', error);
        res.status(500).json({ success: false, error: 'Error al obtener miembros' });
    }
});


// REGISTRO ENTREGAS

app.post('/registrar-entrega', ensureAuthenticated, async (req, res) => {
    const { cedula, tipo } = req.body;

    try {
        let updateField = '';
        if (tipo === 'clap') updateField = 'clap';
        if (tipo === 'gas') updateField = 'gas';
        if (tipo === 'combo') updateField = 'combo';

        if (tipo === 'gas') {
            // Verificar si el gas ha sido recibido
            const [result] = await pool.query('SELECT * FROM entregas_gas WHERE cedula_de_identidad = ? AND recibido = TRUE', [cedula]);
            if (result.length === 0) {
                return res.json({ success: false, error: 'El cilindro de gas no ha sido recibido aún' });
            }

            // Registrar la entrega de gas
            await pool.query('UPDATE entregas_gas SET entregado = TRUE, fecha_entregado = NOW() WHERE cedula_de_identidad = ?', [cedula]);
        }

        const [result] = await pool.query(`UPDATE entregas SET ${updateField} = TRUE, fecha_${updateField} = NOW() WHERE cedula_de_identidad = ?`, [cedula]);

        if (result.affectedRows === 0) {
            await pool.query(`INSERT INTO entregas (cedula_de_identidad, ${updateField}, fecha_${updateField}) VALUES (?, TRUE, NOW())`, [cedula]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error al registrar entrega:', error);
        res.status(500).json({ success: false, error: 'Error al registrar entrega' });
    }
});

// Reiniciar entregas
app.post('/reiniciar-entregas', ensureAuthenticated, async (req, res) => {
    try {
        // Insertar en la tabla de respaldo antes de reiniciar
        await pool.query(`
            INSERT INTO entregas_respaldo (cedula_de_identidad, clap, gas, combo, fecha_clap, fecha_gas, fecha_combo, fecha_reinicio)
            SELECT cedula_de_identidad, clap, gas, combo, fecha_clap, fecha_gas, fecha_combo, NOW()
            FROM entregas
        `);

        // Reiniciar las entregas
        await pool.query('UPDATE entregas SET clap = FALSE, gas = FALSE, combo = FALSE, fecha_clap = NULL, fecha_gas = NULL, fecha_combo = NULL');

        res.json({ success: true });
    } catch (error) {
        console.error('Error al reiniciar entregas:', error);
        res.status(500).json({ success: false, error: 'Error al reiniciar entregas' });
    }
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor en funcionamiento en http://localhost:${PORT}`);
});
