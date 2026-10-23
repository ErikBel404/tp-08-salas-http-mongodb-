const express = require("express");
const { validarReserva } = require("../middleware/reservas");

function crearRouterReservasApi(controlador) {
  const router = express.Router();

  // GET /api/reservas (con o sin ?sala=...) -> JSON
  router.get("/", controlador.listarApi);

  // GET /api/reservas/:id -> JSON
  router.get("/:id", controlador.obtenerApi);

  // POST /api/reservas -> 201 + JSON + cabecera Location
  router.post("/", validarReserva, controlador.crearApi);

  return router;
}

module.exports = { crearRouterReservasApi };