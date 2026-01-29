import { experienceLearning } from './src/agent/core/ExperienceLearning.js';

const id1 = (experienceLearning as any).generateExperienceId('agent_mistake', 'цена на озон');
const id2 = (experienceLearning as any).generateExperienceId('agent_mistake', 'озон цена на');
const id3 = (experienceLearning as any).generateExperienceId('agent_mistake', 'цена озон');

console.log('ID 1:', id1);
console.log('ID 2:', id2);
console.log('ID 3:', id3);

if (id1 === id2 && id2 === id3) {
  console.log('✅ Идентификаторы СОВПАДАЮТ! Дедупликация логически верна.');
} else {
  console.log('❌ Идентификаторы РАЗНЫЕ. Нужно чинить нормализацию.');
}
