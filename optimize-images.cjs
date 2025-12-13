// Image optimization script using sharp
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'public/products');
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png'));

async function optimize() {
  console.log('🖼️ Optimizing images...');
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(inputDir, file.replace('.png', '.webp'));
    
    try {
      await sharp(inputPath)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 75 })
        .toFile(outputPath);
      
      const oldSize = fs.statSync(inputPath).size;
      const newSize = fs.statSync(outputPath).size;
      console.log(`✅ ${file} → ${file.replace('.png', '.webp')}: ${Math.round(oldSize/1024)}KB → ${Math.round(newSize/1024)}KB`);
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err.message);
    }
  }
  
  console.log('🎉 Done!');
}

optimize();
