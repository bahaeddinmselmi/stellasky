// Patch jimp to skip .ico files
const fs = require('fs');
const path = require('path');

const jimpPath = path.join(__dirname, '../node_modules/jimp-compact/dist/jimp.js');

if (fs.existsSync(jimpPath)) {
  let content = fs.readFileSync(jimpPath, 'utf8');
  
  // Replace the throwError call for unsupported MIME with a console.warn and return
  const original = `throwError(C:\\dev\\stellassky\\node_modules\\jimp-compact\\dist\\jimp.js:1:833)`;
  const patched = `if (mimeType === 'image/x-icon') { console.warn('Skipping .ico file'); return this; } throwError`;
  
  // Actually, let's just add a check before parseBitmap
  if (!content.includes('// PATCHED')) {
    content = content.replace(
      'parseBitmap(e){',
      'parseBitmap(e){ if(e&&e.mime==="image/x-icon"){console.warn("Skipping .ico");return this;} // PATCHED\n'
    );
    
    fs.writeFileSync(jimpPath, content, 'utf8');
    console.log('✅ Patched jimp to skip .ico files');
  } else {
    console.log('✅ Jimp already patched');
  }
} else {
  console.log('⚠️  jimp-compact not found at expected path');
}
