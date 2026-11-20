import { PrismaClient, Fase, Grupo, EstadoPartido } from '@prisma/client';

const prisma = new PrismaClient();

const partidosCuadrangulares = [
  // --- FECHA 1 (Jornada 20) ---
  // GRUPO A
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 20,
    localNombre: 'Independiente Medellín',
    visitanteNombre: 'Independiente Santa Fe',
    fecha_hora_partido: new Date('2026-11-20T21:30:00.000Z'), // 4:30 PM Col
    hora_cierre_predicciones: new Date('2026-11-20T21:00:00.000Z'),
    estadio: 'Atanasio Girardot',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 20,
    localNombre: 'Once Caldas DAF',
    visitanteNombre: 'Atlético Nacional',
    fecha_hora_partido: new Date('2026-11-22T01:15:00.000Z'), // 8:15 PM Col (Sábado 21)
    hora_cierre_predicciones: new Date('2026-11-22T00:45:00.000Z'),
    estadio: 'Palogrande',
  },
  // GRUPO B
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 20,
    localNombre: 'Atlético Bucaramanga',
    visitanteNombre: 'América de Cali',
    fecha_hora_partido: new Date('2026-11-20T23:35:00.000Z'), // 6:35 PM Col
    hora_cierre_predicciones: new Date('2026-11-20T23:05:00.000Z'),
    estadio: 'Américo Montanini',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 20,
    localNombre: 'Deportivo Cali',
    visitanteNombre: 'Millonarios F.C.',
    fecha_hora_partido: new Date('2026-11-21T01:40:00.000Z'), // 8:40 PM Col
    hora_cierre_predicciones: new Date('2026-11-21T01:10:00.000Z'),
    estadio: 'Deportivo Cali',
  },

  // --- FECHA 2 (Jornada 21) ---
  // GRUPO B (Martes 24 de noviembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 21,
    localNombre: 'Millonarios F.C.',
    visitanteNombre: 'Atlético Bucaramanga',
    fecha_hora_partido: new Date('2026-11-24T23:20:00.000Z'), // 6:20 PM Col
    hora_cierre_predicciones: new Date('2026-11-24T22:50:00.000Z'),
    estadio: 'El Campín',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 21,
    localNombre: 'América de Cali',
    visitanteNombre: 'Deportivo Cali',
    fecha_hora_partido: new Date('2026-11-25T01:30:00.000Z'), // 8:30 PM Col
    hora_cierre_predicciones: new Date('2026-11-25T01:00:00.000Z'),
    estadio: 'Pascual Guerrero',
  },
  // GRUPO A (Miércoles 25 de noviembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 21,
    localNombre: 'Independiente Santa Fe',
    visitanteNombre: 'Once Caldas DAF',
    fecha_hora_partido: new Date('2026-11-25T23:20:00.000Z'), // 6:20 PM Col
    hora_cierre_predicciones: new Date('2026-11-25T22:50:00.000Z'),
    estadio: 'El Campín',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 21,
    localNombre: 'Atlético Nacional',
    visitanteNombre: 'Independiente Medellín',
    fecha_hora_partido: new Date('2026-11-26T01:30:00.000Z'), // 8:30 PM Col
    hora_cierre_predicciones: new Date('2026-11-26T01:00:00.000Z'),
    estadio: 'Atanasio Girardot',
  },
];

async function main() {
  console.log('--- INSERTANDO PARTIDOS DE CUADRANGULARES (FECHAS 1 Y 2) ---');
  const equipos = await prisma.equipo.findMany();
  const equipoPorNombre = new Map(equipos.map(e => [e.nombre.trim().toLowerCase(), e.id]));

  for (const p of partidosCuadrangulares) {
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

