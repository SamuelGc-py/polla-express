import { PrismaClient, Fase, Grupo, EstadoPartido } from '@prisma/client';

const prisma = new PrismaClient();

const partidosFechas5y6 = [
  // --- FECHA 5 (Jornada 24) - Fechas y horarios tentativos por confirmar Dimayor ---
  // GRUPO B (Sábado 5 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 24,
    localNombre: 'Atlético Bucaramanga',
    visitanteNombre: 'Millonarios F.C.',
    fecha_hora_partido: new Date('2026-12-05T23:00:00.000Z'), // 6:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-05T22:30:00.000Z'),
    estadio: 'Américo Montanini',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 24,
    localNombre: 'Deportivo Cali',
    visitanteNombre: 'América de Cali',
    fecha_hora_partido: new Date('2026-12-06T01:00:00.000Z'), // 8:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-06T00:30:00.000Z'),
    estadio: 'Deportivo Cali',
  },
  // GRUPO A (Domingo 6 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 24,
    localNombre: 'Once Caldas DAF',
    visitanteNombre: 'Independiente Santa Fe',
    fecha_hora_partido: new Date('2026-12-06T23:00:00.000Z'), // 6:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-06T22:30:00.000Z'),
    estadio: 'Palogrande',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 24,
    localNombre: 'Independiente Medellín',
    visitanteNombre: 'Atlético Nacional',
    fecha_hora_partido: new Date('2026-12-07T01:00:00.000Z'), // 8:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-07T00:30:00.000Z'),
    estadio: 'Atanasio Girardot',
  },

  // --- FECHA 6 (Jornada 25) - Fechas y horarios tentativos por confirmar Dimayor ---
  // GRUPO B (Martes 8 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 25,
    localNombre: 'Millonarios F.C.',
    visitanteNombre: 'Deportivo Cali',
    fecha_hora_partido: new Date('2026-12-08T23:00:00.000Z'), // 6:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-08T22:30:00.000Z'),
    estadio: 'El Campín',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.B,
    jornada: 25,
    localNombre: 'América de Cali',
    visitanteNombre: 'Atlético Bucaramanga',
    fecha_hora_partido: new Date('2026-12-09T01:00:00.000Z'), // 8:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-09T00:30:00.000Z'),
    estadio: 'Pascual Guerrero',
  },
  // GRUPO A (Miércoles 9 de diciembre)
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 25,
    localNombre: 'Independiente Santa Fe',
    visitanteNombre: 'Independiente Medellín',
    fecha_hora_partido: new Date('2026-12-09T23:00:00.000Z'), // 6:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-09T22:30:00.000Z'),
    estadio: 'El Campín',
  },
  {
    fase: Fase.fase_2,
    grupo: Grupo.A,
    jornada: 25,
    localNombre: 'Atlético Nacional',
    visitanteNombre: 'Once Caldas DAF',
    fecha_hora_partido: new Date('2026-12-10T01:00:00.000Z'), // 8:00 PM Col (tentativo)
    hora_cierre_predicciones: new Date('2026-12-10T00:30:00.000Z'),
    estadio: 'Atanasio Girardot',
  },
];

async function main() {
  console.log('--- INSERTANDO PARTIDOS DE CUADRANGULARES (FECHAS 5 Y 6) ---');
  const equipos = await prisma.equipo.findMany();
  const equipoPorNombre = new Map(equipos.map(e => [e.nombre.trim().toLowerCase(), e.id]));

  for (const p of partidosFechas5y6) {
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

