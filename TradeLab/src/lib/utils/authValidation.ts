export const PASSWORD_MIN_LENGTH = 8;

// Même jeu de symboles que la politique de mot de passe de Supabase Auth
const PASSWORD_SYMBOLS = '!@#$%^&*()_+-=[]{};\':"\\|<>?,./`~';

export type PasswordRuleId = 'length' | 'lower' | 'upper' | 'digit' | 'symbol';

export type PasswordRuleResult = {
    id: PasswordRuleId;
    label: string;
    passed: boolean;
};

export type PasswordStrength = {
    score: 0 | 1 | 2 | 3 | 4;
    label: string;
};

export type PasswordCheck = {
    rules: PasswordRuleResult[];
    isValid: boolean;
    strength: PasswordStrength;
};

const PASSWORD_RULES: { id: PasswordRuleId; label: string; test: (value: string) => boolean }[] = [
    { id: 'length', label: `${PASSWORD_MIN_LENGTH} caractères minimum`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
    { id: 'upper', label: 'Une majuscule', test: (v) => /[A-Z]/.test(v) },
    { id: 'lower', label: 'Une minuscule', test: (v) => /[a-z]/.test(v) },
    { id: 'digit', label: 'Un chiffre', test: (v) => /\d/.test(v) },
    { id: 'symbol', label: 'Un symbole (!@#$…)', test: (v) => [...v].some((c) => PASSWORD_SYMBOLS.includes(c)) },
];

const STRENGTH_LABELS = ['', 'Faible', 'Moyen', 'Fort', 'Excellent'] as const;

export function checkPassword(value: string): PasswordCheck {
    const rules = PASSWORD_RULES.map(({ id, label, test }) => ({ id, label, passed: test(value) }));
    const passedCount = rules.filter((rule) => rule.passed).length;
    const isValid = passedCount === rules.length;

    let score: PasswordStrength['score'] = 0;
    if (value) {
        if (isValid) score = value.length >= 12 ? 4 : 3;
        else score = passedCount >= 3 ? 2 : 1;
    }

    return { rules, isValid, strength: { score, label: STRENGTH_LABELS[score] } };
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function getFriendlyAuthError(err: unknown): string {
    const fallback = 'Une erreur est survenue';
    if (!(err instanceof Error)) return fallback;

    const code = (err as Error & { code?: string }).code ?? '';
    const rawMessage = err.message || fallback;

    if (code === 'weak_password' || rawMessage.includes('Password should')) {
        return 'Le mot de passe est trop faible. Utilisez au moins une majuscule, une minuscule, un chiffre et un symbole.';
    }
    if (code === 'invalid_credentials' || rawMessage.includes('Invalid login credentials')) {
        return 'Courriel ou mot de passe incorrect.';
    }
    if (code === 'email_not_confirmed' || rawMessage.includes('Email not confirmed')) {
        return 'Confirmez votre adresse courriel avant de vous connecter.';
    }
    if (code === 'user_already_exists' || rawMessage.includes('already registered')) {
        return 'Un compte existe déjà avec cette adresse courriel.';
    }
    if (code.startsWith('over_') || /rate limit|security purposes/i.test(rawMessage)) {
        return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
    }

    return rawMessage;
}
