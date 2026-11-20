/**
 * Formatea el número de jornada según la fase del torneo Liga BetPlay:
 * - 1 a 19: Fase regular ("Fecha 1" ... "Fecha 19")
 * - 20 a 25: Cuadrangulares Semifinales ("Cuadrangulares · Fecha 1" ... "Cuadrangulares · Fecha 6")
 * - 26: Gran Final - Ida
 * - 27: Gran Final - Vuelta
 */
export function formatearJornada(jornada: number, corta = false): string {
  if (jornada >= 20 && jornada <= 25) {
    const fCuad = jornada - 19;
    return corta ? `Cuadrangulares F${fCuad}` : `Cuadrangulares · Fecha ${fCuad}`;
  }
  if (jornada === 26) return corta ? "Final Ida" : "Gran Final · Ida";
  if (jornada === 27) return corta ? "Final Vuelta" : "Gran Final · Vuelta";
  return corta ? `F${jornada}` : `Fecha ${jornada}`;
}

