import { experienceLearning } from './src/agent/core/ExperienceLearning.js';

const s1 = 'цена на озонОтвет не прошел валидацию: ошибка 1';
const s2 = 'озон цена наОтвет не прошел валидацию: ошибка 1';

const k1 = (experienceLearning as any).extractKeywords(s1);
const k2 = (experienceLearning as any).extractKeywords(s2);

console.log('Keywords 1:', k1);
console.log('Keywords 2:', k2);
