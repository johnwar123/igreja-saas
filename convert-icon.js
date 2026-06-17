const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('build/icon.svg');

sharp(svg, { density: 384 })
  .resize(512, 512)
  .png()
  .toFile('build/icon.png')
  .then(() => {
    console.log('PNG OK');
    return sharp(svg, { density: 384 })
      .resize(256, 256)
      .png()
      .toBuffer();
  })
  .then(pngBuffer => {
    return sharp(pngBuffer)
      .resize(256, 256)
      .toFile('build/icon.ico');
  })
  .then(() => console.log('ICO OK'))
  .catch(e => console.error(e));
