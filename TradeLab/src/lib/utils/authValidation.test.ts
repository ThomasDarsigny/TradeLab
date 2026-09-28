import { describe, expect, it } from 'vitest';
import { checkPassword, getFriendlyAuthError, isValidEmail } from './authValidation';

const failedRules = (value: string) =>
	checkPassword(value).rules.filter((rule) => !rule.passed).map((rule) => rule.id);

describe('checkPassword', () => {
	it('refuse un mot de passe vide', () => {
		const result = checkPassword('');
		expect(result.isValid).toBe(false);
		expect(result.strength.score).toBe(0);
	});

	it('signale chaque critère manquant', () => {
		expect(failedRules('abc')).toEqual(['length', 'upper', 'digit', 'symbol']);
		expect(failedRules('Abcdefgh1')).toEqual(['symbol']);
		expect(failedRules('ABCDEFG1!')).toEqual(['lower']);
		expect(failedRules('Abc1!')).toEqual(['length']);
	});

	it('accepte un mot de passe complexe', () => {
		const result = checkPassword('Tr4de!Lab');
		expect(result.isValid).toBe(true);
		expect(result.strength.score).toBe(3);
	});

	it('donne la meilleure note aux mots de passe longs et complexes', () => {
		expect(checkPassword('Tr4de!Lab-2026').strength).toEqual({ score: 4, label: 'Excellent' });
	});

	it('ne compte pas les espaces ni les accents comme symboles', () => {
		expect(failedRules('Abcdefg1 é')).toEqual(['symbol']);
	});
});

describe('isValidEmail', () => {
	it('valide les adresses courantes', () => {
		expect(isValidEmail('user@tradelab.com')).toBe(true);
		expect(isValidEmail('  prenom.nom@cegep.qc.ca ')).toBe(true);
	});

	it('refuse les adresses incomplètes', () => {
		expect(isValidEmail('')).toBe(false);
		expect(isValidEmail('user@')).toBe(false);
		expect(isValidEmail('user@tradelab')).toBe(false);
		expect(isValidEmail('user tradelab.com')).toBe(false);
	});
});

describe('getFriendlyAuthError', () => {
	const authError = (message: string, code?: string) => Object.assign(new Error(message), { code });

	it('traduit les erreurs Supabase connues', () => {
		expect(getFriendlyAuthError(authError('Invalid login credentials', 'invalid_credentials')))
			.toBe('Courriel ou mot de passe incorrect.');
		expect(getFriendlyAuthError(authError('Email not confirmed')))
			.toContain('Confirmez votre adresse courriel');
		expect(getFriendlyAuthError(authError('Password should contain at least one character of each: ...')))
			.toContain('trop faible');
		expect(getFriendlyAuthError(authError('email rate limit exceeded', 'over_email_send_rate_limit')))
			.toContain('Trop de tentatives');
	});

	it('garde le message tel quel sinon', () => {
		expect(getFriendlyAuthError(new Error('Erreur maison'))).toBe('Erreur maison');
		expect(getFriendlyAuthError('pas une erreur')).toBe('Une erreur est survenue');
	});
});
