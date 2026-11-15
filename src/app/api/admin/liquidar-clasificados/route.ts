import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CategoriaPuntaje } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * LIQUIDACIÓN DE LOS 8 CLASIFICADOS A CUADRANGULARES
 * ==================================================
 *
 * Reglamento 2026-II, numeral 5.1.3: 20 puntos por cada equipo acertado entre los
 * ocho clasificados a los cuadrangulares semifinales, sin importar el orden
 * (máximo 160).
 *
 * Mismo diseño defensivo que /api/admin/homologar-puntos:
 *   1. Cero cambios de esquema (usa clasificado_oficial y puntaje, que ya existen).
 *   2. DRY-RUN por defecto. Solo escribe con "aplicar": true.
 *   3. Todo en UNA transacción, con la verificación DENTRO: si algún participante no
 *      obtiene exactamente los aciertos esperados, se lanza y Postgres revierte todo.
 *   4. Devuelve el respaldo de las filas que va a reemplazar antes de tocarlas.
 *   5. Doble autenticación: usuario administrador + secreto compartido.
 *   6. Idempotente: borra solo las filas de la categoría clasificados_cuadrangulares
 *      y las vuelve a crear; ejecutarlo dos veces deja el mismo resultado.
 *
 * Las filas se guardan con partido_id = null (no vienen de un partido), así que
 * reliquidar-todo y fix-table (que solo borran filas con partido) no las tocan, y
 * homologar-puntos solo borra sus propias categorías.
 *
 * USO:
 *   POST /api/admin/liquidar-clasificados
 *   { "usuario_id": <admin>, "secret": "...", "aplicar": false }
 */

const PUNTOS_POR_ACIERTO = 20;

/** Los 8 clasificados oficiales de la Liga BetPlay 2026-II (tabla final, fecha 19). */
const CLASIFICADOS_OFICIALES = [
  "Atlético Nacional",
  "América de Cali",
  "Deportivo Cali",
  "Atlético Bucaramanga",
  "Independiente Santa Fe",
  "Independiente Medellín",
  "Millonarios F.C.",
  "Once Caldas DAF",
];

/**
 * Aciertos esperados por participante, calculados a mano sobre los pronósticos
 * publicados en el panel "Predicciones Torneo" (12/11/2026). Sirven de control
 * cruzado: si lo que hay en la base difiere, la transacción se revierte.
 * Hernando Davila no envió pronósticos iniciales: 0.
 */
const ACIERTOS_ESPERADOS: Record<string, number> = {
  "Andres del Toro": 5,
  "Erick Andrade": 6,
  "Harold Berdugo": 6,
  "Ignacio Barrios": 7,
  "Juan Hernandez": 6,
  "Lucas Saavedra": 6,
  "Luis Betancourt": 6,
  "Manuel Cabarcas": 6,
  "Nelson Berdugo": 5,
  "Pedro Cantero": 6,
  "Rene Osorio": 5,
  "Ricardo Soto": 7,
  "Ricardo Vanegas": 7,
  "Romario Gomez": 6,
  "Samuel Gutierrez": 6,
  "Hernando Davila": 0,
};

function normalizar(nombre: string): string {
  return (nombre || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  const detalle: any[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    const { usuario_id, secret, aplicar = false } = body ?? {};

    // --- 1. Secreto compartido -------------------------------------------------
    const secretoEsperado = process.env.HOMOLOGACION_SECRET || process.env.SYNC_LIVE_SECRET;
    if (!secretoEsperado) {
      return NextResponse.json(
        { error: "No hay secreto configurado en el servidor (HOMOLOGACION_SECRET o SYNC_LIVE_SECRET)." },
        { status: 500 }
      );
    }
    if (!secret || secret !== secretoEsperado) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // --- 2. Usuario administrador ---------------------------------------------
    if (!usuario_id) {
      return NextResponse.json({ error: "Falta usuario_id" }, { status: 400 });
    }
    const admin = await prisma.usuario.findUnique({
      where: { id: Number(usuario_id) },
      include: { rol: true },
    });
    if (!admin || admin.rol.nombre !== "administrador") {
      return NextResponse.json({ error: "No tienes permisos de administrador" }, { status: 403 });
    }

    // --- 3. Equipos oficiales --------------------------------------------------
    const equipos = await prisma.equipo.findMany({ select: { id: true, nombre: true } });
    const equipoPorNombre = new Map(equipos.map((e) => [normalizar(e.nombre), e]));
    const oficiales = CLASIFICADOS_OFICIALES.map((n) => equipoPorNombre.get(normalizar(n)));
    const faltantes = CLASIFICADOS_OFICIALES.filter((_, i) => !oficiales[i]);
    if (faltantes.length > 0) {
      return NextResponse.json({ error: "Equipos oficiales no encontrados en la base", faltantes }, { status: 409 });
    }
    const idsOficiales = new Set(oficiales.map((e) => e!.id));

    // --- 4. Participantes esperados -------------------------------------------
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    const esperadoPorNombre = new Map(Object.entries(ACIERTOS_ESPERADOS).map(([n, a]) => [normalizar(n), { n, a }]));
    const participantes = usuarios.filter((u) => esperadoPorNombre.has(normalizar(u.nombre_completo)));
    if (participantes.length !== esperadoPorNombre.size) {
      return NextResponse.json(
        {
          error: "Los participantes esperados no coinciden con los usuarios activos de la base.",
          no_encontrados: Object.keys(ACIERTOS_ESPERADOS).filter(
            (n) => !usuarios.some((u) => normalizar(u.nombre_completo) === normalizar(n))
          ),
        },
        { status: 409 }
      );
    }

    // --- 5. Respaldo de lo que se va a reemplazar -----------------------------
    const respaldo = {
      puntaje_clasificados: await prisma.puntaje.findMany({
        where: { categoria: CategoriaPuntaje.clasificados_cuadrangulares },
      }),
      clasificado_oficial: await prisma.clasificadoOficial.findMany(),
    };

    const ejecutar = async (tx: any) => {
      // Clasificados oficiales
      await tx.clasificadoOficial.deleteMany({});
      await tx.clasificadoOficial.createMany({ data: oficiales.map((e) => ({ equipo_id: e!.id })) });

      // Puntajes de la categoría (idempotente)
      await tx.puntaje.deleteMany({ where: { categoria: CategoriaPuntaje.clasificados_cuadrangulares } });

      const predicciones = await tx.prediccionInicial.findMany({
        where: { usuario_id: { in: participantes.map((u) => u.id) } },
        include: { clasificados: { include: { equipo: { select: { id: true, nombre: true } } } } },
      });
      const predPorUsuario = new Map<number, any>(predicciones.map((p: any) => [p.usuario_id, p]));

      let errores = 0;
      detalle.length = 0;
      for (const u of participantes) {
        const pred = predPorUsuario.get(u.id);
        const elegidos: { id: number; nombre: string }[] = pred ? pred.clasificados.map((c: any) => c.equipo) : [];
        const acertados = elegidos.filter((e) => idsOficiales.has(e.id));
        const puntos = acertados.length * PUNTOS_POR_ACIERTO;
        const esperado = esperadoPorNombre.get(normalizar(u.nombre_completo))!.a;

        if (puntos > 0) {
          await tx.puntaje.create({
            data: {
              usuario_id: u.id,
              categoria: CategoriaPuntaje.clasificados_cuadrangulares,
              partido_id: null,
              puntos_obtenidos: puntos,
            },
          });
        }

        const ok = acertados.length === esperado;
        if (!ok) errores++;
        detalle.push({
          participante: u.nombre_completo,
          pronosticados: elegidos.length,
          acertados: acertados.map((e) => e.nombre),
          no_acertados: elegidos.filter((e) => !idsOficiales.has(e.id)).map((e) => e.nombre),
          aciertos: acertados.length,
          esperado,
          puntos,
          ok,
        });
      }

      // Verificación final dentro de la transacción
      const filas = await tx.puntaje.findMany({ where: { categoria: CategoriaPuntaje.clasificados_cuadrangulares } });
      const totalEscrito = filas.reduce((s: number, f: any) => s + f.puntos_obtenidos, 0);
      const totalEsperado = Object.values(ACIERTOS_ESPERADOS).reduce((s, a) => s + a * PUNTOS_POR_ACIERTO, 0);
      if (totalEscrito !== totalEsperado) errores++;

      if (errores > 0) {
        throw new Error(
          `VERIFICACION_FALLIDA: ${errores} diferencia(s) frente a los aciertos esperados (escrito ${totalEscrito}, esperado ${totalEsperado}). No se aplicó ningún cambio.`
        );
      }
    };

    if (!aplicar) {
      const SENTINELA = "DRY_RUN_OK";
      try {
        await prisma.$transaction(
          async (tx) => {
            await ejecutar(tx);
            throw new Error(SENTINELA);
          },
          { timeout: 55000, maxWait: 15000 }
        );
      } catch (e: any) {
        if (!String(e?.message || "").includes(SENTINELA)) throw e;
      }
      detalle.sort((a, b) => b.puntos - a.puntos || a.participante.localeCompare(b.participante));
      return NextResponse.json({
        modo: "dry-run",
        mensaje: "Simulación completa: se calculó todo y se revirtió. No se escribió nada.",
        clasificados_oficiales: CLASIFICADOS_OFICIALES,
        detalle,
        para_aplicar: 'Repite la llamada con "aplicar": true',
      });
    }

    await prisma.$transaction(ejecutar, { timeout: 55000, maxWait: 15000 });
    detalle.sort((a, b) => b.puntos - a.puntos || a.participante.localeCompare(b.participante));

    return NextResponse.json({
      modo: "aplicado",
      mensaje: "Clasificados liquidados y verificados.",
      clasificados_oficiales: CLASIFICADOS_OFICIALES,
      detalle,
      respaldo,
    });
  } catch (error: any) {
    const msg = error?.message || "Error interno";
    console.error("Error en liquidar-clasificados:", msg);
    return NextResponse.json(
      {
        error: msg,
        detalle: detalle.length ? detalle : undefined,
        nota: msg.includes("VERIFICACION_FALLIDA")
          ? "La transacción se revirtió por completo: la base quedó exactamente como estaba."
          : undefined,
      },
      { status: 500 }
    );
  }
}
