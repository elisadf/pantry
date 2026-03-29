const yaml = require('js-yaml');
const content = `---\n  name: Test\n  category: mains\n  calorie_estimate_kcal: 100\n---`;
const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
console.log(yaml.load(match[1]));
