import 'dotenv/config';
import fetch from 'node-fetch';

async function checkInfrastructure() {
  console.log('📡 Проверка инфраструктуры MoE...');

  // 1. Проверка API сервера
  try {
    const api = await fetch('http://localhost:3001/api/health'); // Если есть такой эндпоинт
    console.log(`✅ API Server: ${api.status}`);
  } catch (e) {
    console.log('❌ API Server не отвечает на 3001 порту');
  }

  // 2. Проверка vLLM
  try {
    const vllm = await fetch('http://localhost:8000/v1/models');
    const data = await vllm.json();
    console.log('✅ vLLM (Phi-3-mini): Готов', data.data[0]?.id);
  } catch (e) {
    console.log('⏳ vLLM еще загружается или не отвечает');
  }

  // 3. Проверка Chroma
  try {
    const chroma = await fetch('http://localhost:8001/api/v1/heartbeat');
    if (chroma.ok) {
      console.log('✅ ChromaDB: Жива');
    } else {
      console.log(`⚠️ ChromaDB вернула статус ${chroma.status}`);
    }
  } catch (e) {
    console.log('❌ ChromaDB не отвечает на 8001 порту');
  }

  // 4. Проверка Redis (GPU Node)
  try {
    // Для Redis лучше использовать библиотеку, но проверим хотя бы порт
    console.log('ℹ️ Redis GPU Node: Проверьте порт 6380 вручную');
  } catch (e) {}
}

checkInfrastructure();
