import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("Generando respaldo preventivo antes de agregar cuadrangulares...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups", `pre_cuadrangulares_${timestamp}`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tablas: Record<string, () => Promise<any>> = {
    usuario: () => prisma.usuario.findMany(),
    puntaje: () => prisma.puntaje.findMany(),
    resultado_oficial: () => prisma.resultadoOficial.findMany({ include: { goleadores: true } }),
    prediccion_partido: () => prisma.prediccionPartido.findMany(),
    prediccion_inicial: () => prisma.prediccionInicial.findMany({ include: { clasificados: true } }),
    partido: () => prisma.partido.findMany(),
    jugador: () => prisma.jugador.findMany(),
  };

  const resumen: Record<string, number> = {};

  for (const [nombre, fetcher] of Object.entries(tablas)) {
    const datos = await fetcher();
    fs.writeFileSync(path.join(dir, `${nombre}.json`), JSON.stringify(datos, null, 2));
    resumen[nombre] = Array.isArray(datos) ? datos.length : 1;
  }

  fs.writeFileSync(
    path.join(dir, "_metadata.json"),
    JSON.stringify(
      {
        fecha_backup: new Date().toISOString(),
        motivo: "Respaldo previo a insertar partidos de Cuadrangulares Semifinales",
        registros_por_tabla: resumen,
      },
      null,
      2
    )
  );

  console.log(`[BACKUP AUTOMÁTICO OK] Guardado en: ${dir}`);
  console.log("Resumen:", resumen);
}

main().catch(console.error).finally(() => prisma.$disconnect());
