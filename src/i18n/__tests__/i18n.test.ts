import { t } from '@/i18n';

describe('catálogo de traducción', () => {
  it('devuelve el texto de una clave', () => {
    expect(t('app.nombre')).toBe('FinancialControl');
  });

  it('sustituye los huecos por sus valores', () => {
    expect(t('diagnostico.supabaseCorrecto', { filas: 3 })).toContain('3');
  });

  it('deja el hueco si falta el valor', () => {
    expect(t('diagnostico.supabaseCorrecto', {})).toContain('{{filas}}');
  });
});
