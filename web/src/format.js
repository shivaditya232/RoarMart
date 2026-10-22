export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
export const count = (n) => Number(n).toLocaleString('en-IN');
export const ms = (t) => (t < 1 ? t.toFixed(2) : t < 10 ? t.toFixed(1) : t.toFixed(0)) + ' ms';
export const bytes = (b) => (b >= 1024 * 1024 ? (b / 1048576).toFixed(1) + ' MB' : b >= 10240 ? (b / 1024).toFixed(1) + ' KB' : count(b) + ' B');

// Swatch colours for the colour filter.
export const SWATCH = {
  Black: '#2B2A30', White: '#FFFFFF', Red: '#C8483C', Blue: '#5F81BC', Pink: '#E7A1B5', Green: '#6F9F6B',
  Yellow: '#E9C24A', Purple: '#8B6BB1', Grey: '#A7A4AB', Beige: '#E2CFAF', Brown: '#8A5A3C', Gold: '#C9A24B',
  Silver: '#C9CCD3', Orange: '#E8853A', Maroon: '#7A2433', Navy: '#26375E', Multicolor: 'conic-gradient(#C8483C, #E9C24A, #6F9F6B, #5F81BC, #8B6BB1, #C8483C)',
  Clear: '#EEF3F6', Tan: '#C9A27A', Copper: '#B4693E', Bronze: '#9C6B30', Steel: '#8C939B', Turquoise: '#3FB7B0', Cream: '#F3E8CF',
};
