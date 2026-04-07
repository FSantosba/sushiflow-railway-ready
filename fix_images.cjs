const fs = require('fs');

let content = fs.readFileSync('views/shared/InventoryControl.tsx', 'utf8');

const sIdx = content.indexOf('  const searchGoogleImages = async () => {');
const eIdx = content.indexOf('  const selectImage = (url: string) => {');

if (sIdx !== -1 && eIdx !== -1) {
  const newFunc = `  const searchGoogleImages = async () => {
    if (!form.name.trim()) {
      alert('Digite o nome do insumo primeiro!');
      return;
    }
    const query = encodeURIComponent(form.name + ' ingrediente png');
    window.open('https://www.google.com/search?tbm=isch&q=' + query, '_blank');
  };\n\n`;
  content = content.substring(0, sIdx) + newFunc + content.substring(eIdx);
  fs.writeFileSync('views/shared/InventoryControl.tsx', content);
  console.log('Fixed InventoryControl.tsx');
} else {
  console.log('Error InventoryControl.tsx boundaries fail');
}

let c2 = fs.readFileSync('views/shared/MenuView.tsx', 'utf8');
const sIdx2 = c2.indexOf('  const searchGoogleImages = async () => {');
const eIdx2 = c2.indexOf('  const handleImageSelect = (url: string) => {') || c2.indexOf('  //');

let actualEidx2 = c2.indexOf('  const handleImageSelect = (url: string) => {');
if (actualEidx2 === -1) {
  // try another boundary
  actualEidx2 = c2.indexOf('  const handleAdd = (e: React.FormEvent) => {');
}

if (sIdx2 !== -1 && actualEidx2 !== -1) {
  const newFunc2 = `  const searchGoogleImages = async () => {
    if (!imageSearchQuery.trim()) return;
    const query = encodeURIComponent(imageSearchQuery + ' png');
    window.open('https://www.google.com/search?tbm=isch&q=' + query, '_blank');
  };\n\n`;
  c2 = c2.substring(0, sIdx2) + newFunc2 + c2.substring(actualEidx2);
  fs.writeFileSync('views/shared/MenuView.tsx', c2);
  console.log('Fixed MenuView.tsx');
} else {
  console.log('Error MenuView.tsx boundaries fail: ', sIdx2, actualEidx2);
}
