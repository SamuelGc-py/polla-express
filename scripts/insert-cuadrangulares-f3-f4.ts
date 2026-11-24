import { PrismaClient, Fase, Grupo, EstadoPartido } from '@prisma/client';

const prisma = new PrismaClient();

const partidosFechas3y4 = [
  // --- FECHA 3 (Jornada 22) ---
  // GRUPO B (Viernes 27 de noviembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 22,
    localNombre: 'Deportivo Cali',
    visitanteNombre: 'Atlético Bucaramanga',
    fecha_hora_partido: new Date('2026-11-27T23:35:00.000Z'), // 6:35 PM Col
    hora_cierre_predicciones: new Date('2026-11-27T23:05:00.000Z'),
    estadio: 'Deportivo Cali',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 22,
    localNombre: 'Millonarios F.C.',
    visitanteNombre: 'América de Cali',
    fecha_hora_partido: new Date('2026-11-28T01:40:00.000Z'), // 8:40 PM Col
    hora_cierre_predicciones: new Date('2026-11-28T01:10:00.000Z'),
    estadio: 'El Campín',
  },
  // GRUPO A (Sábado 28 de noviembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 22,
    localNombre: 'Independiente Santa Fe',
    visitanteNombre: 'Atlético Nacional',
    fecha_hora_partido: new Date('2026-11-29T00:30:00.000Z'), // 7:30 PM Col
    hora_cierre_predicciones: new Date('2026-11-29T00:00:00.000Z'),
    estadio: 'El Campín',
  },
  // GRUPO A (Domingo 29 de noviembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 22,
    localNombre: 'Independiente Medellín',
    visitanteNombre: 'Once Caldas DAF',
    fecha_hora_partido: new Date('2026-11-29T23:30:00.000Z'), // 6:30 PM Col
    hora_cierre_predicciones: new Date('2026-11-29T23:00:00.000Z'),
    estadio: 'Atanasio Girardot',
  },

  // --- FECHA 4 (Jornada 23) ---
  // GRUPO B (Martes 1 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 23,
    localNombre: 'Atlético Bucaramanga',
    visitanteNombre: 'Deportivo Cali',
    fecha_hora_partido: new Date('2026-12-01T23:20:00.000Z'), // 6:20 PM Col
    hora_cierre_predicciones: new Date('2026-12-01T22:50:00.000Z'),
    estadio: 'Américo Montanini',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 23,
    localNombre: 'América de Cali',
    visitanteNombre: 'Millonarios F.C.',
    fecha_hora_partido: new Date('2026-12-02T01:30:00.000Z'), // 8:30 PM Col
    hora_cierre_predicciones: new Date('2026-12-02T01:00:00.000Z'),
    estadio: 'Pascual Guerrero',
  },
  // GRUPO A (Miércoles 2 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 23,
    localNombre: 'Once Caldas DAF',
    visitanteNombre: 'Independiente Medellín',
    fecha_hora_partido: new Date('2026-12-02T23:20:00.000Z'), // 6:20 PM Col
    hora_cierre_predicciones: new Date('2026-12-02T22:50:00.000Z'),
    estadio: 'Palogrande',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 23,
    localNombre: 'Atlético Nacional',
    visitanteNombre: 'Independiente Santa Fe',
    fecha_hora_partido: new Date('2026-12-03T01:30:00.000Z'), // 8:30 PM Col
    hora_cierre_predicciones: new Date('2026-12-03T01:00:00.000Z'),
    estadio: 'Atanasio Girardot',
  },
];

async function main() {
  console.log('--- INSERTANDO PARTIDOS DE CUADRANGULARES (FECHAS 3 Y 4) ---');
  const equipos = await prisma.equipo.findMany();
  const equipoPorNombre = new Map(equipos.map(e => [e.nombre.trim().toLowerCase(), e.id]));

  for (const p of partidosFechas3y4) {
    const localId = equipoPorNombre.get(p.localNombre.trim().toLowerCase());
    const visitanteId = equipoPorNombre.get(p.visitanteNombre.trim().toLowerCase());

    if (!localId || !visitanteId) {
      throw new Error(`No se encontró equipo: ${p.localNombre} (${localId}) o ${p.visitanteNombre} (${visitanteId})`);
    }

    const res = await prisma.partido.upsert({
      where: {
        fase_equipo_local_id_equipo_visitante_id: {
          fase: p.fase,
          equipo_local_id: localId,
          equipo_visitante_id: visitanteId,
        },
      },
      update: {
        jornada: p.jornada,
        grupo: p.grupo,
        fecha_hora_partido: p.fecha_hora_partido,
        hora_cierre_predicciones: p.hora_cierre_predicciones,
        estadio: p.estadio,
        estado: EstadoPartido.programado,
      },
      create: {
        fase: p.fase,
        grupo: p.grupo,
        jornada: p.jornada,
        equipo_local_id: localId,
        equipo_visitante_id: visitanteId,
        fecha_hora_partido: p.fecha_hora_partido,
        hora_cierre_predicciones: p.hora_cierre_predicciones,
        estadio: p.estadio,
        estado: EstadoPartido.programado,
      },
    });

    console.log(`✅ [OK] ID ${res.id} | J${res.jornada} (Fase: ${res.fase}, Grupo: ${res.grupo}) | ${p.localNombre} vs ${p.visitanteNombre} | ${p.fecha_hora_partido.toISOString()}`);
  }

  const conteoFase2 = await prisma.partido.count({ where: { fase: Fase.fase_2 } });
  console.log(`\nTotal partidos fase_2 en DB: ${conteoFase2}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

