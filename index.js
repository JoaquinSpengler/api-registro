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
    origin: ['http://localhost:5173', 'https://radiador-spring-tp.vercel.app','https://api-registro-ten.vercel.app/'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true  // Permite el envío de cookies
};
app.use(cors(corsOptions));

// Configuración de conexión a la base de datos
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};


app.get('/api/obtener_autos', async (req, res) => {
    try {
        const db = await mysql.createConnection(dbConfig);
        const [results] = await db.query('SELECT * FROM autos');
        res.json(results);
    } catch (err) {
        console.error('Error al obtener autos:', err);
        res.status(500).json({ error: 'Error al obtener autos' });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const connection = await mysql.createConnection(dbConfig);
  
      const [rows] = await connection.execute(
        "SELECT * FROM usuario WHERE email = ?",
        [email]
      );
  
      if (rows.length === 0 || rows[0].password !== password) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
  
      const user = rows[0];
  
      await connection.end();
      return res
        .status(200)
        .json({
          message: "Inicio de sesión exitoso",
          user: user,
          role: user.rol,
        });
    } catch (error) {
      console.error("Error en el login:", error);
      res
        .status(500)
        .json({ message: "Error interno del servidor", error: error.message });
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

app.post("/api/registrar-conductor", async (req, res) => {
    const {nombre, apellido, dni,habilitado,password,email,rol} = req.body;
  
    try {
      const db = await mysql.createConnection(dbConfig);
      await db.execute(
        "INSERT INTO usuario (nombre, apellido, dni,habilitado,password,email,rol) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nombre, apellido, dni,habilitado,password,email,rol]
      );
      res.json({ message: "Usuario registrado correctamente" });
         } catch (err) {
      console.error("Error al registrar usuario:", err);
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const { sessionId } = req.body; // Recibir el sessionId del frontend
  
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID no proporcionado" }); // Validar que se haya enviado un sessionId
    }
  
    try {
      const connection = await mysql.createConnection(dbConfig);
  
      const expiredAt = new Date(); // Fecha y hora actuales para marcar la sesión como caducada
  
      // Actualizar la sesión en la base de datos, poniendo una fecha de expiración
      await connection.execute(
        "UPDATE sesiones SET expires_at = ? WHERE session_id = ?",
        [expiredAt, sessionId]
      );
  
      await connection.end();
  
      // Responder con éxito
      return res.json({ message: "Sesión cerrada correctamente" });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      return res.status(500).json({ error: "Error al cerrar sesión" });
    }
  });
  
  
app.listen(process.env.PORT, () => {
    console.log("Servidor corriendo en el puerto", process.env.PORT);
});


