const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser'); 
const bcrypt = require('bcrypt');
const db = require('./db/database');
require('dotenv').config({ path: './entorno.env' });

const app = express();
const port = 3000;


app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static('public')); 
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


app.set('view engine', 'ejs');


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
            res.redirect('/');
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


app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});