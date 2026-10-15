const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'react-native-css-interop', 'dist', 'runtime', 'native', 'render-component.js');

if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  if (!content.includes('catch { console.warn(`CssInterop upgrade warning: ${warning}`); }')) {
    content = content.replace(
      /function printUpgradeWarning\(warning, originalProps\) \{[\s\S]*?function getDebugReplacer\(\)/,
      `function printUpgradeWarning(warning, originalProps) {
    try {
        console.log(\`CssInterop upgrade warning.\\n\\n\${warning}.\\n\\nThis warning was caused by a component with the props:\\n\${stringify(originalProps)}\\n\\nIf adding or removing sibling components caused this warning you should add a unique "key" prop to your components. https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key\\n\`);
    } catch {
        console.warn(\`CssInterop upgrade warning: \${warning}\`);
    }
}
function stringify(object) {
    try {
        const seen = new WeakSet();
        return JSON.stringify(object, function replace(_, value) {
            if (!(value !== null && typeof value === "object")) {
                return value;
            }
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
            const newValue = Array.isArray(value) ? [] : {};
            try {
                for (const key of Object.keys(value)) {
                    try {
                        newValue[key] = replace(key, value[key]);
                    } catch {}
                }
            } catch {}
            seen.delete(value);
            return newValue;
        }, 2);
    } catch {
        return "[Unserializable]";
    }
}
function getDebugReplacer()`
    );
    fs.writeFileSync(target, content, 'utf8');
    console.log('Successfully patched react-native-css-interop render-component.js');
  }
}
