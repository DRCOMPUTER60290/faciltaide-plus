const BIRTH_DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g;

export const calculateAge = (birthDate: Date, referenceDate: Date = new Date()): number => {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
};

export const parseBirthDateString = (value: string): Date | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);

  const candidate = new Date(year, month, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return candidate;
};

export const formatBirthDateString = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatAnswerWithCalculatedAge = (
  stepId: string,
  answer: string,
  referenceDate: Date = new Date(),
): string => {
  const trimmed = answer.trim();

  if (!trimmed.length || trimmed.toLowerCase().includes('âge calculé')) {
    return trimmed;
  }

  if (!stepId.includes('birth-date')) {
    return trimmed;
  }

  return trimmed.replace(BIRTH_DATE_REGEX, (match) => {
    const parsed = parseBirthDateString(match);
    if (!parsed) {
      return match;
    }

    const age = calculateAge(parsed, referenceDate);
    const ageLabel = age > 1 ? 'ans' : 'an';
    return `${formatBirthDateString(parsed)} (Âge calculé : ${age} ${ageLabel})`;
  });
};
