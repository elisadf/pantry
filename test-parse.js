const fs = require('fs');
const content = `---\nname: Test\ncategory: mains\ncalorie_estimate_kcal: 100\n---\nbody`;

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
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

console.log(parseFrontmatter(content));

const contentWithCRLF = `---\r\nname: Test2\r\ncategory: mains\r\ncalorie_estimate_kcal: 100\r\n---\r\nbody`;
console.log(parseFrontmatter(contentWithCRLF));
