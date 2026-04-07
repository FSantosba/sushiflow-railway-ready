const fs = require('fs');

let c1 = fs.readFileSync('views/shared/InventoryControl.tsx', 'utf8');
c1 = c1.replace(/const searchGoogleImages = async \(\) => \{[\s\S]*?finally \{\s*setSearchingImages\(false\);\s*\}\s*\};/, `const searchGoogleImages = async () => {
    if (!form.name.trim()) {
      alert('Digite o nome do insumo primeiro!');
      return;
    }
    const query = encodeURIComponent(form.name + ' ingrediente');
    window.open('https://www.google.com/search?tbm=isch&q=' + query, '_blank');
    setSearchingImages(false);
  };`);
fs.writeFileSync('views/shared/InventoryControl.tsx', c1);

let c2 = fs.readFileSync('views/shared/MenuView.tsx', 'utf8');
c2 = c2.replace(/const searchGoogleImages = async \(\) => \{[\s\S]*?finally \{\s*setSearchingImages\(false\);\s*\}\s*\};/, `const searchGoogleImages = async () => {
    if (!imageSearchQuery.trim()) return;
    const query = encodeURIComponent(imageSearchQuery + ' comida');
    window.open('https://www.google.com/search?tbm=isch&q=' + query, '_blank');
    setSearchingImages(false);
  };`);
fs.writeFileSync('views/shared/MenuView.tsx', c2);

console.log('Fixed');
