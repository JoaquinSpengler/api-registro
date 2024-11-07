require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Configuración de CORS para permitir cookies y credenciales
const corsOptions = {
    origin: ['http://localhost:5173', 'https://radiador-spring-tp.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true  // Permite el envío de cookies
};
app.use(cors(corsOptions));

// Configuración de conexión a la base de datos
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

app.get('/api/obtener_autos', async (req, res) => {
    try {
        const db = await getConnection();
        const [results] = await db.query('SELECT * FROM autos');
        res.json(results);
    } catch (err) {
        console.error('Error al obtener autos:', err);
        res.status(500).json({ error: 'Error al obtener autos' });
    }
});


// Endpoint para iniciar sesión
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.execute('SELECT * FROM usuario WHERE email = ?', [email]);

        if (rows.length === 0 || rows[0].password !== password) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = rows[0];
        const sessionId = Math.random().toString(36).substring(2);

        await connection.execute('INSERT INTO sesiones (session_id, user_id) VALUES (?, ?)', [sessionId, user.id_usuario]);

        res.cookie('session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None',
            maxAge: 3600000
        });

        await connection.end();
        return res.status(200).json({ message: 'Inicio de sesión exitoso' });
    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
});

// Endpoint para verificar la sesión
app.get('/api/check-session', async (req, res) => {
    const { session_id } = req.cookies;

    if (!session_id) {
        return res.status(401).json({ authenticated: false });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [sessions] = await connection.execute('SELECT * FROM sesiones WHERE session_id = ?', [session_id]);

        if (sessions.length === 0) {
            await connection.end();
            return res.status(401).json({ authenticated: false });
        }

        const session = sessions[0];
        const [userRows] = await connection.execute('SELECT * FROM usuario WHERE id_usuario = ?', [session.user_id]);

        await connection.end();

        if (userRows.length === 0) {
            return res.status(401).json({ authenticated: false });
        }

        const user = userRows[0];
        return res.status(200).json({ authenticated: true, role: user.rol });
    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
});

app.listen(process.env.PORT || 5000, () => {
    console.log("Servidor corriendo en el puerto", process.env.PORT || 5000);
});
