# Trabajo Práctico 08 - Endpoints Persistentes de Reservas de Salas

## 1. Identificación y Origen del Proyecto
* **Proyecto:** `tp-08-salas-http-mongodb`
* **Origen:** Copia funcional individual del TP 07, desacoplada de almacenamiento volátil y adaptada a persistencia asíncrona mediante base de datos documental.
* **Tecnologías y Versiones:**
  * Node.js v20+ / CommonJS
  * Express v5.x
  * Mongoose v8.x
  * Morgan, EJS y Express-EJS-Layouts

---

## 2. Preparación del Entorno y Base de Datos
* **Clúster:** MongoDB Atlas Free (Tier M0).
* **Base de datos:** `reservas_salas_u8`
* **Colección:** `reservas`
* **Ajuste de DNS:** Se conservó la configuración en `src/config/base-datos.js` utilizando `dns.setServers(["8.8.8.8", "1.1.1.1"])` para evitar problemas de resolución SRV en entornos corporativos o redes con bloqueos locales.

### Variables de Entorno
El repositorio no incluye secretos ni archivos `.env`. Para la ejecución local, crear el archivo `.env` en la raíz tomando como base la plantilla `.env.example`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@HOST/reservas_salas_u8?retryWrites=true&w=majority
```

*(Reemplazar `USUARIO`, `CLAVE` y `HOST` por las credenciales reales provistas por Atlas).*

---

## 3. Comandos de Inicio y Ejecución
Para iniciar el servidor cargando las variables locales:

```bash
# Comando directo con carga nativa de entorno
node --env-file=.env src/index.js

# O mediante script si está configurado en package.json
npm start
```

### Arranque y Cierre Ordenado
1. **Conexión previa:** La función `main()` espera la resolución de `conectarBaseDatos()` antes de ejecutar `app.listen()`. Si la base es inaccesible, el puerto no se abre y el proceso termina.
2. **Graceful Shutdown:** Se capturan las señales `SIGINT` y `SIGTERM` para cerrar el servidor HTTP, esperar el término de solicitudes pendientes y desconectar limpiamente Mongoose (`desconectarBaseDatos()`).

---

## 4. Arquitectura y Estructura por Capas

```text
tp-08-salas-http-mongodb/
├── datos/
│   └── constantes.js              # Enums de salas y turnos permitidos
├── public/                        # Hojas de estilo y recursos estáticos
├── src/
│   ├── app.js                     # Configuración del pipeline Express, montaje de routers y errores
│   ├── index.js                   # Arranque, conexión a MongoDB y gestión de señales
│   ├── config/
│   │   ├── base-datos.js          # Conexión/desconexión con Mongoose y DNS
│   │   └── entorno.js             # Validación estricta de variables de entorno
│   ├── controladores/
│   │   └── reservas.js            # Lógica web (HTML) y API (JSON)
│   ├── middleware/
│   │   ├── errores.js             # Middleware centralizado de errores (Express 5)
│   │   ├── reservas.js            # Validación dual (HTML/JSON) y tipado estricto
│   │   └── solicitudes.js         # Logging de duración y asignación de ID de solicitud
│   ├── modelos/
│   │   └── reserva.js             # Esquema y modelo de Mongoose
│   ├── rutas/
│   │   ├── reservas.js            # Router HTML para el sitio web (/reservas)
│   │   └── reservas-api.js        # Router REST JSON (/api/reservas)
│   └── servicios/
│       ├── reservas.js            # Servicio en memoria anterior (referencia histórica)
│       └── reservas-mongo.js      # Servicio asíncrono sobre Mongoose
├── views/                         # Plantillas EJS del sitio web
├── .env.example                   # Plantilla pública sin secretos
├── .gitignore                     # Exclusión de .env y node_modules
├── package.json
└── README.md
```

### Desacople de Memoria
Se eliminaron las importaciones del JSON inicial y de `crearServicioReservas` en `src/index.js`. Ahora tanto las vistas del sitio web como los endpoints de la API consumen exclusivamente `crearServicioReservasMongo()`, asegurando una única fuente compartida de datos.

---

## 5. Tabla de Endpoints

| Método | Endpoint | Canal | Estado | Descripción / Contrato |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/reservas` | Web | 200 | Renderiza el listado HTML con reservas obtenidas de Atlas. |
| **GET** | `/reservas/nueva` | Web | 200 | Renderiza el formulario de carga. |
| **POST** | `/reservas` | Web | 302 / 400 | Guarda la reserva y redirige (302) o renderiza con error (400) conservando datos. |
| **GET** | `/reservas/:id` | Web | 200 / 404 | Renderiza el detalle del recurso o página de no encontrado. |
| **GET** | `/estado` | Web/API | 200 | Retorna estado del servicio y conteo dinámico desde MongoDB (`countDocuments()`). |
| **GET** | `/api/reservas` | API | 200 | Arreglo JSON con todas las reservas (o `[]` si está vacía). |
| **GET** | `/api/reservas?sala=...`| API | 200 / 400 | Filtra por coincidencia exacta. Rechaza con 400 si se repite el parámetro. |
| **GET** | `/api/reservas/:id` | API | 200 / 404 | Devuelve el objeto JSON o 404 si el ID no existe (400 si es mal formado). |
| **POST** | `/api/reservas` | API | 201 / 400 | Crea recurso, añade cabecera `Location` y responde el documento creado. |

---

## 6. Reproducción de Solicitudes en Postman

1. **Configuración General:**
   * Utilizar la versión de escritorio de Postman.
   * Servidor local corriendo en `http://localhost:3000`.

2. **Crear una reserva (POST):**
   * **Método:** `POST`
   * **URL:** `http://localhost:3000/api/reservas`
   * **Headers:** `Content-Type: application/json`
   * **Body:** seleccionar `raw` y formato `JSON`:
     ```json
     {
       "estudiante": "Ana Ejemplo",
       "email": "ana.ejemplo@example.com",
       "sala": "Sala Norte",
       "fecha": "2026-10-21",
       "turno": "Mañana",
       "personas": 2
     }
     ```
   * **Respuesta esperada:** Código `201 Created`. En la pestaña **Headers** de la respuesta se verifica la cabecera `Location` con la URL relativa o absoluta (ej. `/api/reservas/653a...`). El cuerpo contiene el ID textual y `estado: "pendiente"`.

3. **Consultar recurso por Location (GET):**
   * **Método:** `GET`
   * **URL:** `http://localhost:3000/api/reservas/{ID_OBTENIDO}`
   * **Body:** `none`
   * **Respuesta esperada:** Código `200 OK` con los datos persistidos.

---

## 7. Matriz de Pruebas y Resultados Observados

| Caso Evaluado | Entrada / Solicitud | Estado Esperado | Resultado Observado / Evidencia |
| :--- | :--- | :---: | :--- |
| **Colección inicial vacía** | `GET /api/reservas` | 200 | Retornó `[]` sin alterar la base de datos. |
| **Creación válida** | `POST /api/reservas` con JSON válido | 201 | Creado. Cabecera `Location` presente, `estado: "pendiente"` por default. |
| **Consulta por ID generado** | `GET /api/reservas/:id` del recurso creado | 200 | Retornó el recurso correspondiente con su `id` textual. |
| **ID con formato inválido** | `GET /api/reservas/1` | 400 | Retornó JSON `{ error: "El identificador debe tener 24 caracteres..." }`. |
| **ID válido inexistente** | `GET /api/reservas/000000000000000000000000` | 404 | Retornó JSON `{ error: "Reserva no encontrada." }`. |
| **Estudiante ausente/vacío** | `POST` con `"estudiante": ""` | 400 | Rechazado; la cantidad de reservas no aumentó. |
| **Email sin arroba** | `POST` con `"email": "anaexample.com"` | 400 | Rechazado por validación de formato. Cantidad inalterada. |
| **Sala fuera de enum** | `POST` con `"sala": "Sala Inexistente"` | 400 | Rechazado con mensaje de validación de sala permitida. |
| **Turno no permitido** | `POST` con `"turno": "Madrugada"` | 400 | Rechazado; cantidad en base de datos estable. |
| **Personas inválidas (0 o 7)** | `POST` con `"personas": 0` y `"personas": 7` | 400 | Rechazado; exige entero entre 1 y 6. |
| **Personas decimal ("2.5")** | `POST` con `"personas": 2.5` | 400 | Rechazado; no supera la validación de número entero. |
| **Personas booleano/array** | `POST` con `"personas": true` o `[3]` | 400 | Rechazado por el validador estricto de tipos del middleware. |
| **Body ausente o JSON roto**| `POST` sin cuerpo o con sintaxis inválida | 400 | El parser y el middleware capturan el fallo y devuelven 400 JSON. |
| **Intento inyección de campos**| `POST` enviando `"estado": "confirmada"`, `"_id": "..."` | 201 | Aceptado pero sanitizado: ignora el `_id` y fuerza `estado: "pendiente"`. |
| **Filtro exacto por sala** | `GET /api/reservas?sala=Sala%20Norte` | 200 | Retorna únicamente coincidencias de Sala Norte. |
| **Filtro sin coincidencias** | `GET /api/reservas?sala=Sala%20Desconocida` | 200 | Retorna `[]` sin generar excepciones. |
| **Filtro con parámetro doble**| `GET /api/reservas?sala=Sala%20Norte&sala=Sala%20Sur` | 400 | Detecta query como arreglo y responde `FILTRO_INVALIDO`. |
| **Listar dos veces** | `GET /api/reservas` repetido | 200 | Cantidad estable e idéntica entre llamadas consecutivas. |
| **Formulario Web Válido** | `POST /reservas` desde navegador | 302 | Redirige a `/reservas` e impacta en la colección de Atlas. |
| **Formulario Web Inválido**| `POST /reservas` con errores | 400 | Renderiza nuevamente `reservas/nueva` preservando los campos ingresados. |
| **Ruta /estado persistente**| `GET /estado` | 200 | Reporta el total dinámico consultando directamente `countDocuments()`. |
| **Fallo de URI al arrancar** | Iniciar con `MONGODB_URI` ausente o inválida | Sin puerto | Proceso abortado; no abre puerto ni anuncia disponibilidad. |

---

## 8. Evidencia de Persistencia (Prueba de Reinicio)

Para comprobar que los datos no dependen del ciclo de vida del servidor ni de estructuras volátiles en memoria:

1. **Estado Inicial:** Se consultó `GET /api/reservas`, registrando un conteo de $5$ elementos.
2. **Creación:** Se envió una solicitud `POST /api/reservas` con una reserva de prueba para el estudiante `"Ana Ejemplo"`.
3. **Respuesta:** Se obtuvo código `201 Created` y la cabecera `Location: /api/reservas/6adce3404cc87bc084e2c917`.
4. **Consulta inmediata:** Se realizó `GET /api/reservas/6adce3404cc87bc084e2c917`, confirmando `200 OK` y `estado: "pendiente"`.
5. **Apagado del Servidor:** Se interrumpió el proceso en terminal con `Ctrl + C`, ejecutando el cierre ordenado de la conexión con MongoDB.
6. **Reinicio:** Se volvió a ejecutar `node --env-file=.env src/index.js`.
7. **Verificación posterior:**
   * Se reenvió exactamente la misma solicitud `GET /api/reservas/6adce3404cc87bc084e2c917` **sin realizar un nuevo POST**.
   * El servidor retornó `200 OK` con los datos intactos.
   * Se comprobó la presencia del documento con `_id: ObjectId("6adce3404cc87bc084e2c917")` en el Data Explorer de Atlas (`reservas_salas_u8.reservas`).

---

## 9. Límites de Validación y Comparación con el TP 07

### Límites del Modelo Actual
* No se valida si la fecha ingresada es futura ni si corresponde a un día hábil.
* No se controla solapamiento de reservas en el mismo turno y sala (no se exigen índices compuestos únicos en esta entrega).
* No se admiten endpoints de actualización (`PUT`/`PATCH`) ni de baja (`DELETE`).
* No implementa autenticación ni autorización de usuarios.

### Comparación con el TP 07
| Aspecto | TP 07 (Línea Base) | TP 08 (Entrega Actual) |
| :--- | :--- | :--- |
| **Persistencia** | Volátil en memoria / scripts aislados | Centralizada en MongoDB Atlas para todo el servidor |
| **Servicio** | Síncrono sobre arreglos locales | Asíncrono (`async/await`) sobre Mongoose |
| **Canales** | Exclusivamente vistas HTML (EJS) | Dual: Sitio Web HTML y API RESTful JSON |
| **Identificadores**| Numéricos incrementales locales | Identificadores textuales derivados de `ObjectId` |
| **Control de Errores**| Manejo puntual en vistas | Middleware centralizado con distinción de formato y canal |


