const fs = require('fs');

function parseFrontmatter(content) {
    const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!match) return null;

    try {
        const yamlContent = match[1];
        const frontmatter = {};
        
        const lines = yamlContent.split("\n");
        let currentKey = "";
        let currentArray = [];
        let currentValue = "";
        let inArray = false;

        for (const line of lines) {
            const arrayMatch = line.match(/^(\w+):\s*\[(.*)\]$/);
            const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
            
            if (arrayMatch) {
                if (currentKey) {
                    frontmatter[currentKey] = currentArray;
                }
                currentKey = arrayMatch[1];
                currentArray = arrayMatch[2] ? arrayMatch[2].split(",").map((s) => s.trim().replace(/["']/g, "")) : [];
            } else if (keyValueMatch) {
                if (currentKey) {
                    frontmatter[currentKey] = currentArray.length > 0 ? currentArray : currentValue.trim();
                    currentArray = [];
                }
                currentKey = keyValueMatch[1];
                const value = keyValueMatch[2].trim().replace(/^["']|["']$/g, "");
                
                if (value === "[]" || value === "") {
                    currentValue = "";
                    currentArray = [];
                } else if (!isNaN(Number(value))) {
                    frontmatter[currentKey] = Number(value);
                    currentKey = "";
                } else {
                    currentValue = value;
                }
            }
        }
        
        if (currentKey) {
            frontmatter[currentKey] = currentArray.length > 0 ? currentArray : currentValue.trim();
        }

        return frontmatter;
    } catch (e) {
        console.error("Failed to parse frontmatter:", e);
        return null;
    }
}

const contentQuotes = `---\n"name": "Test"\n"category": "mains"\n"calorie_estimate_kcal": 100\n---`;
console.log(parseFrontmatter(contentQuotes));

const contentIndented = `---\n  name: Test\n  category: mains\n  calorie_estimate_kcal: 100\n---`;
console.log(parseFrontmatter(contentIndented));
