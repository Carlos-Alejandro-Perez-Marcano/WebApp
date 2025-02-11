const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const db = require('./db/database');
require('dotenv').config({ path: './entorno.env' });
const http = require('http');  // Requiere 'http' para Socket.IO
const socketIo = require('socket.io');  // Requiere 'socket.io'
const sharedSession = require('express-socket.io-session');  // Para compartir la sesión con Socket.IO

const app = express();
const port = 3000;
const server = http.createServer(app);  // Crea el servidor HTTP con Express
const io = socketIo(server);  // Asocia Socket.IO con el servidor

// Configura la sesión de Express
const expressSession = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});

app.use(expressSession);  // Usa la sesión en Express
io.use(sharedSession(expressSession, { autoSave: true }));  // Comparte la sesión con Socket.IO

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');

// Rutas de la aplicación
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    db.get(
        'SELECT username FROM users WHERE id = ?',
        [req.session.userId],
        (err, user) => {
            if (err || !user) {
                return res.redirect('/login');
            }
            res.render('home', { username: user.username });
        }
    );
});

app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.render('register', { error: 'Las contraseñas no coinciden' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err) => {
                if (err) {
                    console.error('Error al registrar usuario:', err.message);
                    return res.render('register', { error: 'El usuario ya existe o hubo un problema' });
                }
                console.log('Usuario registrado con éxito');
                res.redirect('/login');
            }
        );
    } catch (error) {
        console.error('Error en el servidor:', error.message);
        res.render('register', { error: 'Error en el servidor' });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, user) => {
            if (err) {
                console.error('Error al buscar usuario:', err.message);
                return res.render('login', { error: 'Error del servidor' });
            }
            if (!user) {
                return res.render('login', { error: 'Usuario no encontrado' });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.render('login', { error: 'Contraseña incorrecta' });
            }

            req.session.userId = user.id;
            req.session.username = user.username;  // Almacena el nombre de usuario en la sesión
            res.redirect('/');
        }
    );
});

app.get('/profile', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    db.get(
        'SELECT username FROM users WHERE id = ?',
        [req.session.userId],
        (err, user) => {
            if (err || !user) {
                return res.redirect('/login');
            }
            res.render('profile', { username: user.username });
        }
    );
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Error al cerrar sesión');
        }
        res.redirect('/login');
    });
});

// Ruta de chat
app.get('/chat', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    db.get('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.redirect('/login');
        }
        res.render('chat', { username: user.username });  // Renderiza la vista 'chat.ejs'
    });
});

// Configuración de Socket.IO
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado');

    // Cuando el cliente envía un mensaje
    socket.on('chat message', (msg) => {
        const username = socket.handshake.session.username;  // Obtener el nombre de usuario desde la sesión
        io.emit('chat message', { username: username, message: msg });  // Emitir a todos los usuarios
    });

    // Cuando el cliente se desconecta
    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado');
    });
});

// Iniciar el servidor
server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});