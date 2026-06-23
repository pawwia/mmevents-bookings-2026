/**
 * Wymagania hasła — muszą być zgodne z Validator::strongPassword po stronie API:
 * min. 8 znaków, w tym co najmniej jedna litera, jedna cyfra i jeden znak specjalny.
 */
export const PASSWORD_HINT = 'Min. 8 znaków, w tym litera, cyfra i znak specjalny';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const isStrongPassword = (value) => PASSWORD_REGEX.test(value || '');
