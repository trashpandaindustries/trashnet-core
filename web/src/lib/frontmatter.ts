export type FrontmatterValidationResult = {
  hasFrontmatter: boolean;
  isValid: boolean;
  isClosed: boolean;
  errors: string[];
  parsed: Record<string, any>;
};

export function validateFrontmatter(content: string): FrontmatterValidationResult {
  const result: FrontmatterValidationResult = {
    hasFrontmatter: false,
    isValid: true,
    isClosed: false,
    errors: [],
    parsed: {}
  };

  const trimContent = content.trimStart();
  if (!trimContent.startsWith('---')) {
    return result;
  }

  result.hasFrontmatter = true;

  // Find the closing ---
  // The first --- is at the start (index 0).
  // The next --- must be on its own line.
  const endMatch = /(?:\r?\n)---(?:\r?\n|$)/.exec(trimContent.substring(3));

  if (!endMatch) {
    result.isValid = false;
    result.isClosed = false;
    result.errors.push("Block exists but isn't properly closed (no closing ---)");
    return result;
  }

  result.isClosed = true;

  // Extract the inner block
  const blockStart = 3;
  const blockEnd = 3 + endMatch.index;
  const rawBlock = trimContent.substring(blockStart, blockEnd).trim();

  if (!rawBlock) {
    result.isValid = false;
    result.errors.push("Block exists but is empty");
    return result;
  }

  // Very naive parser for structural checks
  // 1. Known date fields
  // 2. tags array
  
  const lines = rawBlock.split(/\r?\n/);
  
  let currentKey = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines or pure comments (simplification)
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIdx = line.indexOf(':');
    if (separatorIdx !== -1 && !line.match(/^\s*- /)) {
      currentKey = line.substring(0, separatorIdx).trim();
      let valueStr = line.substring(separatorIdx + 1).trim();

      // Store in parsed for rendering
      result.parsed[currentKey] = valueStr;
      
      // Structure check: Is it an inline array? e.g. [foo, bar]
      const isInlineArray = valueStr.startsWith('[') && valueStr.endsWith(']');

      // Date check
      if (['date', 'pubDate', 'updatedDate'].includes(currentKey)) {
        if (valueStr) { // If there's a value on the same line
          // strip quotes if any
          const cleanDateStr = valueStr.replace(/^['"]|['"]$/g, '');
          const d = new Date(cleanDateStr);
          if (isNaN(d.getTime())) {
            result.isValid = false;
            result.errors.push(`Field '${currentKey}' has an unparseable date value.`);
          }
        }
      }
      
      // Tags format check
      if (currentKey === 'tags') {
        if (valueStr && !isInlineArray) {
          // e.g. tags: oops
          result.isValid = false;
          result.errors.push("Field 'tags' is present but isn't formatted as an array (use [val, val] or - val on next lines).");
        } else if (!valueStr) {
          // Check following lines for list items
          let hasListItems = false;
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const nextTrimmed = lines[nextIdx].trim();
            if (nextTrimmed.startsWith('- ')) {
              hasListItems = true;
              nextIdx++;
            } else if (!nextTrimmed) {
              nextIdx++; // empty line permitted inside block? maybe. Let's just skip
            } else {
               break; 
            }
          }
          if (!hasListItems && !isInlineArray) {
             result.isValid = false;
             result.errors.push("Field 'tags' is present but has no valid array items underneath it.");
          }
        }
      }
    } else {
      // It's a line without a colon and not a standard array item, or an array item
      // Could be indentation syntax error, but we'll loosely ignore strict YAML compliance
      // per requirements ("What it deliberately ignores: ... Values beyond the structural checks above")
      // Wait, "Indentation/YAML syntax errors that would break any parser".
      // If we see a plain string that doesn't start with '-' and isn't a key: value pair, and we're not inside a multi-line string...
      // This is a naive regex parser, so we'll just flag lines that have no ':' and don't start with '-'
      if (!trimmed.startsWith('-') && currentKey === '') {
         // Indentation / Syntax error
         result.isValid = false;
         result.errors.push(`Malformed content on line: "${trimmed}". Expected key: value or list item.`);
      }
    }
  }

  return result;
}

export function stripFrontmatter(content: string): string {
  const trimContent = content.trimStart();
  if (trimContent.startsWith('---')) {
    const endMatch = /(?:\r?\n)---(?:\r?\n|$)/.exec(trimContent.substring(3));
    if (endMatch) {
      return trimContent.substring(3 + endMatch.index + endMatch[0].length).trimStart();
    }
  }
  return content;
}
