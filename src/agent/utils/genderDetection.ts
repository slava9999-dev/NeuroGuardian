// ============================================
// NeuroGUARDIAN — Gender Detection Utility
// Infers gender from Russian/CIS first names
// Version: 1.0.0 | Date: January 2026
// ============================================

/**
 * Common Russian male name endings
 * Russian male names often end with consonants, -ий, -ей
 */
const MALE_ENDINGS = ['ей', 'ий', 'ай', 'ой', 'ан', 'он', 'ин', 'ен', 'ёр'];

/**
 * Explicitly female names (exceptions)
 */
const FEMALE_NAMES = new Set([
  'анна',
  'мария',
  'елена',
  'ольга',
  'наталья',
  'татьяна',
  'ирина',
  'светлана',
  'екатерина',
  'юлия',
  'марина',
  'галина',
  'валентина',
  'людмила',
  'надежда',
  'любовь',
  'вера',
  'нина',
  'лариса',
  'тамара',
  'алла',
  'евгения',
  'антонина',
  'виктория',
  'дарья',
  'полина',
  'анастасия',
  'ксения',
  'алина',
  'алёна',
  'кристина',
  'яна',
  'елизавета',
  'лиза',
  'настя',
  'катя',
  'маша',
  'саша',
  'женя',
  'оля',
  'лена',
  'таня',
  'ира',
  'света',
  'наташа',
  'юля',
  'даша',
  'вика',
  'аня',
  'валя',
  'вероника',
  'карина',
  'диана',
  'софия',
  'софия',
  'эльвира',
  'альбина',
  'рената',
  'лилия',
  'роза',
  'зина',
  'инна',
  'рая',
  'зоя',
  'ева',
  'майя',
  'алиса',
  'арина',
  'милана',
  // Ukrainian/Belarusian
  'оксана',
  'оксанка',
  'леся',
  'василина',
  'ярослава',
  // Short forms that could be ambiguous but are commonly female
  'александра',
  'валерия',
  'евгения',
]);

/**
 * Explicitly male names (exceptions and common)
 */
const MALE_NAMES = new Set([
  'александр',
  'сергей',
  'андрей',
  'дмитрий',
  'алексей',
  'максим',
  'иван',
  'михаил',
  'николай',
  'владимир',
  'виктор',
  'павел',
  'петр',
  'антон',
  'артём',
  'денис',
  'игорь',
  'олег',
  'роман',
  'евгений',
  'константин',
  'василий',
  'фёдор',
  'георгий',
  'григорий',
  'борис',
  'валерий',
  'виталий',
  'вячеслав',
  'геннадий',
  'леонид',
  'юрий',
  'владислав',
  'станислав',
  'степан',
  'тимур',
  'руслан',
  'илья',
  'кирилл',
  'никита',
  'даниил',
  'данил',
  'егор',
  'матвей',
  'тимофей',
  'лев',
  'марк',
  'глеб',
  'артур',
  'арсений',
  'семён',
  // Short forms
  'саша',
  'женя',
  'валя',
  'паша',
  'ваня',
  'дима',
  'серёжа',
  'лёша',
  'миша',
  'коля',
  'вова',
  'витя',
  'петя',
  'толя',
  'гена',
  'боря',
  // Note: саша, женя, валя are AMBIGUOUS - handled separately
]);

/**
 * Ambiguous names that can be both male and female
 */
const AMBIGUOUS_NAMES = new Set(['саша', 'женя', 'валя', 'никита', 'шура']);

/**
 * Gender type
 */
export type Gender = 'male' | 'female' | 'unknown';

/**
 * Infer gender from first name
 * Uses multiple heuristics for Russian/CIS names
 *
 * @param firstName - The first name to analyze
 * @returns Inferred gender
 */
export function inferGender(firstName: string | undefined): Gender {
  if (!firstName) return 'unknown';

  const name = firstName.toLowerCase().trim();

  if (!name || name.length < 2) return 'unknown';

  // 1. Check explicit lists first
  if (FEMALE_NAMES.has(name)) return 'female';
  if (MALE_NAMES.has(name) && !AMBIGUOUS_NAMES.has(name)) return 'male';

  // 2. Handle ambiguous names - default to unknown
  if (AMBIGUOUS_NAMES.has(name)) return 'unknown';

  // 3. Check endings (heuristic for Russian names)

  // Female endings (most reliable)
  if (name.endsWith('а') || name.endsWith('я')) {
    // Except common male names ending in а/я
    const maleExceptions = ['никита', 'илья', 'кузьма', 'фома', 'лука'];
    if (maleExceptions.includes(name)) return 'male';
    return 'female';
  }

  // Names ending in -ия are almost always female
  if (name.endsWith('ия')) return 'female';

  // Names ending in -ья are usually female (Софья, Дарья)
  if (name.endsWith('ья')) return 'female';

  // Male endings
  for (const ending of MALE_ENDINGS) {
    if (name.endsWith(ending)) return 'male';
  }

  // 4. Names ending in consonants are usually male
  const lastChar = name[name.length - 1];
  const vowels = ['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'];
  if (!vowels.includes(lastChar)) {
    return 'male';
  }

  // 5. Default to unknown
  return 'unknown';
}

/**
 * Get appropriate greeting style based on gender
 */
export function getGreetingStyle(gender: Gender): {
  tone: 'gallant' | 'professional' | 'neutral';
  canUseCompliments: boolean;
  useEncouragement: boolean;
} {
  switch (gender) {
    case 'female':
      return {
        tone: 'gallant',
        canUseCompliments: true,
        useEncouragement: true,
      };
    case 'male':
      return {
        tone: 'professional',
        canUseCompliments: false,
        useEncouragement: false,
      };
    default:
      return {
        tone: 'neutral',
        canUseCompliments: false,
        useEncouragement: false,
      };
  }
}
